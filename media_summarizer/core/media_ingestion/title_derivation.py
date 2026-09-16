"""Single, server-side rule for the title of an ingested media (task-266).

Implements the derivation the owner retained at the end of task-265
(`docs/research/task-265-media-title-derivation/README.md`, `Decision`):
**approach A -- per-source metadata plumbing**, with no model call anywhere.
Each producer reads the title its provider already returns, passes it through
the deterministic distrust rules below, and falls back to a platform label plus
the save date when nothing survives.

Three refinements the owner spelled out, all handled here:

* **Instagram** has no platform title at all (the Apify scraper exposes only
  `caption`/`ownerFullName`, and yt-dlp's `title` is the placeholder
  ``Video by <user>``), so the beginning of the description is the title --
  never the account name.
* **Photos** (camera capture or library pick) use their metadata title when the
  parser surfaces one, else the ``photo`` label plus the upload date.
* **Imported files** take their title from the document metadata, the cleaned
  filename being only the next candidate.

The last-resort label is **not a string** (task-400). A media whose metadata
yields nothing is stored with a *label key* and its save date, and the app draws
``<label> — <date>`` from its own i18n catalogues in the reader's language with a
locale-formatted date. Building the sentence here would hardcode English and a
C-locale date into the library row, which is exactly what a TestFlight tester on
fr-FR reported seeing ("Article — 10 Sep 2026").

Everything in this module is pure: no I/O, no provider call, no LLM. The
rejection rules are the closed list of *provable* rejections of the benchmark
(§6.1); quality scoring, semantic checks and length heuristics are deliberately
absent because they are guesswork (§6.2).
"""

from __future__ import annotations

import re
from typing import Iterable, NamedTuple, Optional, Sequence
from urllib.parse import unquote, urlsplit

MAX_TITLE_LENGTH = 120

# Extensions of everything the pipeline accepts as an upload. Kept in sync with
# `DocumentFormat.supported_extensions()` plus the audio container list of
# `api/endpoints/media.py`.
_FILE_EXTENSIONS = (
    "pdf",
    "docx",
    "doc",
    "pptx",
    "ppt",
    "xlsx",
    "xls",
    "txt",
    "md",
    "rtf",
    "jpg",
    "jpeg",
    "png",
    "tif",
    "tiff",
    "bmp",
    "heic",
    "heif",
    "webp",
    "gif",
    "mp3",
    "m4a",
    "mp4",
    "aac",
    "ogg",
    "oga",
    "wav",
    "flac",
    "opus",
    "webm",
)

_IMAGE_EXTENSIONS = frozenset(
    {"jpg", "jpeg", "png", "tif", "tiff", "bmp", "heic", "heif", "webp", "gif"}
)

_EXTENSION_RE = re.compile(
    r"\.(" + "|".join(_FILE_EXTENSIONS) + r")$",
    re.IGNORECASE,
)

# Our own sentinel shape, `<source_platform>:<media_type>`. We generated it, so
# recognising it is exact rather than a heuristic.
_SENTINEL_RE = re.compile(r"^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$")

# Placeholders emitted by the providers themselves, readable in the installed
# yt-dlp extractors (`instagram.py`, `tiktok.py`).
_PROVIDER_PLACEHOLDER_RES = (
    re.compile(r"^(video|photo|post|reel|story|clip)\s+by\s+.+$", re.IGNORECASE),
    re.compile(r"^video\s*#?\d+$", re.IGNORECASE),
    re.compile(r"^tiktok\s+video\s*#?\d+$", re.IGNORECASE),
    re.compile(r"^instagram\s+(reel|post|video)$", re.IGNORECASE),
)

# Camera / OS / messaging naming conventions, plus `photo-<epoch>` which our own
# mobile local-import helper fabricates.
_DEVICE_NAME_RES = (
    re.compile(
        r"^(img|dsc|dscn|dscf|pxl|mvimg|gopr|screenshot|screen shot|photo|foto|"
        r"image|scan|ptt|aud|rec|recording|whatsapp|signal|telegram|video)"
        r"[-_ ]*\d",
        re.IGNORECASE,
    ),
    re.compile(r"^\d{8}[-_ ]?\d{4,6}$"),
    re.compile(r"^photo[-_ ]?\d{10,}$", re.IGNORECASE),
    re.compile(r"^[0-9a-f]{16,}$", re.IGNORECASE),
    re.compile(r"^\d{6,}$"),
)

