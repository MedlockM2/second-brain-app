"""Facebook read through Apify: the actors, their inputs, and their items as data.

Why Apify (TASK-636, owner decision of 2026-11-20): Facebook shows requests from
AWS a login wall, and its share links do not even resolve there (``/share/*``
answers HTTP 400, ``fb.watch`` redirects to ``/login``). Every public reel,
video and post is therefore read by an actor, with or without the page the
browser extension sent.

Why these four actors, chosen from the runs of 2026-11-20:

- videos: ``neuro-scraper~facebook-video-details-scraper`` first. It returns the
  real caption (``text``), a separate ``audioUrl``, and sometimes Facebook's own
  ``transcript`` (kept as metadata only: Deepgram transcribes every source, one
  quality of transcript). It missed 3 of 9 test links (a 10-minute share link,
  ``/<x>/videos/…`` and ``/watch/?v=``), all read by
  ``lance_api~facebook-video-downloader-api``, the fallback. lance_api
  **invents its ``title``** (« Two Friends Meet and Share a Funny AI Moment in
  Dhaka » for a reel captioned « Wait for the end😆🥶 ») and its
  ``description`` says « Public »: neither is ever read.
- posts: ``apify~facebook-posts-scraper`` read 8 of 9 test posts (page, profile,
  public group, ``share/p``, ``permalink.php``, ``story.php``). The cheaper
  topapi and scrapingmonkey missed ``share/p``, ``story.php`` or
  ``permalink.php``. A lone photo comes back as a ``Photo`` without text, whose
  ``container_story`` names the post: the actor is run again on that post.
- comments: ``thedoor~facebook-comment-scraper`` returned 697 of 727 comments,
  replies included, for 0.16 USD, where ``apify~facebook-comments-scraper``
  cost 1.74 USD for the same count and scraper_one dropped the replies.

Every actor id is configuration (``APIFY_FACEBOOK_*_ACTOR_ID``): if one breaks,
swap or replace it there.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence
from urllib.parse import urlsplit

from media_summarizer.infrastructure.resolvers.discussion_text import (
    DiscussionComment,
    clean_body,
)

VIDEO_ACTOR_DEFAULT = "neuro-scraper~facebook-video-details-scraper"
VIDEO_FALLBACK_ACTOR_DEFAULT = "lance_api~facebook-video-downloader-api"
POST_ACTOR_DEFAULT = "apify~facebook-posts-scraper"
COMMENT_ACTOR_DEFAULT = "thedoor~facebook-comment-scraper"

#: Most comments read for one post, replies included (owner decision: 200).
MAX_COMMENTS = max(1, int(os.environ.get("APIFY_FACEBOOK_MAX_COMMENTS", "200")))
#: Replies read under one comment, as verified on 2026-11-20.
_MAX_REPLIES = 100

_ACTORS: Dict[str, tuple[str, str]] = {
    "facebook_video": ("APIFY_FACEBOOK_VIDEO_ACTOR_ID", VIDEO_ACTOR_DEFAULT),
    "facebook_video_fallback": ("APIFY_FACEBOOK_VIDEO_FALLBACK_ACTOR_ID", VIDEO_FALLBACK_ACTOR_DEFAULT),
    "facebook_post": ("APIFY_FACEBOOK_POST_ACTOR_ID", POST_ACTOR_DEFAULT),
    "facebook_comments": ("APIFY_FACEBOOK_COMMENT_ACTOR_ID", COMMENT_ACTOR_DEFAULT),
}

_FACEBOOK_HOSTS = ("facebook.com", "fb.watch", "fb.com")


def actor_id(kind: str) -> str:
    """The configured actor of one role (an ``ApifyActorKind`` value)."""
    variable, default = _ACTORS[kind]
    return os.environ.get(variable, default).strip().replace("/", "~") or default


def actor_input(kind: str, url: str) -> Dict[str, Any]:
    """The input each actor expects, as verified on 2026-11-20."""
    if kind == "facebook_video":
        return {"postUrls": [url], "includeTranscript": True}
    if kind == "facebook_video_fallback":
        return {
            "videoUrls": [url],
            "quality": "best",
            "includeAudio": True,
            "includeAllFormats": False,
            "includeMetadata": True,
        }
    if kind == "facebook_post":
        return {"startUrls": [{"url": url}], "resultsLimit": 1}
    if kind == "facebook_comments":
        return {
            "postUrls": [url],
            "targetComments": MAX_COMMENTS,
            "includeReplies": True,
            "maxReplies": _MAX_REPLIES,
            "orderingMode": "ALL",
            "includeReactions": False,
        }
    raise ValueError(f"unknown Facebook actor role '{kind}'")


def bound_items(kind: str) -> int:
    """How many billed items a run of ``kind`` is reserved for on the budget."""
    return MAX_COMMENTS if kind == "facebook_comments" else 1


# ---------------------------------------------------------------------------
# Videos
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FacebookVideo:
    #: What Deepgram downloads: the audio track when the actor separated it.
    media_url: str
    media_url_kind: str
    #: The author's own words. Never lance_api's title or description.
    caption: Optional[str]
    owner_name: Optional[str]
    duration_seconds: Optional[float]
    published: Optional[str]
    cover_url: Optional[str]
    canonical_url: Optional[str]
    #: Facebook's own captions, when it published some: metadata, not the transcript.
    facebook_transcript: Optional[str]


def video_from_items(kind: str, items: Sequence[Mapping[str, Any]]) -> Optional[FacebookVideo]:
    """The video one run returned, or ``None`` without an audio or video URL."""
    for item in items:
        if kind == "facebook_video":
            video = _neuro_video(item)
        else:
            video = _lance_video(item)
        if video is not None:
            return video
    return None


def _neuro_video(item: Mapping[str, Any]) -> Optional[FacebookVideo]:
    media_url, media_kind = _first_url(item, ("audioUrl", "audio"), ("sdUrl", "video_sd"), ("hdUrl", "video_hd"))
    if not media_url:
        return None
    return FacebookVideo(
        media_url=media_url,
        media_url_kind=media_kind,
        caption=_text(item.get("text")) or None,
        owner_name=_text(item.get("ownerName")) or _name_from_profile_url(_text(item.get("ownerUrl"))),
        duration_seconds=_float(item.get("durationSec")),
        published=_date(item.get("publishedAt")),
        cover_url=_text(item.get("thumbnailUrl")) or None,
        canonical_url=_text(item.get("url")) or None,
        facebook_transcript=_text(item.get("transcript")) or None,
    )


def _lance_video(item: Mapping[str, Any]) -> Optional[FacebookVideo]:
    if _text(item.get("status")).lower() != "success":
        return None
    media_url, media_kind = _first_url(item, ("audioUrl", "audio"), ("videoUrl", "video"))
    if not media_url:
        return None
    author = _mapping(item.get("author"))
    return FacebookVideo(
        media_url=media_url,
        media_url_kind=media_kind,
        # lance_api invents its title and its description reads « Public »: the
        # caption comes from the post, when the video was reached through one.
        caption=None,
        owner_name=_text(author.get("name")) or None,
        duration_seconds=_float(item.get("duration")),
        published=_date(item.get("createTimeIso")),
        cover_url=_text(item.get("thumbnailUrl")) or None,
        canonical_url=None,
        facebook_transcript=None,
    )


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FacebookPost:
    url: str
    text: str
    author: Optional[str]
    group: Optional[str]
    published: Optional[str]
    link_url: Optional[str]
    link_title: Optional[str]
    image_urls: List[str] = field(default_factory=list)
    comments_total: Optional[int] = None
    #: Set on a video post: the address of its video, read on the video path.
    video_url: Optional[str] = None
    cover_url: Optional[str] = None

    @property
    def creator_name(self) -> Optional[str]:
        """The page, profile or group the post belongs to."""
        return self.group or self.author


@dataclass(frozen=True)
class PostLookup:
    """What one posts-actor run said: the post, or the post a lone photo belongs to."""

    post: Optional[FacebookPost] = None
    container_url: Optional[str] = None


def post_from_items(items: Sequence[Mapping[str, Any]], *, requested_url: str) -> PostLookup:
    for item in items:
        if item.get("error") or item.get("errorDescription"):
            continue
        if _text(item.get("__typename")) == "Photo" and not _text(item.get("text")):
            container = _photo_container_url(item)
            if container:
                return PostLookup(container_url=container)
            continue
        post = _post(item, requested_url=requested_url)
        if post is not None:
            return PostLookup(post=post)
    return PostLookup()


def _post(item: Mapping[str, Any], *, requested_url: str) -> Optional[FacebookPost]:
    text = _text(item.get("text"))
    attachments = [entry for key in ("media", "attachments") for entry in _list(item.get(key))]
    video_url = None
    for entry in attachments:
        if _text(entry.get("__typename")) == "Video" and _text(entry.get("url")):
            video_url = _text(entry.get("url"))
            break
    if item.get("isVideo") is True and not video_url:
        video_url = _text(item.get("url")) or requested_url
    images = []
    for entry in attachments:
        if _text(entry.get("__typename")) != "Photo":
            continue
        image = entry.get("photo_image") or entry.get("image")
        uri = _text(image.get("uri")) if isinstance(image, Mapping) else ""
        uri = uri or _text(entry.get("thumbnail"))
        if uri and uri not in images:
            images.append(uri)
    if not text and not images and not video_url:
        return None
    link = _text(item.get("link"))
    # The actor fills `link` with the post's own photo or author page when there
    # is no outside link: only an address outside Facebook is an attached link.
    if link and _is_facebook_url(link):
        link = ""
    user = _mapping(item.get("user"))
    cover = images[0] if images else None
    if not cover:
        for entry in attachments:
            thumbnail = _text(entry.get("thumbnail"))
            if thumbnail and _text(entry.get("__typename")) == "Video":
                cover = thumbnail
                break
    return FacebookPost(
        url=_text(item.get("url")) or _text(item.get("facebookUrl")) or requested_url,
        text=clean_body(text, strip_indentation=True),
        author=_text(user.get("name")) or None,
        group=_text(item.get("groupTitle")) or None,
        published=_date(item.get("time")),
        link_url=link or None,
        link_title=(_text(item.get("previewTitle")) or _text(item.get("linkTitle"))) or None,
        image_urls=images,
        comments_total=_int(item.get("comments") if item.get("comments") is not None else item.get("commentsCount")),
        video_url=video_url,
        cover_url=cover,
    )


def _photo_container_url(item: Mapping[str, Any]) -> Optional[str]:
    """The post a lone photo belongs to: its URL, or one built from ``post_id``."""
    story = item.get("container_story")
    if not isinstance(story, Mapping):
        return None
    url = _text(story.get("url"))
    if url:
        return url
    post_id = _text(story.get("post_id"))
    actors = _list(story.get("actors"))
    owner = _text(actors[0].get("id")) if actors else ""
    if post_id and owner:
        return f"https://www.facebook.com/permalink.php?story_fbid={post_id}&id={owner}"
    return None


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


def comments_from_items(items: Sequence[Mapping[str, Any]]) -> List[DiscussionComment]:
    """The comments in reading order, each followed by its replies."""
    ordered = _thread_order([item for item in items if _text(item.get("id"))])
    comments = []
    for item in ordered:
        body = clean_body(_text(item.get("text")), strip_indentation=True)
        if not body and (_text(item.get("image_url")) or _list(item.get("media"))):
            body = "(image)"
        comments.append(
            DiscussionComment(
                author=_text(item.get("author_name")) or "Facebook user",
                depth=_int(item.get("depth")) or 0,
                body=body,
            )
        )
    return comments


def _thread_order(comments: List[Mapping[str, Any]]) -> List[Mapping[str, Any]]:
    known = {_text(item.get("id")) for item in comments}
    children: Dict[str, List[Mapping[str, Any]]] = {}
    roots: List[Mapping[str, Any]] = []
    for item in comments:
        parent = _text(item.get("replyto_comment_id"))
        if parent and parent in known:
            children.setdefault(parent, []).append(item)
        else:
            roots.append(item)
    ordered: List[Mapping[str, Any]] = []
    stack = list(reversed(roots))
    seen: set[str] = set()
    while stack:
        item = stack.pop()
        identifier = _text(item.get("id"))
        if identifier in seen:
            continue
        seen.add(identifier)
        ordered.append(item)
        stack.extend(reversed(children.get(identifier, [])))
    return ordered


# ---------------------------------------------------------------------------
# Small readers
# ---------------------------------------------------------------------------


def _is_facebook_url(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return any(host == base or host.endswith("." + base) for base in _FACEBOOK_HOSTS)


def _name_from_profile_url(url: str) -> Optional[str]:
    """``https://www.facebook.com/NASA`` → ``NASA``; nothing for a numeric or ``people/`` URL."""
    parts = [part for part in urlsplit(url).path.split("/") if part]
    if len(parts) == 1 and not parts[0].isdigit() and parts[0] not in ("profile.php", "people"):
        return parts[0]
    return None


def _first_url(item: Mapping[str, Any], *keys: tuple[str, str]) -> tuple[Optional[str], str]:
    for key, kind in keys:
        value = _text(item.get(key))
        if value.startswith("http"):
            return value, kind
    return None, ""


def _date(value: Any) -> Optional[str]:
    if isinstance(value, (int, float)) and value > 0:
        return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
    match = re.match(r"\s*(\d{4}-\d{2}-\d{2})", _text(value))
    return match.group(1) if match else None


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _list(value: Any) -> List[Mapping[str, Any]]:
    return [entry for entry in value if isinstance(entry, Mapping)] if isinstance(value, list) else []


def _int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
