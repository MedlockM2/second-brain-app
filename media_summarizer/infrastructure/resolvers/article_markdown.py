"""The body of a web page as Markdown a reader can read.

TestFlight feedback `ANPCT7VWg0qWWuHgKePMPXA` (build 27): an article arrived as one
wall of text, all at the same size and with no spacing, and on a paywalled site
93 % of what was stored was the subscription offer and the cookie consent dialog
(`mobile-design-mockups/lecture_article_lisible/README.md`). Plain-text extraction
glued paragraphs with a single newline and lost headings, quotes and lists.

What this module does, every rule decided from the page's shape and never from
its site:

- **Overlays out.** Dialogs (``role="dialog"``, ``aria-modal``) and the containers
  of the standard consent managers are removed before extraction. An element that
  holds the article (``html``, ``body``, ``main``, ``article`` or an ancestor of
  them) never is: a news site puts ``popin-gdpr-no-scroll`` on its ``<html>``.
- **Links out.** A list whose items are nearly all link text (related videos,
  "read also", tags) and a paragraph that is nearly all link (an inline "read
  also") are navigation, not text. The share is measured on the HTML for lists
  and on trafilatura's ``<ref>`` for paragraphs.
- **Markdown in.** trafilatura's XML is converted here: a blank line between
  paragraphs, ``##``/``###`` headings, ``>`` quotes, ``-`` lists, and no inline
  formatting: its own Markdown output leaves stray ``*`` in the text, and with
  formatting on, its XML splits a paragraph at a bold run and glues the words
  either side of an italic one. The page's
  ``<h1>`` is not repeated: it is the title the reader shows above.
- **Standfirst.** A paragraph the page also declares as its description, word for
  word (give or take a short kicker such as "CHRONIQUE."), is its standfirst. It
  opens the text in bold, which is how the readers recognise it
  (`packages/core/src/media/transcript.ts`, `splitArticleText`); a page that shows
  it in its header, where trafilatura does not look, gets it back.
- **Paywall.** A page that declares itself not free (schema.org
  ``isAccessibleForFree: false``) loses the all-bold paragraph that closes its
  article ("65 % of this article is left to read"),
  and its text ends with `INCOMPLETE_MARKER`, on which the readers say the text
  stops there.
"""

from __future__ import annotations

import json
import re
from typing import Any, Iterable, List, Optional, Tuple

#: Closes the text of a page that declares the rest of its article reserved. A
#: ``## [`` heading, like the sections of a page read with its videos: the
#: translation prompt keeps the bracketed part as-is, so a translated text still
#: carries it.
INCOMPLETE_MARKER = "## [incomplete]"

_CONSENT_RE = re.compile(
    r"didomi|onetrust|sp_message|qc-cmp|cookie-?(?:consent|banner|notice)|consent-?(?:banner|manager)"
    r"|usercentrics|axeptio|tarteaucitron|cookiebot|cmp-container|gdpr",
    re.IGNORECASE,
)
_ARTICLE_TAGS = ("html", "body", "main", "article")
#: Share of a block's text that must be link text for it to be navigation.
_LINK_SHARE = 0.8
#: A kicker the description may carry before the standfirst ("CHRONIQUE.").
_KICKER_MAX_WORDS = 3
_STANDFIRST_MIN_CHARS = 40
#: Past this the normalizer would cut the standfirst in two, through its bold.
_STANDFIRST_MAX_CHARS = 700
_XML_DECLARATION_RE = re.compile(r"^\s*<\?xml[^>]*>", re.IGNORECASE)


def _flat(element: Any) -> str:
    return " ".join("".join(element.itertext()).split())


def _norm(text: Optional[str]) -> str:
    return " ".join((text or "").split()).strip(" .…")


def _link_share(element: Any, link_xpath: str) -> float:
    total = len(_flat(element))
    if not total:
        return 0.0
    return sum(len(_flat(link)) for link in element.xpath(link_xpath)) / total


def _declared_description(tree: Any) -> str:
    for xpath in (
        "//meta[@property='og:description']/@content",
        "//meta[@name='description']/@content",
        "//meta[@name='twitter:description']/@content",
    ):
        for value in tree.xpath(xpath):
            if _norm(value):
                return _norm(value)
    return ""


