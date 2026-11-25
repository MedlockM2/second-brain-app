"""Download the PDF a shared link answers, for the document pipeline (task-639).

A link whose answer is `application/pdf` is a document, not an article. The
article reader recognises it (`LinkedDocumentFound`) and the API endpoint calls
this module to fetch the bytes, then submits them like an upload: same staging
bucket, same parsing worker, same budget admission by page count, same
"documents" allocation.

Three rules, all inherited from the upload path rather than invented here:

- **Bounded**: the same ceiling as `POST /api/media/upload-url`. The advertised
  `Content-Length` refuses early; the running total refuses a server that lied
  about it or sent none. Either way the failure is explicit, never a truncated
  document.
- **Identified by content** (task-393): the fingerprint is the MD5 of the bytes,
  labelled `md5-<hex>` -- exactly what S3's ETag gives an uploaded single-part
  object. The same PDF sent from the file picker and shared as a link is
  therefore the same media in the account.
- **Named like a file**: `Content-Disposition` first, then the last path segment
  of the final URL, then a neutral name. The result always ends in `.pdf`, which
  is what the parsing worker reads the format from.
"""

from __future__ import annotations

import hashlib
import logging
import tempfile
from dataclasses import dataclass
from email.message import Message
from typing import IO, Optional
from urllib.parse import unquote, urlsplit

import httpx

from media_summarizer.core.ports.article_content import is_pdf_content_type
from media_summarizer.utils.http_user_agent import BROWSER_USER_AGENT
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

#: The API's 30 s ceiling is the budget: leave room for the S3 write and the
#: submission that follow.
LINKED_DOCUMENT_TIMEOUT_SECONDS = 20.0
_PDF_MAGIC = b"%PDF-"
_FALLBACK_FILE_NAME = "document.pdf"
#: Kept in memory below this size, spooled to the Lambda's disk above it.
_SPOOL_MEMORY_BYTES = 8 * 1024 * 1024


class LinkedDocumentTooLarge(Exception):
    """The PDF is over the document upload ceiling."""

    def __init__(self, max_bytes: int) -> None:
        self.max_bytes = max_bytes
        super().__init__(f"Linked document exceeds {max_bytes} bytes")


class LinkedDocumentUnreadable(Exception):
    """The link could not be downloaded as a PDF; `reason` is a stable log label."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


@dataclass
class LinkedDocument:
    """A downloaded PDF, positioned at its start. The caller closes `body`."""

    body: IO[bytes]
    file_name: str
    size_bytes: int
    content_fingerprint: str
    content_type: str


def file_name_for_link(
    *, content_disposition: Optional[str], final_url: str
) -> str:
    """The name the file would have had if it had been uploaded."""
    candidate: Optional[str] = None
    if content_disposition:
        message = Message()
        message["content-disposition"] = content_disposition
        candidate = message.get_filename()
    if not candidate:
        path = urlsplit(final_url).path
        segments = [segment for segment in path.split("/") if segment]
        candidate = unquote(segments[-1]) if segments else None
    name = (candidate or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not name or name in {".", ".."}:
        return _FALLBACK_FILE_NAME
    return name if name.lower().endswith(".pdf") else f"{name}.pdf"


async def download_linked_pdf(
    url: str,
    *,
    max_bytes: int,
    timeout_seconds: float = LINKED_DOCUMENT_TIMEOUT_SECONDS,
) -> LinkedDocument:
    """Fetch `url` and keep its bytes if, and only if, they are a PDF within `max_bytes`."""
    body = tempfile.SpooledTemporaryFile(max_size=_SPOOL_MEMORY_BYTES)  # noqa: SIM115
    try:
        digest = hashlib.md5(usedforsecurity=False)
        total = 0
        try:
            async with httpx.AsyncClient(
                timeout=timeout_seconds,
                follow_redirects=True,
                headers={
                    "User-Agent": BROWSER_USER_AGENT,
                    "Accept": "application/pdf,*/*;q=0.5",
                },
            ) as client:
                async with client.stream("GET", url) as response:
                    if response.status_code >= 400:
                        raise LinkedDocumentUnreadable(
                            f"http_{response.status_code}"
                        )
                    content_type = (response.headers.get("content-type") or "").strip()
                    if not is_pdf_content_type(content_type):
                        raise LinkedDocumentUnreadable("not_pdf_content_type")
                    advertised = response.headers.get("content-length", "")
                    if advertised.isdigit() and int(advertised) > max_bytes:
                        raise LinkedDocumentTooLarge(max_bytes)
                    file_name = file_name_for_link(
                        content_disposition=response.headers.get("content-disposition"),
                        final_url=str(response.url),
                    )
                    async for chunk in response.aiter_bytes():
                        if total == 0 and not chunk.startswith(_PDF_MAGIC):
                            raise LinkedDocumentUnreadable("not_pdf_bytes")
                        total += len(chunk)
                        if total > max_bytes:
                            raise LinkedDocumentTooLarge(max_bytes)
                        digest.update(chunk)
                        body.write(chunk)
        except httpx.TimeoutException as exc:
            raise LinkedDocumentUnreadable("timeout") from exc
        except httpx.HTTPError as exc:
            raise LinkedDocumentUnreadable("transport_error") from exc

        if total == 0:
            raise LinkedDocumentUnreadable("empty_body")
        body.seek(0)
        log_event(
            logger,
            logging.INFO,
            "linked_document.downloaded",
            "Linked PDF downloaded",
            file_size_bytes=total,
        )
        return LinkedDocument(
            body=body,
            file_name=file_name,
            size_bytes=total,
            content_fingerprint=f"md5-{digest.hexdigest()}",
            content_type="application/pdf",
        )
    except BaseException:
        body.close()
        raise
