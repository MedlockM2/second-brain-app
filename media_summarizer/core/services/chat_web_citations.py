"""Web citations of a chat answer, kept apart from the corpus tags (task-614).

The chat model may search the web (the hosted ``web_search`` tool of the Responses
API, owner decision of 2026-11-06). The model cites a page it read as an inline
Markdown link, usually in parentheses -- ``([title](https://…))`` -- and the
response carries a ``url_citation`` annotation (url, title) for it. The app must
show those pages *apart* from the corpus sources ``[S1]`` … ``[Sn]`` (TASK-615), so
the worker rewrites the answer as it streams:

- every inline web link becomes a tag ``[W1]``, ``[W2]`` …, numbered in order of
  first appearance, one number per URL (a page cited twice keeps its number).
  A citation -- a link in parentheses, or one whose text is only the site or the
  address -- becomes the tag alone. A link that is part of the sentence, its
  text naming the thing (``[Gratin de ravioles au comté](https://…) : …``),
  keeps its text and takes the tag after it, so the sentence still says what it
  links to (``Gratin de ravioles au comté [W1] : …``);
- the tags resolve through ``web_sources``: ``[{ref: "W1", url, title}]``, carried
  on each fragment written after the first one and on the sealed answer.

The ``W`` prefix keeps the two families apart while staying parseable the way
``[S#]`` is (``packages/core/src/chat/markdown.ts``). A link can be cut between two
deltas, so the rewriter holds back a tail that may still become a link and lets it
through once it is clearly one or clearly not.

A rewritten answer goes back to the model in the history with each ``[W#]``
expanded to its ``([title](url))`` form (:func:`expand_web_refs`): the model reads
what it cited, never a bare tag it cannot resolve.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from media_summarizer.core.models.chat import ChatWebSource

#: Letter of a web tag; the corpus uses ``S``.
WEB_REF_LETTER = "W"

#: Longest link text and URL held back while waiting for the rest of a link. Past
#: it, what is held is not a citation and goes through as plain text.
_MAX_LINK_TEXT = 300
_MAX_URL = 2048

#: A complete Markdown link to a web page, optionally wrapped in parentheses.
#: The URL stops at whitespace or a parenthesis; balanced parentheses inside the
#: URL (Wikipedia) are allowed one level deep.
_URL = r"https?://(?:[^\s()]|\([^\s()]*\))+"
_LINK = re.compile(
    r"(?P<open>\()?\[(?P<text>[^\[\]\n]{0,%d})\]\((?P<url>%s)\)" % (_MAX_LINK_TEXT, _URL)
)

#: A tail that may still grow into :data:`_LINK`.
_LINK_PREFIX = re.compile(
    r"\(?(?:\[[^\[\]\n]{0,%d}(?:\](?:\((?:[^\s()]|\([^\s()]*\)?){0,%d})?)?)?"
    % (_MAX_LINK_TEXT, _MAX_URL)
)

_WEB_TAG = re.compile(r"\[%s(\d+)\]" % WEB_REF_LETTER)

#: A bare site name: ``lemonde.fr``, ``www.insee.fr``, ``cuisine.journaldesfemmes.fr``.
_DOMAIN_LIKE = re.compile(r"^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$")


def _names_the_link(link_text: str, url: str) -> bool:
    """Whether a link's text says something the tag does not: not empty, not the
    address, not just a site name. Only such text is kept in the answer."""
    text = link_text.strip().lower()
    if not text:
        return False
    bare_url = re.sub(r"^https?://", "", url.lower()).rstrip("/")
    bare_text = re.sub(r"^https?://", "", text).rstrip("/")
    return bare_text != bare_url and not _DOMAIN_LIKE.match(bare_text)


class WebCitationRewriter:
    """Turns streamed answer text into text with ``[W#]`` tags, chunk by chunk.

    :meth:`feed` returns what can be shown now; :meth:`finish` returns what was
    held back at the end of the stream. The concatenation of every return is the
    answer as stored.
    """

    def __init__(self) -> None:
        self._pending = ""
        self._refs: Dict[str, ChatWebSource] = {}

    @property
    def sources(self) -> List[ChatWebSource]:
        """The web sources cited so far, in tag order."""
        return list(self._refs.values())

    def feed(self, text: str) -> str:
        self._pending += text
        return self._drain(final=False)

    def finish(self) -> str:
        return self._drain(final=True)

    def apply_titles(self, citations: Iterable[Tuple[str, Optional[str]]]) -> None:
        """Take the titles of the provider's ``url_citation`` annotations.

        The link text the model wrote is often a bare domain; the annotation's
        title is the page's own. A URL the text never linked is not added: the
        tags are what the reader sees, and a source no tag points to is noise.
        """
        for url, title in citations:
            source = self._refs.get(url)
            if source is not None and title:
                source.title = title

    def _tag(self, url: str, link_text: str) -> str:
        source = self._refs.get(url)
        if source is None:
            source = ChatWebSource(
                ref=f"{WEB_REF_LETTER}{len(self._refs) + 1}",
                url=url,
                title=link_text.strip() or None,
            )
            self._refs[url] = source
        return f"[{source.ref}]"

    def _drain(self, *, final: bool) -> str:
        out: List[str] = []
        buffer = self._pending
        position = 0
        while True:
            bracket = buffer.find("[", position)
            if bracket < 0:
                # A trailing "(" may open a wrapped link: held for the next delta.
                end = len(buffer) - 1 if not final and buffer.endswith("(") else len(buffer)
                out.append(buffer[position:end])
                position = max(position, end)
                break
            start = bracket - 1 if bracket > position and buffer[bracket - 1] == "(" else bracket
            out.append(buffer[position:start])
            position = start
            match = _LINK.match(buffer, start)
            if match is not None:
                end = match.end()
                wrapped = False
                if match.group("open"):
                    if end == len(buffer) and not final:
                        # ``([t](u)`` -- the closing parenthesis may be next.
                        break
                    if end < len(buffer) and buffer[end] == ")":
                        end += 1
                        wrapped = True
                    else:
                        # Not wrapped after all: keep the parenthesis as text.
                        out.append("(")
                link_text, url = match.group("text"), match.group("url")
                if not wrapped and _names_the_link(link_text, url):
                    # Part of the sentence: its words stay, the tag follows them.
                    out.append(f"{link_text.strip()} ")
                out.append(self._tag(url, link_text))
                position = end
                continue
            if not final and _LINK_PREFIX.fullmatch(buffer, start):
                # May still become a link: hold it for the next delta.
                break
            out.append(buffer[start])
            position = start + 1
        self._pending = buffer[position:]
        if final:
            out.append(self._pending)
            self._pending = ""
        return "".join(out)


def expand_web_refs(text: str, sources: Optional[Sequence[ChatWebSource]]) -> str:
    """The answer as the model reads it back: each ``[W#]`` as ``([title](url))``."""
    if not sources:
        return text
    by_ref = {source.ref: source for source in sources}

    def expand(match: "re.Match[str]") -> str:
        source = by_ref.get(f"{WEB_REF_LETTER}{match.group(1)}")
        if source is None:
            return match.group(0)
        return f"([{source.title or source.url}]({source.url}))"

    return _WEB_TAG.sub(expand, text)