_GENERIC_PLACEHOLDERS = frozenset(
    {
        "untitled",
        "untitled document",
        "document",
        "documents",
        "file",
        "new document",
        "audio",
        "audio file",
        "recording",
        "voice message",
        "voice note",
        "image",
        "images",
        "photo",
        "photos",
        "picture",
        "video",
        "unknown",
        "none",
        "null",
    }
)

# Trailing site branding trafilatura and most CMS templates append to the
# `<title>` tag: "The real headline | Le Monde", "The real headline - The Verge".
_TRAILING_SITE_RE = re.compile(r"\s+[|–—·•]\s+[^|–—·•]{1,40}$")

_WHITESPACE_RE = re.compile(r"\s+")
_SEPARATOR_RE = re.compile(r"[_+]+")
_MULTI_DASH_RE = re.compile(r"\s*-\s*")
_SENTENCE_END_RE = re.compile(r"(?<=[.!?…])\s")
_TRAILING_HASHTAGS_RE = re.compile(r"(?:\s+[#@][^\s#@]+)+\s*$")
_LEADING_HASHTAGS_RE = re.compile(r"^(?:[#@][^\s#@]+\s+)+")
_ONLY_PUNCTUATION_RE = re.compile(r"^[\W_]+$", re.UNICODE)

# Last-resort label *keys* (benchmark §9.2, made translatable by task-400).
#
# These are wire values: they are written to the library row, travel in every
# media contract the app reads, and are mapped to a catalogue entry client-side
# (`mobile/src/lib/mediaTitle.ts`). Renaming one is a contract change: a build
# that does not know a key reads it as "Saved item", so the rename would silently
# unlabel every row it touched.
#
# Keyed by media type first because that is what the user sees in the Inbox
# badge, then specialised by platform where the platform name is the more
# informative half.
_MEDIA_TYPE_LABEL_KEYS = {
    "youtube_video": "youtube_video",
    "podcast_episode": "podcast_episode",
    "article": "article",
    "short_video": "video",
    "image_post": "image_post",
    "audio_file": "audio_note",
    "audio": "audio_note",
    "shared_text": "shared_note",
    "document": "document",
    "photo": "photo",
    "image": "photo",
}

_PLATFORM_LABEL_KEYS = {
    ("short_video", "instagram"): "instagram_video",
    ("short_video", "tiktok"): "tiktok_video",
    ("image_post", "instagram"): "instagram_post",
    ("article", "x"): "x_post",
    ("article", "rss"): "article",
    # A voice note is the only thing WhatsApp still labels: since task-380 a
    # shared text is attributed to the notes source, and
    # `_MEDIA_TYPE_LABEL_KEYS` already labels `shared_text` for every platform.
    ("audio_file", "whatsapp"): "voice_note",
}

_DEFAULT_LABEL_KEY = "saved_item"

# The closed set the app must hold a translation for. Exported so a reader of
# either side can check the two lists against each other.
TITLE_LABEL_KEYS = frozenset(
    set(_MEDIA_TYPE_LABEL_KEYS.values())
    | set(_PLATFORM_LABEL_KEYS.values())
    | {_DEFAULT_LABEL_KEY}
)


class DerivedTitle(NamedTuple):
    """What a save stores for its title: one of the two fields, never both.

    ``title`` is a real, human-readable title that survived the rejection rules.
    ``label_key`` is set instead when nothing did, and the app renders
    ``<label> — <save date>`` from it. Both null is impossible: a save always
    gets one or the other.
    """

    title: Optional[str]
    label_key: Optional[str]


def _normalize_for_comparison(value: str) -> str:
    """Lowercased, punctuation-free form used by the equality rejection rules."""
    collapsed = _WHITESPACE_RE.sub(" ", value.strip().lower())
    return re.sub(r"[^\w\s]", "", collapsed, flags=re.UNICODE).strip()


def _truncate_on_word_boundary(value: str, limit: int = MAX_TITLE_LENGTH) -> str:
    if len(value) <= limit:
        return value
    head = value[:limit].rstrip()
    cut = head.rfind(" ")
    if cut >= limit // 2:
        head = head[:cut].rstrip()
    return head.rstrip(" ,;:-–—")


