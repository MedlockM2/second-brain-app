"""A Reddit thread as text: the reader of the page the extension sent, and the renderer.

TASK-632. Trafilatura reads a thread page as an article and keeps its longest run
of text. On a thread with a pinned moderator summary, that summary is what it
keeps: on 2026-11-19 a saved r/codex thread came back as 167 words of a bot's
"GPT-generated summary of the conversation", with no title, no post and none of
the comments. A thread is not an article: its structure is declared in the markup,
so it is read from there.

Since TASK-633 every Reddit link is read through Apify
(`workers/reddit_ingestion_worker.py`), which returns the whole thread. The page
reader below is the last resort when both actors fail, and gives the library row
its title at submission (`RedditResolver`). `render_thread` is the one format of a
thread's text, whichever source fed it (`infrastructure/reddit_apify.py`); it lays
the thread out through `discussion_text.render_discussion`, which Facebook posts
share (TASK-636).

What the extension sends (`extension/lib/page.ts`, `cleanedDocument`): the light
DOM of the tab, i.e. `document.documentElement.outerHTML` minus ``script``,
``style``, ``noscript``, ``svg``, ``iframe``, ``template`` and ``link`` and minus
``style`` attributes. Shadow roots are never serialized. On the current Reddit
that loses nothing this module reads: ``shreddit-post`` and ``shreddit-comment``
are light-DOM elements whose metadata are attributes (``post-title``,
``author``, ``depth``, ``is-mod-distinguished``…) and whose text is slotted
light-DOM content (``#<id>-post-rtjson-content``, ``#<id>-comment-rtjson-content``).
Their shadow roots hold only layout. Only the comments the page has inserted
are there: nothing is scrolled, expanded or fetched. In the HTML Reddit serves
(checked 2026-11-19 on the thread of TASK-632), the first comments stream in
through a ``<template for=…>`` the page swaps into its ``suspense-placeholder``,
so they are in the DOM by the time of the click; the next ones wait in
``<template id="deferred-comments">`` until the page renders them, and a
template is one of the elements the extension drops.

The text is Markdown, which the readers draw with headings, bold and links
(`packages/core/src/chat/markdown.ts`):

    ## <post title>

    r/<subreddit> · u/<author> · <date>

    <post body>

    ## Comments (<loaded> of <total>)

    **u/<author>** · pinned · moderator

    <comment body>

    **u/<author>** · reply, level 1

    <comment body>

``None`` whenever the page is not a thread this module recognises: the caller then
reads it as any other page.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, List, Optional
from urllib.parse import urljoin, urlsplit

from media_summarizer.infrastructure.resolvers.discussion_text import (
    DiscussionComment,
    render_discussion,
)

REDDIT_HOSTS = frozenset({"reddit.com", "www.reddit.com", "old.reddit.com"})

_BASE_URL = "https://www.reddit.com"
#: The suffix Reddit puts on a thread's ``<title>`` and that a stored title must not keep.
_SUBREDDIT_SUFFIX_RE = re.compile(r"\s*:\s*r/[A-Za-z0-9_]+\s*$")
#: An account that is a bot by name. AutoModerator is Reddit's own.
_BOT_NAME_RE = re.compile(r"(?:^automoderator$|bot$)", re.IGNORECASE)
_HEADINGS = ("h1", "h2", "h3", "h4", "h5", "h6")
_CONTAINERS = ("div", "section", "article", "span")


@dataclass(frozen=True)
class RedditThread:
    title: Optional[str]
    subreddit: Optional[str]
    markdown: str


@dataclass(frozen=True)
class RedditComment:
    author: str
    depth: int
    body: str
    moderator: bool
    pinned: bool


def is_reddit_thread_url(url: str) -> bool:
    """A thread's address: a Reddit host and a ``/comments/`` path, not a listing."""
    parts = urlsplit(url or "")
    host = (parts.hostname or "").lower()
    return host in REDDIT_HOSTS and "/comments/" in parts.path


def read_reddit_thread(html: str, *, url: str) -> Optional[RedditThread]:
    """The thread of a Reddit page, or ``None`` when the page is not one."""
    if not html or not is_reddit_thread_url(url):
        return None
    from lxml import html as lxml_html

    try:
        tree = lxml_html.document_fromstring(html)
    except Exception:
        return None
    return _shreddit_thread(tree) or _old_reddit_thread(tree)


# -- the current Reddit ("shreddit") ----------------------------------------


