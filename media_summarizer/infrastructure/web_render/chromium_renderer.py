"""A web page as a browser draws it: its DOM, its frames, and the JSON its scripts load.

Headless Chromium through Playwright, in the render worker's own image
(`infrastructure/docker/lambda-web-render.Dockerfile`) -- the shared worker image
does not carry a browser, so a cold start of any other worker does not pay for it.

Two details matter more than they look:

- The browser is the full Chromium in its new headless mode (``channel=
  "chromium"``), not Playwright's default "headless shell", and its user agent is
  a regular desktop Chrome. The shell announces ``HeadlessChrome`` in both the
  user agent and the ``Sec-CH-UA`` client hints, and CloudFront answers it with a
  403 on sites that serve a browser 200: welcometothejungle.com refused the shell
  even with a desktop user agent, and served the full Chromium (2026-11-10).
- The JSON responses are kept, not just the DOM. A click-to-play gallery has no
  iframe until it is clicked, but the provider and id of each video are in the
  data the page was built from (`core/web_page.videos_in_json`).
- An anti-bot challenge (`core/web_page.access_challenge`) is given time to clear.
  A JavaScript challenge -- served with a 200 or a 403 -- runs its checks, then
  reloads into the page; the page is read once it has. One that is still there
  at the end is reported (``RenderedPage.access_challenge``), never read as text.

Images, fonts and media are not downloaded: nothing here looks at them, and a
video would otherwise start streaming into a browser nobody watches.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, List, Optional

from media_summarizer.core.web_page import access_challenge
from media_summarizer.utils.http_user_agent import BROWSER_USER_AGENT
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

RENDER_NAVIGATION_TIMEOUT_SECONDS = float(os.environ.get("WEB_RENDER_NAVIGATION_TIMEOUT_SECONDS", "30"))
RENDER_SETTLE_TIMEOUT_SECONDS = float(os.environ.get("WEB_RENDER_SETTLE_TIMEOUT_SECONDS", "8"))
#: How long a challenge page is given to clear itself. A JavaScript challenge
#: takes a few seconds of checks and proof of work before it reloads; one still
#: on screen after this is not going to let this browser through.
RENDER_CHALLENGE_WAIT_SECONDS = float(os.environ.get("WEB_RENDER_CHALLENGE_WAIT_SECONDS", "15"))
_CHALLENGE_POLL_SECONDS = 1.0
#: The JSON kept per page, and per response: enough for any CMS payload, bounded
#: so a page streaming analytics cannot fill the function's memory.
MAX_JSON_RESPONSES = 80
MAX_JSON_RESPONSE_BYTES = 3_000_000

#: Chromium flags for a Lambda sandbox: no setuid sandbox (Lambda forbids it), no
#: /dev/shm (64 MB there), no GPU. Not `--single-process`: the new headless mode
#: is not built for it and crashes on some pages, and Lambda allows the child
#: processes anyway.
_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-zygote",
    "--disable-blink-features=AutomationControlled",
]
_SKIPPED_RESOURCES = {"image", "font", "media"}


class PageRenderError(Exception):
    """The browser could not load the page. ``status`` is the HTTP answer, if any."""

    def __init__(self, details: str, *, status: int | None = None, retryable: bool = False) -> None:
        super().__init__(details)
        self.details = details
        self.status = status
        self.retryable = retryable


@dataclass
class RenderedPage:
    html: str
    final_url: str
    status: int | None
    frame_urls: List[str] = field(default_factory=list)
    media_urls: List[str] = field(default_factory=list)
    json_payloads: List[Any] = field(default_factory=list)
    #: The kind of anti-bot interstitial the browser was still shown when it gave
    #: up waiting (`core/web_page.access_challenge`), or ``None``: ``html`` is then
    #: the vendor's page, not the one that was asked for.
    access_challenge: Optional[str] = None


async def _content(page: Any) -> Optional[str]:
    """The page's HTML, or ``None`` while it is navigating (a challenge reloading)."""
    from playwright.async_api import Error as PlaywrightError

    try:
        return await page.content()
    except PlaywrightError:
        return None


async def _settle(page: Any, *, timeout_seconds: float) -> None:
    from playwright.async_api import Error as PlaywrightError

    try:
        await page.wait_for_load_state("networkidle", timeout=timeout_seconds * 1000)
    except PlaywrightError:
        pass  # A page that never goes quiet (analytics, sockets) is read as it is.


async def _wait_out_challenge(page: Any, *, first_kind: Optional[str]) -> Optional[str]:
    """Wait for a challenge page to turn into the page; ``None`` once it has.

    Returns the kind of the interstitial still on screen when the wait ends
    (``first_kind`` if no read succeeded). A read that fails is the page
    navigating -- the challenge reloading into the page, or into its next step --
    so the loop simply reads again.
    """
    loop = asyncio.get_running_loop()
    deadline = loop.time() + RENDER_CHALLENGE_WAIT_SECONDS
    kind: Optional[str] = first_kind
    while loop.time() < deadline:
        await page.wait_for_timeout(_CHALLENGE_POLL_SECONDS * 1000)
        html = await _content(page)
        if html is None:
            continue
        kind = access_challenge(html)
        if kind is None:
            await _settle(page, timeout_seconds=RENDER_SETTLE_TIMEOUT_SECONDS)
            return None
    return kind


