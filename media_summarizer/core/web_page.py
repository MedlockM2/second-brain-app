"""What a web page holds beyond its static HTML: script-rendered text and videos.

Four pure pieces, shared by the API (which decides) and the render worker (which
does the work):

- :func:`inspect_static_html` reads the HTML the API already downloaded and says
  whether the page has to be rendered in a browser: either its text is drawn by
  JavaScript (the served HTML is an application shell), or it embeds videos whose
  words belong to the page, or an anti-bot edge served its challenge in place of
  the page. It costs nothing -- no request, no browser.
- :func:`access_challenge` recognises that challenge, or the block page that
  follows it, from what every vendor's interstitial shares: a sentence or two
  instead of a page, asking the reader to prove it is a person. Its words are
  never stored: the static path hands the page to the browser, and a browser that
  is still shown the challenge fails the job as ``SOURCE_ACCESS_BLOCKED``.
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

#: Markers a client-rendered application leaves in the HTML it serves. The fallback
#: a page shows without JavaScript (``noscript_required``) is read from the text of
#: its ``<noscript>`` blocks (:func:`inspect_static_html`), not with a pattern here:
#: that text sits in nested markup, often after an inline image.
_SHELL_MARKERS = (
    ("next_flight", re.compile(r"self\.__next_f\b")),
    ("next_data", re.compile(r"__NEXT_DATA__")),
    ("nuxt", re.compile(r"__NUXT__|data-n-head")),
    ("initial_state", re.compile(r"window\.__(?:INITIAL|PRELOADED|APOLLO)_STATE__")),
    ("angular", re.compile(r"\bng-version=")),
    ("empty_root", re.compile(r"<div[^>]+id=[\"'](?:root|app|__next|__nuxt)[\"'][^>]*>\s*</div>", re.I)),
)

_SCRIPT_STYLE_RE = re.compile(r"<(script|style|noscript|template|svg)\b.*?</\1\s*>", re.I | re.S)
_NOSCRIPT_RE = re.compile(r"<noscript\b[^>]*>(.*?)</noscript\s*>", re.I | re.S)
_TITLE_RE = re.compile(r"<title\b[^>]*>(.*?)</title\s*>", re.I | re.S)
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")

#: A sentence asking the reader to turn JavaScript on, in the languages the
#: publishers we read write in. It is what a page shows a reader without scripts
#: (a ``<noscript>`` fallback), never what the page says.
_JS_REQUIRED_RE = re.compile(
    r"\b(?:enable|activate|turn\s+on|activer|activez|aktivieren\s+sie|habilit(?:a|ar|e)|activ(?:a|ar)"
    r"|abilit(?:a|are)|ative|schakel)\s+(?:(?:the|your|votre|le|o|el|il|uw)\s+)?javascript\b"
    r"|\bjavascript\s+(?:is|est|ist|está|è|wurde)\s+(?:currently\s+|actuellement\s+)?"
    r"(?:disabled|turned\s+off|required|désactivé|requis|nécessaire|deaktiviert|erforderlich"
    r"|desactivado|desativado|disabilitato|necessario|uitgeschakeld)"
    r"|\bjavascript\s+(?:must\s+be\s+enabled|aktivieren|inschakelen)\b"
    r"|\b(?:requires?|needs?|nécessite|benötigt|richiede|requiere)\s+javascript\b",
    re.I,
)

#: Above this many visible words a page is not an interstitial, whatever it says:
#: a challenge or a block page is a sentence or two and a vendor's footer (the
#: wordiest seen, a bilingual block page, is about 110), while an article page,
#: menus and footer included, is several hundred.
CHALLENGE_MAX_VISIBLE_WORDS = 200

#: The title an interstitial carries, at the start of ``<title>`` (``Access
#: Denied | Example``). Every vendor localises a few of them.
_CHALLENGE_TITLE_RE = re.compile(
    r"^\s*(?:client\s+challenge|just\s+a\s+moment|one\s+moment,?\s+please|attention\s+required"
    r"|access\s+denied|access\s+to\s+this\s+page\s+has\s+been\s+denied|are\s+you\s+a\s+(?:robot|human)"
    r"|robot\s+check|security\s+check|bot\s+(?:check|verification|detection)|human\s+verification"
    r"|verify(?:ing)?\s+(?:that\s+)?(?:you\s+are\s+)?(?:a\s+)?human|please\s+wait|one\s+more\s+step"
    r"|pardon\s+our\s+interruption|request\s+(?:rejected|blocked)|checking\s+your\s+browser|ddos-guard"
    r"|captcha|un\s+instant|accès\s+(?:refusé|restreint|interdit|bloqué)|vérification\s+(?:de\s+sécurité|en\s+cours)"
    r"|einen\s+moment|zugriff\s+verweigert|un\s+momento|acceso\s+denegado|accesso\s+negato|een\s+moment)\b",
    re.I,
)

#: What an interstitial asks of its reader, anywhere in its visible text.
_CHALLENGE_TEXT_RE = re.compile(
    r"\bverify(?:ing)?\s+(?:that\s+)?you\s+are\s+(?:a\s+)?human"
    r"|\bconfirm\s+(?:that\s+)?you\s+are\s+(?:a\s+)?human"
    r"|\bnot\s+a\s+robot\b|\bare\s+you\s+(?:a\s+)?(?:robot|human)\b"
    r"|\bchecking\s+(?:your\s+browser|if\s+the\s+site\s+connection\s+is\s+secure)"
    r"|\bsecurity\s+of\s+your\s+connection\b|\bpress\s+(?:&|and)\s+hold\b|\bunusual\s+traffic\b"
    r"|\b(?:identified|detected|flagged)\s+as\s+(?:automated|a\s+bot|bot)\b"
    r"|\bautomated\s+(?:\(bot\)|bot|traffic|queries|requests|access)\b"
    r"|\byou\s+(?:have\s+been|were|are)\s+blocked\b|\baccess\s+to\s+this\s+page\s+has\s+been\s+denied\b"
    r"|\byou\s+don['’]t\s+have\s+permission\s+to\s+access\b|\brequest\s+(?:was\s+|has\s+been\s+)?blocked\b"
    r"|\bdisable\s+(?:any\s+|your\s+)?ad[\s-]?blockers?\b|\bhuman\s+verification\b"
    r"|\bbot\s+(?:verification|detection|protection)\b|\bddos\s+protection\b"
    r"|\bvérifi\w*\s+que\s+vous\s+(?:êtes|etes)\s+(?:un\s+)?humain|\bpas\s+un\s+robot\b"
    r"|\b(?:identifié|détecté)\s+comme\s+(?:automatisé|un\s+robot|robot|bot)\b"
    r"|\btrafic\s+(?:\w+\s+){0,3}automatisé|\bdésactivez\s+(?:vos\s+|votre\s+)?bloqueurs?\s+de\s+publicité"
    r"|\bkein\s+roboter\b|\bungewöhnlichen?\s+datenverkehr|\bno\s+(?:eres|soy)\s+un\s+robot\b"
    r"|\btráfico\s+inusual\b|\bnon\s+sei\s+un\s+robot\b|\btraffico\s+insolito\b",
    re.I,
)

#: What a vendor's interstitial carries and its protected pages do not -- the
#: scripts its edge injects into every page (Cloudflare's ``jsd``, Imperva's
#: ``_Incapsula_Resource``, DataDome's ``tags.js``) are deliberately absent. These
#: name the vendor, never the site: any site behind it serves the same markup.
_CHALLENGE_MARKERS = (
    ("cloudflare", re.compile(r"_cf_chl_opt|/cdn-cgi/challenge-platform/h/[a-z]/orchestrate/")),
    ("datadome", re.compile(r"captcha-delivery\.com")),
    ("human", re.compile(r"id=[\"']px-captcha")),
    ("akamai", re.compile(r"/_sec/cp_challenge/|\bbm-verify\b")),
    ("aws_waf", re.compile(r"\bgokuProps\b")),
    ("imperva", re.compile(r"Incapsula\s+incident\s+ID", re.I)),
    ("sucuri", re.compile(r"sucuri_cloudproxy_js")),
    ("captcha_widget", re.compile(r"class=[\"'][^\"']*\b(?:g-recaptcha|h-captcha|cf-turnstile|frc-captcha)\b")),
)


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
    #: The kind of anti-bot interstitial served in place of the page
    #: (:func:`access_challenge`), or ``None``. Its text is not the page's.
    access_challenge: Optional[str] = None

    @property
    def needs_render(self) -> bool:
        """Render in a browser: the text is script-drawn, videos are embedded, or a challenge stands in the way."""
        return bool(self.render_reasons) or bool(self.videos)

    def as_metadata(self) -> dict:
        return {
            "render_reasons": list(self.render_reasons),
            "static_video_count": len(self.videos),
            "access_challenge": self.access_challenge,
        }


def visible_text(html: str) -> str:
    """The text a browser would show for this HTML, scripts left out."""
    stripped = _SCRIPT_STYLE_RE.sub(" ", html or "")
    stripped = _TAG_RE.sub(" ", stripped)
    return _SPACE_RE.sub(" ", html_lib.unescape(stripped)).strip()


def _markup_text(fragment: str) -> str:
    return _SPACE_RE.sub(" ", html_lib.unescape(_TAG_RE.sub(" ", fragment or ""))).strip()


def noscript_text(html: str) -> str:
    """What the page shows a reader whose browser runs no script."""
    return " ".join(_markup_text(block) for block in _NOSCRIPT_RE.findall(html or "")).strip()


def without_javascript_prompts(html: str) -> str:
    """The HTML without its ``<noscript>`` blocks that ask for JavaScript.

    Such a block is the page telling a script-less reader it cannot show itself
    ("JavaScript is disabled in your browser"), never something the page says.
    The text extractor reads ``<noscript>`` like any other markup, so left in, that
    sentence is what an application shell or an anti-bot challenge is stored as.
    A ``<noscript>`` holding anything else (a tracking pixel, a text copy of the
    page) is kept.
    """
    return _NOSCRIPT_RE.sub(
        lambda match: " " if _JS_REQUIRED_RE.search(_markup_text(match.group(1))) else match.group(0),
        html or "",
    )


def page_title(html: str) -> str:
    """The text of the HTML's ``<title>``, or an empty string."""
    match = _TITLE_RE.search(html or "")
    return _markup_text(match.group(1)) if match else ""