def _shreddit_thread(tree: Any) -> Optional[RedditThread]:
    posts = tree.xpath("//shreddit-post")
    if not posts:
        return None
    post = posts[0]
    post_id = post.get("id") or ""
    title = clean_title(post.get("post-title")) or clean_title(
        _first_text(tree, f"//*[@id='post-title-{post_id}']")
    )
    if not title:
        return None
    subreddit = prefixed_subreddit(
        post.get("subreddit-prefixed-name") or post.get("subreddit-name")
    )
    body_nodes = tree.xpath(f"//*[@id='{post_id}-post-rtjson-content']") if post_id else []
    body = _markdown(body_nodes[0]) if body_nodes else ""

    pinned_ids = {
        badge.get("thing-id")
        for badge in tree.xpath("//shreddit-comment-badges[@stickied]")
        if badge.get("thing-id")
    }
    comments: List[RedditComment] = []
    seen: set[str] = set()
    for element in tree.xpath("//shreddit-comment"):
        thing_id = element.get("thingid") or ""
        if thing_id in seen:
            continue
        seen.add(thing_id)
        content = element.xpath(f".//*[@id='{thing_id}-comment-rtjson-content']") if thing_id else []
        comments.append(
            RedditComment(
                author=element.get("author") or "[deleted]",
                depth=_int(element.get("depth")) or 0,
                body=_markdown(content[0]) if content else "",
                moderator=element.get("is-mod-distinguished") is not None,
                pinned=thing_id in pinned_ids,
            )
        )
    return RedditThread(
        title=title,
        subreddit=subreddit,
        markdown=render_thread(
            title=title,
            subreddit=subreddit,
            author=post.get("author"),
            created=_date(post.get("created-timestamp")),
            body=body,
            comments=comments,
            total=_int(post.get("comment-count"), default=None),
        ),
    )


# -- old.reddit.com ----------------------------------------------------------


def _has_class(name: str) -> str:
    return f"contains(concat(' ', normalize-space(@class), ' '), ' {name} ')"


def _old_reddit_thread(tree: Any) -> Optional[RedditThread]:
    things = tree.xpath(f"//div[{_has_class('thing')} and {_has_class('link')}]")
    if not things:
        return None
    post = things[0]
    title = clean_title(_first_text(post, f".//a[{_has_class('title')}]"))
    if not title:
        return None
    subreddit = prefixed_subreddit(post.get("data-subreddit"))
    body_nodes = post.xpath(
        f".//div[{_has_class('usertext-body')}]/div[{_has_class('md')}]"
    )
    body = _markdown(body_nodes[0]) if body_nodes else ""

    comments: List[RedditComment] = []
    for element in tree.xpath(f"//div[{_has_class('thing')} and {_has_class('comment')}]"):
        entry = element.xpath(f"./div[{_has_class('entry')}]")
        content = (
            entry[0].xpath(f".//div[{_has_class('usertext-body')}]/div[{_has_class('md')}]")
            if entry
            else []
        )
        author_link = (
            entry[0].xpath(f".//a[{_has_class('author')}]") if entry else []
        )
        depth = len(element.xpath(f"ancestor::div[{_has_class('thing')} and {_has_class('comment')}]"))
        comments.append(
            RedditComment(
                author=element.get("data-author") or "[deleted]",
                depth=depth,
                body=_markdown(content[0]) if content else "",
                moderator=bool(author_link)
                and "moderator" in (author_link[0].get("class") or "").split(),
                pinned="stickied" in (element.get("class") or "").split(),
            )
        )
    timestamp = _int(post.get("data-timestamp"), default=None)
    created = (
        datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc).date().isoformat()
        if timestamp
        else None
    )
    return RedditThread(
        title=title,
        subreddit=subreddit,
        markdown=render_thread(
            title=title,
            subreddit=subreddit,
            author=post.get("data-author"),
            created=created,
            body=body,
            comments=comments,
            total=_int(post.get("data-comments-count"), default=None),
        ),
    )


# -- the text ----------------------------------------------------------------


