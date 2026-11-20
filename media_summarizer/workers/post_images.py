"""The images of a social post read as text through the shared OCR chain.

Shared by the Instagram photo posts (task-384) and the Facebook posts (TASK-636):
every image is downloaded on the Apify callback and parsed by
`core/services/document_parsing_service.py` (LlamaParse then Unstructured), one
page of the beta budget each.
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlsplit

import httpx

from media_summarizer.core.models.processing_job import ProcessingJob
from media_summarizer.core.ports.document_parser import (
    DocumentFormat,
    ParseError,
    ParseErrorCode,
    ParseResult,
)
from media_summarizer.core.services import beta_budget, budget_guard
from media_summarizer.core.services.budget_guard import TextEstimate
from media_summarizer.core.services.document_measure import DocumentUnits
from media_summarizer.core.services.document_parsing_service import (
    IMAGE_FORMATS,
    BudgetedParse,
    ParseBudget,
    parse_document_with_fallback,
)
from media_summarizer.utils.http_user_agent import BROWSER_USER_AGENT
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

# --- OCR bounds ---------------------------------------------------------------
# A carousel holds up to 20 slides and each one is a full provider round-trip
# (upload, then poll). Both bounds exist so a long carousel finishes with the text
# of its first slides instead of dying on the Lambda timeout with nothing: the
# transcript of 10 slides is a usable media, a timeout is a failed one.
POST_IMAGE_PARSE_MAX_IMAGES = max(1, int(os.environ.get("POST_IMAGE_PARSE_MAX_IMAGES", "10")))
POST_IMAGE_PARSE_BUDGET_SECONDS = float(os.environ.get("POST_IMAGE_PARSE_BUDGET_SECONDS", "240"))
POST_IMAGE_FETCH_TIMEOUT_SECONDS = float(os.environ.get("POST_IMAGE_FETCH_TIMEOUT_SECONDS", "20"))
# A slide is a few hundred KB to a couple of MB. The ceiling keeps a surprising
# payload out of a 512 MB worker, it is not a filter on normal posts.
POST_IMAGE_MAX_BYTES = int(os.environ.get("POST_IMAGE_MAX_BYTES", str(20 * 1024 * 1024)))
# Several Meta CDN edges answer 403 to the default httpx user agent, the same way
# they do on the cover path (`cover_capture`).
_IMAGE_FETCH_USER_AGENT = os.environ.get("COVER_FETCH_USER_AGENT", BROWSER_USER_AGENT)


@dataclass
class PostImageText:
    """What the OCR chain got out of the images of one post."""

    #: The text of each image that yielded any, in carousel order.
    sections: List[str] = field(default_factory=list)
    #: Images a provider actually parsed. This is the page count that is billed.
    images_parsed: int = 0
    #: How many of those LlamaParse did, for the shared pool.
    llamaparse_pages: int = 0
    #: The provider credited on the job, LlamaParse when it did any of the work.
    provider: Optional[str] = None
    #: The format billing is declared under: whatever the parsed images were.
    document_format: DocumentFormat = DocumentFormat.IMAGE_JPG
    #: True when nothing went wrong other than "this picture holds no text".
    #: Distinguishes a sunset (POST_TEXT_EMPTY) from a chain that broke
    #: (DOCUMENT_PARSE_FAILED).
    only_empty_results: bool = True
    #: The parses that delivered text, their attempts still open: settled once
    #: the transcript is stored (task-549).
    delivered: List[BudgetedParse] = field(default_factory=list)


def image_document_format(url: str) -> DocumentFormat:
    """The parsing format of one post image, read off its URL path suffix.

    A CDN URL carries no content type before it is fetched, so the suffix of its
    path is all there is. When there is none, or it is not one of the image
    formats the enum knows, the image is parsed as JPEG: Meta's CDNs serve JPEG,
    and the format only reaches the providers as a filename hint -- both sniff the
    bytes themselves. Guessing wrong therefore costs nothing, while refusing an
    unknown suffix would drop a slide we can read.
    """
    suffix = Path(urlsplit(url).path).suffix.lstrip(".")
    detected = DocumentFormat.from_extension(suffix) if suffix else None
    if detected is None or detected not in IMAGE_FORMATS:
        return DocumentFormat.IMAGE_JPG
    return detected


async def download_image(*, url: str, file_path: str) -> bool:
    """Download one post image to `file_path`. False on any failure.

    Bounded in time and size, and never raises: one unreachable slide of a
    carousel must not lose the text of the others.
    """
    try:
        async with httpx.AsyncClient(
            timeout=POST_IMAGE_FETCH_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers={"User-Agent": _IMAGE_FETCH_USER_AGENT},
        ) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                total = 0
                with open(file_path, "wb") as handle:
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > POST_IMAGE_MAX_BYTES:
                            log_event(
                                logger,
                                logging.WARNING,
                                "media.ingest.image_too_large",
                                "Post image exceeds the size ceiling; skipped",
                                max_bytes=POST_IMAGE_MAX_BYTES,
                            )
                            return False
                        handle.write(chunk)
        return total > 0
    except Exception as exc:  # noqa: BLE001 - one slide is not the post
        log_event(
            logger,
            logging.WARNING,
            "media.ingest.image_fetch_failed",
            "Post image could not be downloaded",
            error_type=type(exc).__name__,
        )
        return False


def image_part(index: int) -> str:
    """The budget part of one image of a post: each is parsed, and paid, on its own."""
    return f"image{index}"


async def admit_post_images(
    *, job: ProcessingJob, user_id: str, image_count: int, text: Optional[TextEstimate] = None
) -> None:
    """Second admission of a post, once the run said how many images it has.

    Rule 10 and « réservation en deux temps » of the task-547 decision: the Apify
    run was admitted alone; now that the image count is known, one page per image
    is reserved, with the post's preview and translation, in one write. ``text``
    sizes them when more than the images is known (a Facebook post's text and
    comments). Raises ``BudgetRefusedError``: the import fails, nothing more is
    sent, and the Apify price stays the operator's spend.
    """
    await budget_guard.admit_import(
        user_id or job.user_id or "",
        operation_id=budget_guard.import_operation_id(job),
        acquisition=lambda ctx: [
            beta_budget.document_line(ctx, provider="llamaparse", unit="page", count=1, part=image_part(index))
            for index in range(1, image_count + 1)
        ],
        text=text or TextEstimate(page_count=image_count, document=True),
        media_item_id=job.media_item_id,
    )


async def parse_post_images(*, job: ProcessingJob, job_id: str, user_id: str, image_urls: List[str]) -> PostImageText:
    """OCR every image of a post, in carousel order, through the shared chain.

    The download happens **here**, on the Apify callback, and never later: the
    Meta CDN URLs the actors return are signed (`oh`/`oe` parameters) and answer
    403 within hours to days -- the same reason the cover is re-hosted instead of
    stored (task-302 §5.1). Keeping the URLs to parse them in a later step would be
    keeping links to nothing.

    Each image is written to a temp file, parsed, then deleted before the next one
    is fetched: the worker holds one slide at a time, whatever the carousel's size.
    """
    outcome = PostImageText()
    started = time.monotonic()

    with tempfile.TemporaryDirectory() as temp_dir:
        for index, url in enumerate(image_urls[:POST_IMAGE_PARSE_MAX_IMAGES], start=1):
            elapsed = time.monotonic() - started
            if elapsed >= POST_IMAGE_PARSE_BUDGET_SECONDS:
                log_event(
                    logger,
                    logging.WARNING,
                    "media.ingest.image_budget_exhausted",
                    "Image OCR budget spent; the post keeps the text parsed so far",
                    job_id=job_id,
                    media_item_id=job_id,
                    images_parsed=outcome.images_parsed,
                    images_total=len(image_urls),
                    elapsed_seconds=int(elapsed),
                )
                outcome.only_empty_results = False
                break

            document_format = image_document_format(url)
            file_name = f"{job_id}-{index}.{document_format.value}"
            file_path = os.path.join(temp_dir, file_name)

            if not await download_image(url=url, file_path=file_path):
                outcome.only_empty_results = False
                continue

            try:
                parsed = await parse_document_with_fallback(
                    file_path=file_path,
                    file_name=file_name,
                    document_format=document_format,
                    budget=ParseBudget(
                        user_id=user_id or job.user_id or "",
                        operation_id=budget_guard.import_operation_id(job),
                        units=DocumentUnits("page", 1),
                        content_media_key=job.media_key,
                        part=image_part(index),
                    ),
                )
            except BaseException:
                # Refused (or failed) mid-post: the parses already delivered go
                # back to the tester with the rest of the import.
                for done in outcome.delivered:
                    await done.release()
                raise
            finally:
                if os.path.exists(file_path):
                    os.remove(file_path)
            result = parsed.outcome

            if isinstance(result, ParseError):
                # "No text in this picture" is what both providers return for a
                # photo without legible words, and it is a normal outcome for this
                # source -- not a broken chain.
                if result.code != ParseErrorCode.EMPTY_RESULT:
                    outcome.only_empty_results = False
                log_event(
                    logger,
                    logging.WARNING,
                    "media.ingest.image_parse_failed",
                    "Post image yielded no text",
                    job_id=job_id,
                    media_item_id=job_id,
                    image_index=index,
                    parse_error_code=result.code.value,
                )
                continue

            assert isinstance(result, ParseResult)
            outcome.delivered.append(parsed)
            outcome.images_parsed += 1
            outcome.document_format = document_format
            if result.provider == "llamaparse":
                outcome.llamaparse_pages += 1
                outcome.provider = result.provider
            elif not outcome.provider:
                outcome.provider = result.provider
            text = result.markdown_content.strip()
            if text:
                outcome.sections.append(text)

    return outcome