def access_challenge(html: str) -> Optional[str]:
    """The kind of anti-bot interstitial this HTML is, or ``None`` for a page.

    An anti-bot edge (Fastly, Cloudflare, Akamai, DataDome, HUMAN, AWS WAF...)
    answers a client it does not trust with a challenge page -- often with a 200,
    so nothing in the HTTP answer gives it away -- and, when the challenge fails,
    with a block page. Both are recognised by their shape, never by the site they
    stand in front of: at most :data:`CHALLENGE_MAX_VISIBLE_WORDS` visible words,
    *and* one of a vendor's interstitial markers, a challenge title (``Client
    Challenge``, ``Just a moment...``, ``Access Denied``), a sentence asking the
    reader to prove it is a person or to turn off its ad blocker, or a visible
    plea to enable JavaScript. A page that shows that plea to a browser running
    scripts has refused to draw itself for it.

    The word ceiling is what keeps an article that *mentions* a captcha, or embeds
    one in its comment form, from ever reading as a challenge.
    """
    html = html or ""
    text = visible_text(html)
    if len(text.split()) > CHALLENGE_MAX_VISIBLE_WORDS:
        return None
    for name, pattern in _CHALLENGE_MARKERS:
        if pattern.search(html):
            return name
    if _CHALLENGE_TITLE_RE.search(page_title(html)):
        return "challenge_title"
    if _CHALLENGE_TEXT_RE.search(text):
        return "challenge_text"
    if _JS_REQUIRED_RE.search(text):
        return "javascript_required"
    return None


