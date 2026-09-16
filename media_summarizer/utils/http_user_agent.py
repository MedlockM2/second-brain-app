"""The User-Agent we announce when fetching a public web page.

One string, shared by every outbound fetch that targets a page or an asset a
browser would load: the article reader, the cover capture, the Instagram slide
download. It says "a current browser" and nothing else -- no product name, no
`+https://` contact URL, no `Bot` token.

That is not vanity. A bot-shaped agent is the cheapest signal an anti-robot edge
has, and it is enforced *before* the request is even routed: on 2026-09-16 the
same URL answered **405** to
``media-summarizer/article-extractor (+https://media-summarizer.local)`` and to
``python-httpx``, and **200** to a browser agent (task-399, from a beta report on
build 9). A 405 on a `GET` is not a publisher's verdict on the page -- the page is
there and readable -- so a fetch that identifies itself as a crawler turns a
readable article into a failed tile for the person who saved it.

Each caller keeps its own environment variable as the override point
(``ARTICLE_EXTRACT_USER_AGENT``, ``COVER_FETCH_USER_AGENT``); this is the default
they fall back on. When the string ages out, one edit here covers all of them.
"""

from __future__ import annotations

#: A current Chrome on macOS. Kept plain and boring on purpose: an agent nobody
#: has ever had a reason to add to a block list.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)
