"""What a web page holds beyond its static HTML: script-rendered text and videos.

Three pure pieces, shared by the API (which decides) and the render worker (which
does the work):

- :func:`inspect_static_html` reads the HTML the API already downloaded and says
  whether the page has to be rendered in a browser: either its text is drawn by
  JavaScript (the served HTML is an application shell), or it embeds videos whose
  words belong to the page. It costs nothing -- no request, no browser.
- :func:`video_from_url` and :func:`videos_in_json` recognise a video from what a
  page exposes: an embed URL in its DOM, or a ``{provider, id}`` pair in the JSON
  its scripts load. The second is what makes the detection general rather than
  per-site: a click-to-play gallery has no iframe until it is clicked, but the
  data it was built from is on the wire (Welcome to the Jungle sends
  ``{"source": "vimeo", "external_reference": "1181846851"}``).
- :func:`compose_sections` writes the stored text: the page, then one section per
  transcribed video, each opened by a ``## [...]`` heading the readers recognise
  (``packages/core/src/media/transcriptSections.ts``). The heading stays readable
  as plain text, so the chat, the search and the artifacts know what came from the
  page and what was said in a video.
"""

from __future__ import annotations

import html as html_lib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterable, List, Optional
from urllib.parse import parse_qs, urlsplit

#: Below this many words, the static extraction is not an article: it is a menu,
#: a cookie banner, a footer. Together with a shell marker it means "render me".
SHELL_MAX_EXTRACTED_WORDS = 150
#: Visible characters per byte of HTML under which a page is mostly script. A
#: server-rendered article sits well above 2 %; Welcome to the Jungle's company
#: page is 749 characters for 512 KB (0.15 %).
SHELL_MAX_TEXT_RATIO = 0.01

#: Markers a client-rendered application leaves in the HTML it serves.
_SHELL_MARKERS = (
    ("next_flight", re.compile(r"self\.__next_f\b")),
    ("next_data", re.compile(r"__NEXT_DATA__")),
    ("nuxt", re.compile(r"__NUXT__|data-n-head")),
    ("initial_state", re.compile(r"window\.__(?:INITIAL|PRELOADED|APOLLO)_STATE__")),
    ("angular", re.compile(r"\bng-version=")),
    ("empty_root", re.compile(r"<div[^>]+id=[\"'](?:root|app|__next|__nuxt)[\"'][^>]*>\s*</div>", re.I)),
    ("noscript_required", re.compile(r"<noscript[^>]*>[^<]{0,200}(?:enable|activer|activez)\s+javascript", re.I)),
)

_SCRIPT_STYLE_RE = re.compile(r"<(script|style|noscript|template|svg)\b.*?</\1\s*>", re.I | re.S)
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class EmbeddedVideo:
    """One video a page carries, identified well enough for yt-dlp to fetch it."""

    provider: str
    video_id: str
    url: str
    title: Optional[str] = None

    @property
    def key(self) -> str:
        return f"{self.provider}:{self.video_id}"


@dataclass
class PageSignals:
    """What the static HTML says about the page."""

    render_reasons: List[str] = field(default_factory=list)
    videos: List[EmbeddedVideo] = field(default_factory=list)

    @property
    def needs_render(self) -> bool:
        """Render in a browser: the text is script-drawn, or videos are embedded."""
        return bool(self.render_reasons) or bool(self.videos)

    def as_metadata(self) -> dict:
        return {
            "render_reasons": list(self.render_reasons),
            "static_video_count": len(self.videos),
        }


def visible_text(html: str) -> str:
    """The text a browser would show for this HTML, scripts left out."""
    stripped = _SCRIPT_STYLE_RE.sub(" ", html or "")
    stripped = _TAG_RE.sub(" ", stripped)
    return _SPACE_RE.sub(" ", html_lib.unescape(stripped)).strip()


def inspect_static_html(html: str, *, extracted_text: str) -> PageSignals:
    """Decide from the served HTML whether the page needs a browser.

    A shell is a page whose static extraction is thin *and* which shows why: a
    framework marker, or almost no visible text for its weight. Thin alone is not
    enough -- a short static page is just short -- and a marker alone is not
    either: plenty of server-rendered Next.js articles carry ``self.__next_f`` and
    read perfectly without a browser.
    """
    signals = PageSignals()
    html = html or ""
    words = len((extracted_text or "").split())
    if words < SHELL_MAX_EXTRACTED_WORDS:
        markers = [name for name, pattern in _SHELL_MARKERS if pattern.search(html)]
        ratio = len(visible_text(html)) / max(1, len(html))
        if markers:
            signals.render_reasons.extend(f"shell_marker:{name}" for name in markers)
        if ratio < SHELL_MAX_TEXT_RATIO:
            signals.render_reasons.append("low_text_ratio")
    signals.videos = videos_in_html(html)
    return signals