def _walk(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _declared_paywalled(tree: Any) -> bool:
    for script in tree.xpath("//script[@type='application/ld+json']"):
        try:
            data = json.loads(script.text or "")
        except ValueError:
            continue
        for node in _walk(data):
            if isinstance(node, dict) and str(node.get("isAccessibleForFree", "")).lower() == "false":
                return True
    return False


def _standfirst(tree: Any, description: str) -> Optional[str]:
    """The page's paragraph that is also its declared description, if any."""
    if len(description) < _STANDFIRST_MIN_CHARS:
        return None
    for paragraph in tree.xpath("//p"):
        text = _norm(_flat(paragraph))
        if len(text) < _STANDFIRST_MIN_CHARS or not description.endswith(text):
            continue
        kicker = description[: len(description) - len(text)]
        if len(kicker.split()) <= _KICKER_MAX_WORDS:
            return " ".join(_flat(paragraph).split())
    return None


def _drop_overlays(tree: Any) -> None:
    for element in list(tree.iter()):
        if not isinstance(element.tag, str) or element.getparent() is None:
            continue
        marker = " ".join(filter(None, (element.get("id"), element.get("class"))))
        overlay = (
            element.get("role") in ("dialog", "alertdialog")
            or element.get("aria-modal") == "true"
            or bool(marker and _CONSENT_RE.search(marker))
        )
        if not overlay or element.tag in _ARTICLE_TAGS or element.xpath(".//article|.//main"):
            continue
        element.getparent().remove(element)


def _drop_link_lists(tree: Any) -> None:
    for listing in tree.xpath("//ul|//ol"):
        if listing.getparent() is None:
            continue
        items = [item for item in listing.xpath("./li") if _flat(item)]
        linked = [item for item in items if _link_share(item, ".//a") >= _LINK_SHARE]
        if len(items) >= 2 and len(linked) >= _LINK_SHARE * len(items):
            listing.getparent().remove(listing)


def _blocks(main: Any) -> List[Tuple[str, str]]:
    """``(kind, markdown)`` for each block of trafilatura's XML body."""
    blocks: List[Tuple[str, str]] = []
    for element in main:
        text = _flat(element)
        if not text:
            continue
        if element.tag == "head":
            level = element.get("rend") or "h2"
            if level == "h1" and not blocks:
                continue
            blocks.append(("heading", ("## " if level in ("h1", "h2") else "### ") + text))
        elif element.tag == "list":
            items = [item for item in element.findall("item") if _flat(item)]
            linked = [item for item in items if _link_share(item, ".//ref") >= _LINK_SHARE]
            if not items or len(linked) >= _LINK_SHARE * len(items):
                continue
            blocks.append(("list", "\n".join("- " + _flat(item) for item in items)))
        elif element.tag == "quote":
            blocks.append(("quote", "> " + text))
        elif _link_share(element, ".//ref") >= _LINK_SHARE:
            continue
        else:
            blocks.append(("paragraph", text))
    return blocks


def _drop_closing_calls_to_subscribe(tree: Any) -> None:
    """The bold paragraph a paywalled article ends on ("65 % of this article is left")."""
    for paragraph in tree.xpath("//p[not(following-sibling::*)]"):
        bold = " ".join(_flat(node) for node in paragraph.xpath(".//strong|.//b"))
        text = _flat(paragraph)
        if text and " ".join(bold.split()) == text and paragraph.getparent() is not None:
            paragraph.getparent().remove(paragraph)


def article_markdown(html: str) -> Tuple[str, bool]:
    """``(markdown, paywalled)`` for one page; an empty text when nothing is readable.

    The Markdown is not normalized yet and does not carry `INCOMPLETE_MARKER`:
    the caller normalizes it, then closes it with the marker when ``paywalled``.
    """
    import trafilatura
    from lxml import etree
    from lxml import html as lxml_html

    tree = lxml_html.document_fromstring(_XML_DECLARATION_RE.sub("", html or "", count=1))
    standfirst = _standfirst(tree, _declared_description(tree))
    paywalled = _declared_paywalled(tree)
    _drop_overlays(tree)
    _drop_link_lists(tree)
    if paywalled:
        _drop_closing_calls_to_subscribe(tree)

    xml = trafilatura.extract(
        lxml_html.tostring(tree, encoding="unicode"),
        output_format="xml",
        include_comments=False,
        include_tables=False,
        include_links=True,
        include_formatting=False,
    )
    main = etree.fromstring(xml.encode("utf-8")).find("main") if xml else None
    blocks = _blocks(main) if main is not None else []

    texts = [markdown for _, markdown in blocks]
    if standfirst and "*" not in standfirst and len(standfirst) <= _STANDFIRST_MAX_CHARS:
        if texts and blocks[0][0] == "paragraph" and _norm(texts[0]) == _norm(standfirst):
            texts[0] = f"**{texts[0]}**"
        elif texts and not any(_norm(text) == _norm(standfirst) for text in texts):
            texts.insert(0, f"**{standfirst}**")
    return "\n\n".join(texts), paywalled
