"""A post and its comments as one Markdown text, whatever the platform.

The one format of a discussion's text (TASK-636, generalised from the Reddit
renderer of TASK-632/633): a Reddit thread and a Facebook post are drawn the same
way by the readers (`packages/core/src/chat/markdown.ts`), which show headings,
bold and links but no image:

    ## <title>                        (when the platform has one)

    <context: community · author · date>

    <body sections: the post, its link, the text of its images…>

    ## Comments (<shown> of <total>)

    **<author>** · reply, level 1 · <labels>

    <comment body>

`clean_body` is applied by the callers to every body that comes from a provider:
it removes what a Markdown reader would draw wrong.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

#: A comment with nothing left to read: removed by its author or by a moderator.
EMPTY_BODIES = frozenset({"", "[deleted]", "[removed]"})

_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$")
_RULE_RE = re.compile(r"^\s{0,3}([-*_])(?:\s*\1){2,}\s*$")
_BLANK_RUNS_RE = re.compile(r"\n{3,}")


@dataclass(frozen=True)
class DiscussionComment:
    #: As shown, prefix included (``u/name`` on Reddit, the name on Facebook).
    author: str
    depth: int
    body: str
    #: Shown after the reply level: ``pinned``, ``moderator``, ``bot``…
    labels: Tuple[str, ...] = ()


def render_discussion(
    *,
    title: Optional[str],
    context: Sequence[Optional[str]],
    sections: Sequence[str],
    comments: Sequence[DiscussionComment],
    total: Optional[int],
) -> str:
    """The post and its comments as the readers draw them."""
    blocks: List[str] = []
    if title:
        blocks.append(f"## {title}")
    shown_context = [part for part in context if part]
    if shown_context:
        blocks.append(" · ".join(shown_context))
    blocks.extend(section for section in sections if section and section.strip())
    shown = [comment for comment in comments if comment.body.strip() not in EMPTY_BODIES]
    if shown:
        count = f"{len(shown)} of {total}" if total and total > len(shown) else str(len(shown))
        blocks.append(f"## Comments ({count})")
        for comment in shown:
            blocks.append(_comment_header(comment))
            blocks.append(comment.body)
    return "\n\n".join(blocks)


def _comment_header(comment: DiscussionComment) -> str:
    parts = [f"**{comment.author}**"]
    if comment.depth > 0:
        parts.append(f"reply, level {comment.depth}")
    parts.extend(comment.labels)
    return " · ".join(parts)


def clean_body(text: str, *, strip_indentation: bool = False) -> str:
    """A post or comment body the readers can draw: no broken image, code block or stray heading.

    - ``![img](<media id>)`` has no address the reader could open: it becomes ``(image)``;
    - a heading inside a body would cut the text's own sections: it becomes bold;
    - a horizontal rule is dropped (the comment headers already separate the comments);
    - with ``strip_indentation``, each line loses its leading spaces, which would
      otherwise make it a code block (text that is not Markdown: automation-lab's
      Reddit text, every Facebook text).
    """
    text = html.unescape(text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = _IMAGE_RE.sub("(image)", text)
    lines: List[str] = []
    for line in text.split("\n"):
        if strip_indentation:
            line = line.strip()
        if _RULE_RE.match(line):
            lines.append("")
            continue
        heading = _HEADING_RE.match(line)
        if heading:
            line = f"**{heading.group(1)}**" if heading.group(1) else ""
        lines.append(line.rstrip())
    return _BLANK_RUNS_RE.sub("\n\n", "\n".join(lines)).strip()