# ---------------------------------------------------------------------------
# Recognising a video
# ---------------------------------------------------------------------------

_YOUTUBE_ID = r"[A-Za-z0-9_-]{11}"
_URL_PATTERNS = (
    (
        "youtube",
        re.compile(
            r"(?:youtube(?:-nocookie)?\.com/(?:embed/|shorts/|live/|v/|watch\?(?:[^\"'\s]*&)?v=)"
            rf"|youtu\.be/)({_YOUTUBE_ID})"
        ),
    ),
    (
        "vimeo",
        re.compile(
            r"(?:player\.vimeo\.com/video/"
            r"|vimeo\.com/(?:video/|channels/[^/\s\"']+/|groups/[^/\s\"']+/videos/)?)(\d{6,12})"
        ),
    ),
    (
        "dailymotion",
        re.compile(
            r"(?:dailymotion\.com/(?:embed/)?video/|dai\.ly/"
            r"|geo\.dailymotion\.com/player[^\"'\s]*[?&]video=)([a-zA-Z0-9]{5,10})"
        ),
    ),
    (
        "wistia",
        re.compile(
            r"(?:fast\.wistia\.(?:net|com)/embed/(?:iframe|medias)/|wistia\.com/medias/|wistia_async_)"
            r"([a-z0-9]{8,12})"
        ),
    ),
    ("loom", re.compile(r"loom\.com/(?:share|embed)/([a-f0-9]{32})")),
)
_DIRECT_MEDIA_RE = re.compile(r"\.(?:mp4|m4v|webm|mov|m3u8|mp3|m4a)(?:$|[?#])", re.I)


def canonical_video_url(provider: str, video_id: str) -> str:
    """The URL yt-dlp is given for a provider's video."""
    return {
        "youtube": f"https://www.youtube.com/watch?v={video_id}",
        "vimeo": f"https://player.vimeo.com/video/{video_id}",
        "dailymotion": f"https://www.dailymotion.com/video/{video_id}",
        "wistia": f"https://fast.wistia.net/embed/iframe/{video_id}",
        "loom": f"https://www.loom.com/share/{video_id}",
    }.get(provider, video_id)


def video_from_url(url: str, *, title: Optional[str] = None) -> Optional[EmbeddedVideo]:
    """The video an embed, page or file URL points at, or ``None``."""
    value = html_lib.unescape((url or "").strip())
    if not value:
        return None
    if value.startswith("//"):
        value = "https:" + value
    for provider, pattern in _URL_PATTERNS:
        match = pattern.search(value)
        if match:
            video_id = match.group(1)
            return EmbeddedVideo(provider, video_id, canonical_video_url(provider, video_id), title)
    parts = urlsplit(value)
    if parts.scheme in ("http", "https") and _DIRECT_MEDIA_RE.search(parts.path + ("?" if parts.query else "")):
        return EmbeddedVideo("file", value, value, title)
    # A player page that names its file in the query (?file=, ?src=, ?url=).
    for key in ("file", "src", "url", "video"):
        for candidate in parse_qs(parts.query).get(key, []):
            if _DIRECT_MEDIA_RE.search(candidate):
                return EmbeddedVideo("file", candidate, candidate, title)
    return None


_IFRAME_SRC_RE = re.compile(r"<(?:iframe|embed)\b[^>]*?\b(?:data-)?src=[\"']([^\"']+)[\"']", re.I)
_VIDEO_SRC_RE = re.compile(r"<(?:video|source)\b[^>]*?\bsrc=[\"']([^\"']+)[\"']", re.I)
_OG_VIDEO_RE = re.compile(r"<meta[^>]+property=[\"']og:video(?::(?:secure_)?url)?[\"'][^>]+content=[\"']([^\"']+)[\"']", re.I)
_JSON_LD_RE = re.compile(r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", re.I | re.S)


def videos_in_html(html: str) -> List[EmbeddedVideo]:
    """Videos the HTML itself names: iframes, ``<video>``, ``og:video``, JSON-LD."""
    found: List[EmbeddedVideo] = []
    for pattern in (_IFRAME_SRC_RE, _VIDEO_SRC_RE, _OG_VIDEO_RE):
        for match in pattern.finditer(html or ""):
            video = video_from_url(match.group(1))
            if video:
                found.append(video)
    for match in _JSON_LD_RE.finditer(html or ""):
        try:
            found.extend(videos_in_json(json.loads(match.group(1).strip())))
        except ValueError:
            continue
    return dedupe_videos(found)


#: Keys under which a JSON object names its video provider, and its id.
_PROVIDER_KEYS = ("provider", "source", "platform", "host", "type", "kind", "service", "video_provider", "videoProvider")
_ID_KEYS = (
    "external_reference", "externalReference", "external_id", "externalId",
    "video_id", "videoId", "provider_id", "providerId", "reference", "id",
)
_TITLE_KEYS = ("title", "name", "headline", "caption")
_URL_KEYS = ("embedUrl", "embed_url", "contentUrl", "content_url", "url", "src", "video_url", "videoUrl", "player_url", "playerUrl")
_KNOWN_PROVIDERS = {"youtube", "vimeo", "dailymotion", "wistia", "loom"}


def _title_of(obj: dict) -> Optional[str]:
    for key in _TITLE_KEYS:
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:200]
    return None