def inspect_static_html(html: str, *, extracted_text: str) -> PageSignals:
    """Decide from the served HTML whether the page needs a browser.

    A shell is a page whose static extraction is thin *and* which shows why: a
    framework marker, a ``<noscript>`` fallback asking for JavaScript, or almost
    no visible text for its weight. Thin alone is not enough -- a short static page
    is just short -- and a marker alone is not either: plenty of server-rendered
    Next.js articles carry ``self.__next_f`` and read perfectly without a browser.

    An anti-bot challenge (:func:`access_challenge`) goes to the browser too: a
    JavaScript challenge is built to be passed by one, and its own words are not
    the page's (the caller drops them).
    """
    signals = PageSignals()
    html = html or ""
    words = len((extracted_text or "").split())
    if words < SHELL_MAX_EXTRACTED_WORDS:
        markers = [name for name, pattern in _SHELL_MARKERS if pattern.search(html)]
        if _JS_REQUIRED_RE.search(noscript_text(html)):
            markers.append("noscript_required")
        ratio = len(visible_text(html)) / max(1, len(html))
        if markers:
            signals.render_reasons.extend(f"shell_marker:{name}" for name in markers)
        if ratio < SHELL_MAX_TEXT_RATIO:
            signals.render_reasons.append("low_text_ratio")
    challenge = access_challenge(html)
    if challenge:
        signals.access_challenge = challenge
        signals.render_reasons.append(f"access_challenge:{challenge}")
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