def normalize_title_candidate(
    raw: Optional[str],
    *,
    from_file_name: bool = False,
) -> Optional[str]:
    """Clean one raw candidate, or return ``None`` when nothing usable remains.

    ``from_file_name`` additionally percent-decodes the value, drops the
    extension and turns the `_`/`+` separators of a filename into spaces --
    mobile builds upload names straight out of a URI path segment, so
    ``Grant%20Deed_Security.pdf`` must read ``Grant Deed Security``.
    """
    if not isinstance(raw, str):
        return None

    value = raw.strip()
    if not value:
        return None

    if from_file_name:
        value = unquote(value)
        value = _EXTENSION_RE.sub("", value).strip()
        value = _SEPARATOR_RE.sub(" ", value)
        value = _MULTI_DASH_RE.sub(" ", value)

    value = _WHITESPACE_RE.sub(" ", value).strip()
    if not value:
        return None

    stripped = _TRAILING_SITE_RE.sub("", value).strip()
    if len(stripped) >= 12:
        # Only drop the branding suffix when a real headline is left behind:
        # "Le Monde | Actualités" must not collapse to "Le Monde".
        value = stripped

    if _ONLY_PUNCTUATION_RE.match(value):
        return None

    value = _truncate_on_word_boundary(value)
    return value or None


def is_rejected_title(
    candidate: str,
    *,
    authors: Iterable[Optional[str]] = (),
    site_names: Iterable[Optional[str]] = (),
) -> bool:
    """Deterministic distrust rules (benchmark §6.1).

    Every rule is either a comparison against a value present in the same
    payload or a fixed pattern emitted by us or by a provider. Nothing here
    guesses at quality.
    """
    value = candidate.strip()
    if not value:
        return True

    if _SENTINEL_RE.match(value):
        return True

    normalized = _normalize_for_comparison(value)
    if not normalized:
        return True

    if normalized in _GENERIC_PLACEHOLDERS:
        return True

    for author in authors:
        if isinstance(author, str) and author.strip():
            if _normalize_for_comparison(author) == normalized:
                return True

    for site_name in site_names:
        if isinstance(site_name, str) and site_name.strip():
            site = site_name.strip()
            if site.lower().startswith(("http://", "https://")):
                site = urlsplit(site).hostname or site
            site = re.sub(r"^www\.", "", site, flags=re.IGNORECASE)
            if _normalize_for_comparison(site) == normalized:
                return True

    for pattern in _PROVIDER_PLACEHOLDER_RES:
        if pattern.match(value):
            return True

    if _EXTENSION_RE.search(value):
        # A bare filename is never a title as-is; the caller re-tests the
        # cleaned stem through `normalize_title_candidate(from_file_name=True)`.
        return True

    for pattern in _DEVICE_NAME_RES:
        if pattern.match(value):
            return True

    return False


def first_sentence(text: Optional[str]) -> Optional[str]:
    """Title-shaped head of a free-text body (caption, post, shared note).

    The rule X already implements (`x_ingestion_worker._build_titles`),
    generalised: first line or first sentence, hashtag/mention runs stripped,
    capped on a word boundary. Cutting on a boundary instead of a blind
    ``[:100]`` is what the benchmark asks for in §6.2.
    """
    if not isinstance(text, str):
        return None

    body = text.strip()
    if not body:
        return None

    for line in body.splitlines():
        candidate = line.strip()
        candidate = _LEADING_HASHTAGS_RE.sub("", candidate).strip()
        candidate = _TRAILING_HASHTAGS_RE.sub("", candidate).strip()
        if not candidate or _ONLY_PUNCTUATION_RE.match(candidate):
            continue
        sentence = _SENTENCE_END_RE.split(candidate, maxsplit=1)[0].strip()
        sentence = sentence or candidate
        sentence = _WHITESPACE_RE.sub(" ", sentence)
        # A full stop is a sentence boundary, not part of a title; `!` and `?`
        # are kept because they carry the author's tone.
        return _truncate_on_word_boundary(sentence).rstrip(" ,;:.…-–—") or None

    return None