def render_thread(
    *,
    title: str,
    subreddit: Optional[str],
    author: Optional[str],
    created: Optional[str],
    body: str,
    comments: List[RedditComment],
    total: Optional[int],
) -> str:
    """The thread as the readers draw it; shared by the page reader and the Apify path (TASK-633)."""
    return render_discussion(
        title=title,
        context=(subreddit, f"u/{author}" if author else None, created),
        sections=(body,),
        comments=[
            DiscussionComment(
                author=f"u/{comment.author}",
                depth=comment.depth,
                body=comment.body,
                labels=tuple(
                    label
                    for label, applies in (
                        ("pinned", comment.pinned),
                        ("moderator", comment.moderator),
                        ("bot", bool(_BOT_NAME_RE.search(comment.author))),
                    )
                    if applies
                ),
            )
            for comment in comments
        ],
        total=total,
    )


def _markdown(container: Any) -> str:
    """A post or comment body as Markdown blocks: paragraphs, headings, lists, quotes, code."""
    return "\n\n".join(block for block in _blocks(container) if block)


def _blocks(container: Any) -> List[str]:
    blocks: List[str] = []
    loose = _inline_text(container.text)
    if loose:
        blocks.append(loose)
    for child in container:
        tag = child.tag if isinstance(child.tag, str) else ""
        if tag == "p":
            blocks.append(_inline(child))
        elif tag in _HEADINGS:
            text = _inline(child)
            blocks.append(f"### {text}" if text else "")
        elif tag in ("ul", "ol"):
            blocks.append(_list(child, ordered=tag == "ol", indent=""))
        elif tag == "blockquote":
            quoted = _markdown(child)
            blocks.append("\n".join(f"> {line}" if line else ">" for line in quoted.split("\n")))
        elif tag == "pre":
            code = child.text_content().strip("\n")
            blocks.append(f"```\n{code}\n```" if code.strip() else "")
        elif tag in _CONTAINERS:
            blocks.extend(_blocks(child))
        elif tag == "table":
            rows = [" | ".join(_inline(cell) for cell in row.xpath("./th|./td")) for row in child.xpath(".//tr")]
            blocks.append("\n".join(row for row in rows if row.strip(" |")))
        elif tag not in ("hr", "br", "img", "button"):
            blocks.append(_inline(child))
        tail = _inline_text(child.tail)
        if tail:
            blocks.append(tail)
    return blocks


def _list(listing: Any, *, ordered: bool, indent: str) -> str:
    lines: List[str] = []
    for number, item in enumerate(listing.xpath("./li"), start=1):
        marker = f"{number}. " if ordered else "- "
        nested = [child for child in item if child.tag in ("ul", "ol")]
        own = _inline(item, skip=nested)
        if own:
            lines.append(indent + marker + own)
        for child in nested:
            lines.append(_list(child, ordered=child.tag == "ol", indent=indent + " " * len(marker)))
    return "\n".join(line for line in lines if line)


def _inline(element: Any, skip: Optional[List[Any]] = None) -> str:
    """An element's text on one line, its links as ``[text](url)``."""
    parts: List[str] = [element.text or ""]
    for child in element:
        if skip and child in skip:
            parts.append(child.tail or "")
            continue
        tag = child.tag if isinstance(child.tag, str) else ""
        if tag == "a" and child.get("href"):
            text = " ".join(child.text_content().split())
            href = urljoin(_BASE_URL, child.get("href"))
            parts.append(f"[{text}]({href})" if text else href)
        elif tag == "br":
            parts.append(" ")
        else:
            parts.append(_inline(child))
        parts.append(child.tail or "")
    return " ".join("".join(parts).split())


def _inline_text(text: Optional[str]) -> str:
    return " ".join((text or "").split())


# -- small readers -------------------------------------------------------------


def _first_text(tree: Any, xpath: str) -> Optional[str]:
    nodes = tree.xpath(xpath)
    return " ".join(nodes[0].text_content().split()) if nodes else None


def clean_title(raw: Optional[str]) -> Optional[str]:
    title = " ".join((raw or "").split())
    title = _SUBREDDIT_SUFFIX_RE.sub("", title).strip()
    return title or None


def prefixed_subreddit(raw: Optional[str]) -> Optional[str]:
    name = (raw or "").strip()
    if not name:
        return None
    return name if name.lower().startswith("r/") else f"r/{name}"


def _date(raw: Optional[str]) -> Optional[str]:
    """``YYYY-MM-DD`` of an ISO timestamp such as ``2026-11-12T18:18:28.579000+0000``."""
    match = re.match(r"\s*(\d{4}-\d{2}-\d{2})", raw or "")
    return match.group(1) if match else None


def _int(raw: Optional[str], *, default: Optional[int] = 0) -> Optional[int]:
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return default
