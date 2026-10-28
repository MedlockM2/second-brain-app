"""The parsing chain and its meter, shared by every source that OCRs an image.

Owner decision (task-90): **LlamaParse free tier API cloud -> fallback
Unstructured API**. That chain used to live inside
`workers/document_parsing/worker.py`, which made it reachable only by a file the
user had uploaded. Since task-384 a second source needs exactly the same two
providers and exactly the same meter -- the images of an Instagram photo post --
so both functions moved here rather than being imported from one worker into
another: a worker importing a worker would drag `DOCUMENT_BUCKET`,
`DOCUMENT_PARSING_QUEUE` and a whole polling loop into an unrelated Lambda.

What is shared, and why it has to be the same code in both places:

- `parse_document_with_fallback` -- the provider order, the fallback rule and the
  three log events a run leaves behind. An image is an image: a photo taken from
  the gallery and a photo pulled off Instagram's CDN reach LlamaParse through
  this one function.
- the beta budget of every parse (task-549, rules 1, 5 and 6 of the task-547
  decision). The units are measured from the file before the first call
  (`document_measure`); LlamaParse is sent under the attempt the import's
  admission held, and the Unstructured fallback is a try of its own, reserved at
  its own price before it is sent — refused when the month no longer covers it.
  The provider that delivers keeps its attempt open (:class:`BudgetedParse`) for
  the caller to settle on the pages it billed once the text is stored. N pages
  is N pages: a carousel of four images is priced exactly like an upload of four
  photos.
- `record_document_pool_spend` -- the pages counted against the shared LlamaParse
  pool of `provider_pool_guard`, which protects the operator's account, not the
  tester's budget (TASK-557).

The parser instances are module-level and reused across messages. `llamaparse` is
public and typed as its concrete class, because the document cover reads back one
of its artefacts (`fetch_first_page_screenshot`) -- a LlamaParse capability, not a
parsing contract.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from media_summarizer.core.models.beta_budget import Component
from media_summarizer.core.ports.document_parser import (
    TEXT_FORMATS,
    DocumentFormat,
    DocumentParserPort,
    ParseError,
    ParseErrorCode,
    ParseResult,
)
from media_summarizer.core.services import beta_budget, budget_guard, provider_pool_guard
from media_summarizer.core.services.budget_guard import BudgetCall
from media_summarizer.core.services.document_measure import DocumentUnits
from media_summarizer.infrastructure.resolvers.llamaparse_resolver import (
    LlamaParseResolver,
)
from media_summarizer.infrastructure.resolvers.plain_text_resolver import (
    PlainTextResolver,
)
from media_summarizer.infrastructure.resolvers.unstructured_resolver import (
    UnstructuredResolver,
)
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

#: Primary provider. Public: the document cover fetches the page render this
#: same instance produced while parsing.
llamaparse = LlamaParseResolver()
_unstructured: DocumentParserPort = UnstructuredResolver()
# The text formats never reach either of the two above: a `.txt`, `.md` or `.rtf`
# already holds its own text, so it is decoded here (task-380). No provider call,
# no page, nothing billed.
_plain_text: DocumentParserPort = PlainTextResolver()

#: Formats whose parsed output is OCR of a picture rather than a structured
#: document: their leading heading is body text, not a title (task-266). Declared
#: next to the chain that parses them, because both the document worker (title and
#: cover routing) and the Instagram worker (every image it downloads is one of
#: these) read the same list.
IMAGE_FORMATS: frozenset[DocumentFormat] = frozenset(
    {
        DocumentFormat.IMAGE_JPG,
        DocumentFormat.IMAGE_JPEG,
        DocumentFormat.IMAGE_PNG,
        DocumentFormat.IMAGE_TIFF,
        DocumentFormat.IMAGE_BMP,
        DocumentFormat.IMAGE_HEIF,
    }
)


#: Parse errors the provider answers without processing the file: nothing is
#: billed, so the try is released at zero. Any other failure (a timeout, a lost
#: connection, an API error mid-job, an empty result) may have been billed and is
#: released at its bound.
_NOT_BILLED = frozenset(
    {
        ParseErrorCode.UNSUPPORTED_FORMAT,
        ParseErrorCode.RATE_LIMITED,
        ParseErrorCode.FILE_TOO_LARGE,
        ParseErrorCode.AUTHENTICATION_ERROR,
        ParseErrorCode.INVALID_FILE,
    }
)


@dataclass(frozen=True)
class ParseBudget:
    """Who pays for a parse, and how its tries are reserved.

    ``operation_id`` is the import (``budget_guard.import_operation_id``);
    ``part`` tells apart the files of one import parsed one by one (the images of
    a carousel). ``lease`` is how long a live delivery may hold one try.
    """

    user_id: str
    operation_id: str
    units: DocumentUnits
    content_media_key: Optional[str] = None
    part: str = ""
    lease: timedelta = timedelta(minutes=15)

    async def start(self, provider: str) -> BudgetCall:
        units = self.units
        return await budget_guard.start(
            self.user_id,
            operation_id=self.operation_id,
            component=Component.DOCUMENT_PARSING,
            part=self.part,
            line=lambda ctx: beta_budget.document_line(
                ctx, provider=provider, unit=units.unit, count=units.count, part=self.part
            ),
            lease=self.lease,
            content_media_key=self.content_media_key,
        )


@dataclass(frozen=True)
class BudgetedParse:
    """A parse outcome, with the still-open attempt of the provider that delivered."""

    outcome: ParseResult | ParseError
    call: Optional[BudgetCall] = None
    units: Optional[DocumentUnits] = None

    async def settle(self) -> None:
        """The text reached the user: charge the pages the provider billed. Never raises."""
        if self.call is None or not isinstance(self.outcome, ParseResult) or self.units is None:
            return
        billed = self.outcome.page_count or self.units.count or 1
        try:
            ctx = await beta_budget.load_pricing_context()
        except Exception:  # noqa: BLE001 - the backstop releases the attempt at its bound
            log_event(
                logger,
                logging.ERROR,
                "budget.parse_unpriced",
                "Parse delivered but its cost could not be priced",
                attempt_id=self.call.attempt_id,
            )
            return
        cost = beta_budget.document_cost(
            ctx, provider=self.outcome.provider or "llamaparse", unit=self.units.unit, count=billed
        )
        await self.call.settle(cost, metric_source="parser_page_count")

    async def release(self) -> None:
        """The text was not stored: hand the hold back, the pages as operator spend."""
        if self.call is None:
            return
        operator_cost = None
        if isinstance(self.outcome, ParseResult) and self.units is not None:
            try:
                ctx = await beta_budget.load_pricing_context()
                operator_cost = beta_budget.document_cost(
                    ctx,
                    provider=self.outcome.provider or "llamaparse",
                    unit=self.units.unit,
                    count=self.outcome.page_count or self.units.count or 1,
                )
            except Exception:  # noqa: BLE001 - the bound stands in for the cost
                operator_cost = None
        await self.call.release(operator_cost=operator_cost)


async def _release_failed(call: BudgetCall, error: ParseError) -> None:
    await call.release(operator_cost=budget_guard.no_cost() if error.code in _NOT_BILLED else None)


async def parse_document_with_fallback(
    file_path: str,
    file_name: str,
    document_format: DocumentFormat,
    budget: Optional[ParseBudget] = None,
) -> BudgetedParse:
    """
    Attempt parsing with LlamaParse, falling back to Unstructured on failure.

    Fallback triggers:
    - LlamaParse returns a retryable error (rate limit, timeout, network)
    - LlamaParse returns an API error

    Does NOT fallback if:
    - The format itself is unsupported (both services support all our formats)
    - LlamaParse returns a non-retryable auth error and Unstructured also has
      no key configured (both would fail)
    - The format is a text one: it has no provider and therefore no fallback,
      because there is nothing a second provider could read better than the file
      itself.

    Every provider call is made under ``budget`` (required for every format but the
    text ones): ``BudgetRefusedError`` propagates when the budget refuses LlamaParse
    or, after it failed, the Unstructured fallback, and nothing is sent then.

    Note for callers OCR'ing a picture: "this image carries no text" comes back as
    a `ParseError` with `ParseErrorCode.EMPTY_RESULT`, from both providers -- not
    as a `ParseResult` holding an empty string. A photo of a sunset is therefore
    a *failed* parse here, and it is up to the caller to decide whether that is a
    normal outcome for its source.
    """
    if document_format in TEXT_FORMATS:
        text_result = await _plain_text.parse(file_path, file_name, document_format)
        log_event(
            logger,
            logging.INFO if isinstance(text_result, ParseResult) else logging.WARNING,
            "document_parsing.text_decoded",
            "Text file decoded locally; no parsing provider involved",
            provider="plain_text",
            document_format=document_format.value,
            succeeded=isinstance(text_result, ParseResult),
        )
        return BudgetedParse(outcome=text_result)

    if budget is None:
        raise ValueError("a provider parse needs a budget to be charged to")

    # Primary: LlamaParse
    primary_call = await budget.start("llamaparse")
    try:
        primary_result = await llamaparse.parse(file_path, file_name, document_format)
    except BaseException:
        await primary_call.release()
        raise

    if isinstance(primary_result, ParseResult):
        log_event(
            logger,
            logging.INFO,
            "document_parsing.primary_success",
            "Document parsed successfully with LlamaParse",
            provider="llamaparse",
            page_count=primary_result.page_count,
        )
        return BudgetedParse(outcome=primary_result, call=primary_call, units=budget.units)

    await _release_failed(primary_call, primary_result)

    # Primary failed -- log and attempt fallback
    log_event(
        logger,
        logging.WARNING,
        "document_parsing.primary_failed",
        "LlamaParse failed, attempting Unstructured fallback",
        provider="llamaparse",
        error_code=primary_result.code.value,
        error_message=primary_result.message,
    )

    # Fallback: Unstructured API, a try of its own with its own reservation.
    fallback_call = await budget.start("unstructured")
    try:
        fallback_result = await _unstructured.parse(file_path, file_name, document_format)
    except BaseException:
        await fallback_call.release()
        raise

    if isinstance(fallback_result, ParseResult):
        log_event(
            logger,
            logging.INFO,
            "document_parsing.fallback_success",
            "Document parsed successfully with Unstructured (fallback)",
            provider="unstructured",
            page_count=fallback_result.page_count,
        )
        return BudgetedParse(outcome=fallback_result, call=fallback_call, units=budget.units)

    await _release_failed(fallback_call, fallback_result)

    # Both failed
    log_event(
        logger,
        logging.ERROR,
        "document_parsing.all_failed",
        "Both LlamaParse and Unstructured failed to parse document",
        primary_error=primary_result.message,
        fallback_error=fallback_result.message,
    )

    # Return the fallback error (most recent) with context about both failures
    return BudgetedParse(outcome=ParseError(
        code=fallback_result.code,
        message=(
            f"All parsers failed. "
            f"LlamaParse: {primary_result.message}. "
            f"Unstructured: {fallback_result.message}"
        ),
        provider="llamaparse+unstructured",
        retryable=primary_result.retryable or fallback_result.retryable,
    ))


async def record_document_pool_spend(
    *,
    job_id: str,
    document_format: DocumentFormat,
    page_count: int,
    provider: str,
    llamaparse_pages: Optional[int] = None,
) -> None:
    """Count a parse's pages against the shared LlamaParse pool. Never raises.

    The pool protects the operator's provider account, not a tester's budget: the
    tester is charged by the settlement of the parse's own attempt
    (:meth:`BudgetedParse.settle`). Idempotent on the job id (`llamaparse:<job_id>`),
    so a redelivered message or a re-claimed Apify callback counts once. A text file
    has no provider and counts nothing.

    ``llamaparse_pages`` exists for a source parsed one file at a time: an
    Instagram carousel can have some of its images read by LlamaParse and the rest
    by the Unstructured fallback, so the pool count cannot be derived from a
    single provider name. Left to ``None``, the whole page count goes to the pool
    when ``provider`` is LlamaParse and nothing does otherwise -- which is what a
    single uploaded document means.
    """
    if document_format in TEXT_FORMATS:
        return

    pages = max(1, int(page_count or 1))
    is_llamaparse = provider.strip().lower() == "llamaparse"
    pool_pages = llamaparse_pages if llamaparse_pages is not None else (pages if is_llamaparse else 0)

    if pool_pages > 0:
        await provider_pool_guard.record_spend(
            provider_pool_guard.POOL_LLAMAPARSE,
            units=pool_pages,
            idempotency_token=f"llamaparse:{job_id}",
        )