_DOM_MEDIA_SCRIPT = """
() => {
  const out = [];
  for (const el of document.querySelectorAll('iframe, embed, video, source, [data-src], [data-video-url], [data-embed-url]')) {
    for (const attr of ['src', 'data-src', 'data-video-url', 'data-embed-url']) {
      const v = el.getAttribute(attr);
      if (v) out.push(v);
    }
    if (el.currentSrc) out.push(el.currentSrc);
  }
  return out;
}
"""


async def render_page(url: str) -> RenderedPage:
    """Load ``url`` in headless Chromium and return what it drew and fetched."""
    from playwright.async_api import Error as PlaywrightError
    from playwright.async_api import async_playwright

    json_payloads: List[Any] = []
    pending: List[asyncio.Task] = []

    async def keep_json(response: Any) -> None:
        try:
            if response.request.resource_type not in ("xhr", "fetch"):
                return
            if "json" not in (response.headers.get("content-type") or "").lower():
                return
            if len(json_payloads) >= MAX_JSON_RESPONSES:
                return
            body = await response.body()
            if len(body) > MAX_JSON_RESPONSE_BYTES:
                return
            json_payloads.append(json.loads(body))
        except Exception:  # noqa: BLE001 - a response we cannot read is one we do without
            return

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, channel="chromium", args=_LAUNCH_ARGS)
        try:
            context = await browser.new_context(
                user_agent=BROWSER_USER_AGENT,
                viewport={"width": 1280, "height": 900},
                java_script_enabled=True,
            )

            async def route(route_obj: Any) -> None:
                if route_obj.request.resource_type in _SKIPPED_RESOURCES:
                    await route_obj.abort()
                else:
                    await route_obj.continue_()

            await context.route("**/*", route)
            page = await context.new_page()
            # The status of the document last loaded in the main frame: once a
            # challenge reloads into the page, the page's own answer is the one
            # that counts, not the challenge's 403.
            navigation_statuses: List[int] = []

            def on_response(response: Any) -> None:
                pending.append(asyncio.ensure_future(keep_json(response)))
                try:
                    if response.frame == page.main_frame and response.request.is_navigation_request():
                        navigation_statuses.append(response.status)
                except Exception:  # noqa: BLE001 - a response without a frame is not a navigation
                    return

            page.on("response", on_response)
            try:
                response = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=RENDER_NAVIGATION_TIMEOUT_SECONDS * 1000,
                )
            except PlaywrightError as exc:
                raise PageRenderError("navigation_failed", retryable=True) from exc
            status = response.status if response is not None else None
            seen: Optional[str] = None
            if status is not None and status >= 400:
                # An error page is the answer -- unless it is a challenge, which a
                # browser is expected to pass (Cloudflare's comes with a 403).
                error_html = await _content(page)
                seen = access_challenge(error_html) if error_html is not None else None
                if error_html is not None and seen is None:
                    raise PageRenderError("http_error", status=status, retryable=status == 429 or status >= 500)

            await _settle(page, timeout_seconds=RENDER_SETTLE_TIMEOUT_SECONDS)
            settled_html = await _content(page)
            settled_kind = access_challenge(settled_html) if settled_html is not None else None
            seen = seen or settled_kind
            challenge: Optional[str] = None
            if settled_html is None or settled_kind is not None:
                challenge = await _wait_out_challenge(page, first_kind=settled_kind or seen)
            if navigation_statuses:
                status = navigation_statuses[-1]
            if challenge is None and status is not None and status >= 400:
                raise PageRenderError("http_error", status=status, retryable=status == 429 or status >= 500)

            if challenge is None:
                # Lazy sections load as they come into view.
                for _ in range(6):
                    await page.mouse.wheel(0, 2500)
                    await page.wait_for_timeout(300)
                await _settle(page, timeout_seconds=3)
                html = await page.content()
                media_urls = await page.evaluate(_DOM_MEDIA_SCRIPT)
                frame_urls = [frame.url for frame in page.frames if frame.url and frame.url != "about:blank"]
            else:
                # The vendor's page: nothing in it is worth a scroll or a video.
                html = await _content(page) or ""
                media_urls, frame_urls = [], []
            final_url = page.url
            if pending:
                await asyncio.wait(pending, timeout=5)
        finally:
            await browser.close()

    log_event(
        logger,
        logging.INFO,
        "external_call.succeeded",
        "Web page rendered",
        provider="chromium",
        status=status,
        html_bytes=len(html),
        frame_count=len(frame_urls),
        json_response_count=len(json_payloads),
        access_challenge=challenge,
        challenge_cleared=seen is not None and challenge is None,
    )
    return RenderedPage(
        html=html,
        final_url=final_url,
        status=status,
        frame_urls=frame_urls,
        media_urls=[value for value in media_urls if isinstance(value, str)],
        json_payloads=json_payloads,
        access_challenge=challenge,
    )