def first_markdown_heading(markdown: Optional[str]) -> Optional[str]:
    """Document title as the parser rendered it.

    LlamaParse emits the document's own title as the leading ``#`` heading and
    Unstructured maps its ``Title`` elements to ``##``, so the first heading of
    the parsed markdown is the metadata title an imported file carries. Only the
    head of the document is scanned: a heading appearing after body text is a
    section, not the document's title.
    """
    if not isinstance(markdown, str) or not markdown.strip():
        return None

    for line in markdown.splitlines()[:40]:
        stripped = line.strip()
        if not stripped:
            continue
        match = re.match(r"^#{1,3}\s+(.*\S)\s*$", stripped)
        if match:
            return _truncate_on_word_boundary(
                _WHITESPACE_RE.sub(" ", match.group(1)).strip("#* ")
            ) or None
        # Body text before any heading: the file has no title heading.
        break

    return None


def title_label_key_for(
    *,
    media_type: Optional[str] = None,
    source_platform: Optional[str] = None,
) -> str:
    """Label key for a media, e.g. ``youtube_video``, ``photo``, ``saved_item``."""
    media = (media_type or "").strip().lower()
    platform = (source_platform or "").strip().lower()

    specialised = _PLATFORM_LABEL_KEYS.get((media, platform))
    if specialised:
        return specialised
    key = _MEDIA_TYPE_LABEL_KEYS.get(media)
    if key:
        return key
    if platform == "youtube":
        return "youtube_video"
    if platform == "instagram":
        return "instagram_video"
    if platform == "tiktok":
        return "tiktok_video"
    return _DEFAULT_LABEL_KEY


def title_label_key_for_file_name(file_name: Optional[str]) -> str:
    """``photo`` for an image upload, ``document`` for anything else.

    The upload path needs this because it files every import under
    ``media_type="document"``: an image picked from the library is a document row
    that must still read "Photo", which no ``media_type`` mapping can tell.
    """
    name = (file_name or "").strip().lower()
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    return "photo" if ext in _IMAGE_EXTENSIONS else "document"


def select_title(
    candidates: Sequence[Optional[str]],
    *,
    authors: Iterable[Optional[str]] = (),
    site_names: Iterable[Optional[str]] = (),
    file_name_candidates: Sequence[Optional[str]] = (),
) -> Optional[str]:
    """First candidate that survives the rejection rules, or ``None``.

    ``candidates`` are provider metadata titles in priority order.
    ``file_name_candidates`` are filenames, tried after them and cleaned as
    filenames (extension dropped, separators collapsed).

    Workers and resolvers use this rather than `derive_stored_title`: only the
    save that creates the library row decides the label key, so a producer that
    learns nothing new returns ``None`` and leaves the row alone.
    """
    for raw in candidates:
        normalized = normalize_title_candidate(raw)
        if normalized and not is_rejected_title(
            normalized, authors=authors, site_names=site_names
        ):
            return normalized

    for raw in file_name_candidates:
        normalized = normalize_title_candidate(raw, from_file_name=True)
        if normalized and not is_rejected_title(
            normalized, authors=authors, site_names=site_names
        ):
            return normalized

    return None


def derive_stored_title(
    candidates: Sequence[Optional[str]],
    *,
    media_type: Optional[str] = None,
    source_platform: Optional[str] = None,
    label_key: Optional[str] = None,
    authors: Iterable[Optional[str]] = (),
    site_names: Iterable[Optional[str]] = (),
    file_name_candidates: Sequence[Optional[str]] = (),
) -> DerivedTitle:
    """What to store for this save's title: a real title, or a label key.

    `select_title` first; when nothing survives, the deterministic label key of
    `title_label_key_for` -- or ``label_key`` when the caller knows better than
    the media type does (the upload path, which labels by file extension).

    The date half of a generic title is not returned: the row already carries its
    ``saved_at``, which every contract exposes as ``created_at``, and that is what
    the app formats.
    """
    selected = select_title(
        candidates,
        authors=authors,
        site_names=site_names,
        file_name_candidates=file_name_candidates,
    )
    if selected:
        return DerivedTitle(title=selected, label_key=None)

    return DerivedTitle(
        title=None,
        label_key=label_key
        or title_label_key_for(
            media_type=media_type, source_platform=source_platform
        ),
    )