def videos_in_json(payload: Any, *, max_nodes: int = 50_000) -> List[EmbeddedVideo]:
    """Videos a JSON document describes, wherever they sit in it.

    Two shapes are recognised, both common to the CMS payloads single-page
    applications load: an object holding a URL of a known player (``embedUrl``,
    ``contentUrl``...), and an object naming a provider and an id
    (``{"source": "vimeo", "external_reference": "1181846851"}``). The title is
    taken from the same object or from its parent, where galleries keep it.
    """
    found: List[EmbeddedVideo] = []
    stack: List[tuple[Any, Optional[str]]] = [(payload, None)]
    visited = 0
    while stack and visited < max_nodes:
        node, parent_title = stack.pop()
        visited += 1
        if isinstance(node, dict):
            title = _title_of(node) or parent_title
            provider = next(
                (
                    str(node[key]).strip().lower()
                    for key in _PROVIDER_KEYS
                    if isinstance(node.get(key), str) and str(node[key]).strip().lower() in _KNOWN_PROVIDERS
                ),
                None,
            )
            if provider:
                for key in _ID_KEYS:
                    raw = node.get(key)
                    if isinstance(raw, (str, int)) and str(raw).strip():
                        video = video_from_url(canonical_video_url(provider, str(raw).strip()), title=title)
                        if video:
                            found.append(video)
                            break
            for key in _URL_KEYS:
                raw = node.get(key)
                if isinstance(raw, str):
                    video = video_from_url(raw, title=title)
                    if video:
                        found.append(video)
            for value in node.values():
                if isinstance(value, (dict, list)):
                    stack.append((value, title))
        elif isinstance(node, list):
            stack.extend((item, parent_title) for item in reversed(node) if isinstance(item, (dict, list)))
    return dedupe_videos(found)


def dedupe_videos(videos: Iterable[EmbeddedVideo]) -> List[EmbeddedVideo]:
    """First occurrence of each video, in page order, keeping a title if any copy has one."""
    by_key: dict[str, EmbeddedVideo] = {}
    order: List[str] = []
    for video in videos:
        current = by_key.get(video.key)
        if current is None:
            by_key[video.key] = video
            order.append(video.key)
        elif not current.title and video.title:
            by_key[video.key] = EmbeddedVideo(current.provider, current.video_id, current.url, video.title)
    return [by_key[key] for key in order]


# ---------------------------------------------------------------------------
# The stored text
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class VideoSection:
    title: Optional[str]
    text: str
    duration_seconds: Optional[float] = None
    provider: Optional[str] = None
    thumbnail_url: Optional[str] = None


def _clock(seconds: Optional[float]) -> Optional[str]:
    if not seconds or seconds <= 0:
        return None
    total = int(round(seconds))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"


def _heading_text(value: Optional[str]) -> str:
    """A title on one line, with nothing a heading parser could misread."""
    return _SPACE_RE.sub(" ", (value or "").replace("]", ")").replace("[", "(")).strip()


def compose_sections(*, page_title: Optional[str], page_text: str, videos: List[VideoSection]) -> str:
    """The page and its videos as one Markdown text, a ``## [...]`` heading per part.

    ``## [page] <title>`` opens the page's text; ``## [video 2/3 · 1:14 · vimeo ·
    <thumbnail>] <title>`` opens each video's transcript. A video whose transcript
    came back empty is left out, and the numbering counts only the ones kept. The
    tag in brackets is never translated (the translation prompt keeps it as-is),
    which is what lets the readers recognise a translated text too.
    """
    kept = [video for video in videos if (video.text or "").strip()]
    blocks: List[str] = []
    if (page_text or "").strip():
        blocks.append(f"## [page] {_heading_text(page_title)}".rstrip())
        blocks.append(page_text.strip())
    for index, video in enumerate(kept, start=1):
        tag = [f"video {index}/{len(kept)}"]
        clock = _clock(video.duration_seconds)
        if clock:
            tag.append(clock)
        if video.provider and video.provider != "file":
            tag.append(video.provider)
        thumbnail = (video.thumbnail_url or "").strip()
        if thumbnail.startswith("https://") and " " not in thumbnail and "]" not in thumbnail:
            tag.append(thumbnail)
        blocks.append(f"## [{' · '.join(tag)}] {_heading_text(video.title)}".rstrip())
        blocks.append(video.text.strip())
    return "\n\n".join(blocks).strip() + "\n"
