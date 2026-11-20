"""A Reddit thread read through Apify: the actors' inputs and their items as one text.

Why Apify, and why these two actors (TASK-633, owner decision of 2026-11-19):

- Reddit refuses requests from AWS addresses whatever the client: the static
  reader gets a block page and the ``web-render`` Chromium an HTTP 4xx. OpenAI's
  ``web_search`` reads the thread but will not copy it out (one sentence of the
  post, no comment, for 0.023-0.056 USD).
- ``kaix~reddit-scraper`` is the primary: the whole thread (269/269 comments on
  the test thread) for about 0.007 USD, and it accepts ``redd.it`` links. It has
  few users, so it may break or disappear.
- ``automation-lab~reddit-scraper`` is the fallback, called only when kaix fails
  or returns no post: well established, but about 30 times dearer (0.20 USD for
  262 comments on 2026-11-19) and it refuses ``redd.it`` links.

Both actor ids are configuration (``APIFY_REDDIT_PRIMARY_ACTOR_ID``,
``APIFY_REDDIT_FALLBACK_ACTOR_ID``): if the primary keeps failing, swap them.

The items become the same Markdown the browser-page reader produces
(`resolvers/reddit_thread.render_thread`), after a clean-up measured on the test
thread: kaix sends Reddit's raw Markdown, whose images are ``![img](<media id>)``
with no address; automation-lab rebuilds the text from HTML and keeps a six-space
indentation that a Markdown reader takes for code.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence

from media_summarizer.infrastructure.resolvers.discussion_text import clean_body
from media_summarizer.infrastructure.resolvers.reddit_thread import (
    RedditComment,
    clean_title,
    prefixed_subreddit,
    render_thread,
)

PRIMARY_ACTOR_DEFAULT = "kaix~reddit-scraper"
FALLBACK_ACTOR_DEFAULT = "automation-lab~reddit-scraper"
#: automation-lab bills each comment (0.00075 USD): this caps a fallback run near
#: 0.75 USD. kaix is not capped: 1 000 comments cost it about 0.02 USD.
FALLBACK_MAX_COMMENTS = max(1, int(os.environ.get("APIFY_REDDIT_FALLBACK_MAX_COMMENTS", "1000")))
#: The comment count a kaix run is reserved for on the budget before it starts.
#: Not a cap: the run is settled at what it really cost.
PRIMARY_BOUND_COMMENTS = 1000


@dataclass(frozen=True)
class ApifyRedditThread:
    title: str
    subreddit: Optional[str]
    markdown: str
    comments_fetched: int
    comments_total: Optional[int]


def is_fallback_actor(actor_id: str) -> bool:
    """The run is the configured fallback's: nothing is tried after it but the page."""
    return actor_id.replace("/", "~") == fallback_actor_id()


def rebuilds_text_from_html(actor_id: str) -> bool:
    """automation-lab's text keeps the page's indentation, whichever role it has."""
    return actor_id.replace("/", "~") == FALLBACK_ACTOR_DEFAULT


def primary_actor_id() -> str:
    return os.environ.get("APIFY_REDDIT_PRIMARY_ACTOR_ID", PRIMARY_ACTOR_DEFAULT).strip().replace("/", "~")


def fallback_actor_id() -> str:
    return os.environ.get("APIFY_REDDIT_FALLBACK_ACTOR_ID", FALLBACK_ACTOR_DEFAULT).strip().replace("/", "~")


def actor_input(actor_id: str, url: str) -> Dict[str, Any]:
    """The input each actor expects, as verified on 2026-11-19."""
    if actor_id.replace("/", "~") == FALLBACK_ACTOR_DEFAULT:
        return {
            "urls": [url],
            "includeComments": True,
            "maxCommentsPerPost": FALLBACK_MAX_COMMENTS,
            "commentDepth": 10,
            "maxPostsPerSource": 1,
        }
    # 0 is "no limit": the whole thread.
    return {
        "mode": "post",
        "postUrls": [url],
        "includeComments": True,
        "maxCommentsPerPost": 0,
        "maxItems": 0,
    }


def bound_items(actor_id: str) -> int:
    """How many billed items a run of ``actor_id`` is reserved for (the post included)."""
    if actor_id.replace("/", "~") == FALLBACK_ACTOR_DEFAULT:
        return FALLBACK_MAX_COMMENTS + 1
    return PRIMARY_BOUND_COMMENTS + 1


def thread_from_items(items: Sequence[Mapping[str, Any]], *, strip_indentation: bool) -> Optional[ApifyRedditThread]:
    """The thread of one run's dataset, or ``None`` when it holds no post."""
    posts = [item for item in items if item.get("type") == "post"]
    if not posts:
        return None
    post = posts[0]
    title = clean_title(_text(post.get("title")))
    if not title:
        return None
    raw_comments = [item for item in items if item.get("type") == "comment"]
    comments = [
        RedditComment(
            author=_text(item.get("author")) or "[deleted]",
            depth=_int(item.get("depth")),
            body=clean_body(_text(item.get("body")), strip_indentation=strip_indentation),
            moderator=_text(item.get("distinguished")).lower() == "moderator",
            pinned=item.get("stickied") is True,
        )
        for item in _thread_order(raw_comments, post_id=_text(post.get("id")))
    ]
    post_body = clean_body(
        _text(post.get("selftext") or post.get("selfText")),
        strip_indentation=strip_indentation,
    )
    subreddit = prefixed_subreddit(_text(post.get("subredditPrefixed") or post.get("subreddit")))
    total = _int(post.get("numComments"), default=None)
    markdown = render_thread(
        title=title,
        subreddit=subreddit,
        author=_text(post.get("author")) or None,
        created=_date(post),
        body=post_body,
        comments=comments,
        total=total,
    )
    return ApifyRedditThread(
        title=title,
        subreddit=subreddit,
        markdown=markdown,
        comments_fetched=sum(1 for comment in comments if comment.body and comment.body not in ("[deleted]", "[removed]")),
        comments_total=total,
    )


def _thread_order(comments: List[Mapping[str, Any]], *, post_id: str) -> List[Mapping[str, Any]]:
    """The comments in reading order: each one followed by its replies.

    A comment whose parent the actor did not return (automation-lab skips some)
    is read where it came, as if it answered the post.
    """
    def key(item: Mapping[str, Any]) -> str:
        identifier = _text(item.get("id"))
        return identifier if identifier.startswith("t1_") else f"t1_{identifier}"

    known = {key(item) for item in comments}
    children: Dict[str, List[Mapping[str, Any]]] = {}
    roots: List[Mapping[str, Any]] = []
    for item in comments:
        parent = _text(item.get("parentId"))
        if parent in known:
            children.setdefault(parent, []).append(item)
        else:
            roots.append(item)
    ordered: List[Mapping[str, Any]] = []
    stack = list(reversed(roots))
    seen: set[str] = set()
    while stack:
        item = stack.pop()
        identifier = key(item)
        if identifier in seen:
            continue
        seen.add(identifier)
        ordered.append(item)
        stack.extend(reversed(children.get(identifier, [])))
    return ordered


def _date(post: Mapping[str, Any]) -> Optional[str]:
    """``YYYY-MM-DD``: kaix sends ``createdUtc`` (Unix) and ``created`` (ISO), automation-lab ``createdAt``."""
    timestamp = post.get("createdUtc")
    if isinstance(timestamp, (int, float)) and timestamp > 0:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
    match = re.match(r"\s*(\d{4}-\d{2}-\d{2})", _text(post.get("created") or post.get("createdAt")))
    return match.group(1) if match else None


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _int(value: Any, *, default: Optional[int] = 0) -> Any:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
