"""Route every paid provider call through the beta budget (task-549).

The ledger of task-548 (``core/services/beta_budget.py``) knows how to reserve,
claim, settle and release one attempt atomically. This module is the one place
that decides, for a path that pays a provider, *which* attempt it uses, *when* it
is reserved, and what a refusal becomes. Every provider path of the repository
goes through it; the coverage map is ``docs/BETA_BUDGET_CONTROL.md`` §7.

Owner decision: ``docs/research/task-547-beta-budget-control/README.md``, section
« Décision de l'owner : règles d'implémentation » (rule numbers below are its own).

The vocabulary every caller shares:

- **operation** — the logical unit a budget is reserved for: an import (its id is
  the library row of the save, :func:`import_operation_id`), an artifact
  generation, a chat turn, a translation asked for one save. Never a queue
  message: a redelivery is the same operation.
- **admission** (:func:`admit`, :func:`admit_import`) — one conditional write
  holding the bound of every line of an operation (rule 4). An import holds its
  acquisition, its preview and its translation together (rule 10).
- **call** (:func:`start`) — the right to send one request. It claims the attempt
  the admission held, or, when there is none left to claim (a retry, a fallback, a
  path whose admission did not cover this step), reserves a new try with its own
  bound (rule 6). A request is never sent without one.
- **settle / release** (:class:`BudgetCall`) — a delivered result is charged its
  real cost; anything else hands the whole hold back, the provider cost of the
  failure going to the operator's spend (rule 5). Both also tell the provider's
  circuit how the call went (TASK-566, ``core/services/operator_guard.py``): the
  caller of a release classifies the failure with :func:`failure_of`.

Two rules hold everywhere and are enforced here rather than at each call site:

- **a failing counter refuses** (rule 7). Any ledger error during an admission or
  a claim is :class:`BudgetRefusedError` with ``budget_unavailable``; the caller
  sends nothing. Settling and releasing never raise: the provider has already
  answered, and a lost close is caught by the 6-hour backstop of the ledger;
- **a bound is a bound**. LLM inputs are measured as the UTF-8 bytes of the request
  (:func:`request_input_tokens`): every token of a byte-level BPE vocabulary covers
  at least one byte, so the byte count can never be below the token count the
  provider bills, whatever the language. Outputs are the ``max_completion_tokens``
  actually sent.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import wraps
from math import ceil
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Mapping, Optional, ParamSpec, Sequence, Set, TypeVar

from media_summarizer.core.models.beta_budget import (
    AttemptStatus,
    BudgetAttempt,
    BudgetRefusal,
    CloseOutcome,
    Component,
    MeasuredCost,
    ProviderFailure,
    ProviderKind,
    ReleaseReason,
    ReservationLine,
)
from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.core.services import beta_budget, operator_guard
from media_summarizer.core.services.beta_budget import ItemTooLargeError, PricingContext
from media_summarizer.core.services.llm_config import (
    LLM_MAX_COMPLETION_TOKENS,
    LLM_MODEL,
    LLM_MODEL_MAX_INPUT_TOKENS,
)
from media_summarizer.core.services.llm_corpus import BYTES_PER_TOKEN
from media_summarizer.core.services.operator_guard import OperatorSuspendedError
from media_summarizer.utils.beta_budget_db import LedgerUnavailableError
from media_summarizer.utils.logging_config import get_log_context, log_event

logger = logging.getLogger(__name__)

#: The steps of an import whose settled cost is accumulated on the content for rule
#: 12: what another account saving the processed media is charged. The preview and
#: the translation are kept apart, per reading language, because they are produced
#: per language: another account is charged the ones that exist in its own language
#: — the ones it is then given — and pays the real calls of those that do not.
IMPORT_VALUE_COMPONENTS = frozenset(
    {
        Component.COLLECTION.value,
        Component.TRANSCRIPTION.value,
        Component.DOCUMENT_PARSING.value,
    }
)

#: Overhead counted on top of the content of a request, in bytes (= the token
#: upper bound): the role and separators of each message, and the request frame.
_MESSAGE_OVERHEAD_BYTES = 16
_REQUEST_OVERHEAD_BYTES = 64

#: Estimates of the instructions an import's automatic calls add to its text,
#: reserved with the import before the request exists (rule 10). The gap with the
#: request really sent is settled on the real cost (rule 8).
BLURB_PROMPT_TOKENS = 2_500
TRANSLATION_PROMPT_TOKENS = 400

#: The corpus ceiling of every artifact (``artifact_service.MAX_FOLDER_CORPUS_TOKENS``):
#: the worker refuses a larger corpus, so a blurb never reads more than this.
_BLURB_MAX_CORPUS_TOKENS = 120_000

#: Upper estimate of the text of one X post: 25 000 characters is the longest post
#: the platform publishes. The real text is settled on (rule 8).
X_POST_TEXT_TOKENS = 25_000

#: HTTP status of each refusal, for the synchronous paths.
_HTTP_STATUS: Mapping[BudgetRefusal, int] = {
    BudgetRefusal.BUDGET_EXHAUSTED: 403,
    BudgetRefusal.NOT_ENTITLED: 403,
    BudgetRefusal.ITEM_TOO_LARGE: 413,
    BudgetRefusal.BUDGET_UNAVAILABLE: 503,
    BudgetRefusal.PROVIDER_SUSPENDED: 503,
}

#: The failure code a refused job carries. A closed formula grants no budget, so it
#: reads as an exhausted one on a job; the API body keeps the precise code.
_FAILURE_CODES: Mapping[BudgetRefusal, MediaFailureCode] = {
    BudgetRefusal.BUDGET_EXHAUSTED: MediaFailureCode.BUDGET_EXHAUSTED,
    BudgetRefusal.NOT_ENTITLED: MediaFailureCode.BUDGET_EXHAUSTED,
    BudgetRefusal.ITEM_TOO_LARGE: MediaFailureCode.ITEM_TOO_LARGE,
    BudgetRefusal.BUDGET_UNAVAILABLE: MediaFailureCode.BUDGET_UNAVAILABLE,
    BudgetRefusal.PROVIDER_SUSPENDED: MediaFailureCode.PROVIDER_SUSPENDED,
}

#: The refusal figures a client may read. Amounts are never among them: the tester
#: sees a percentage, never euros (R.1), so ``required_nano_eur`` stays in the logs.
#: Nor is the scope or the reason of a suspension: which provider is down and why
#: is the operator's business, the reader is told when to try again.
_PUBLIC_PARAMS = frozenset({"period_end", "quantity", "measured", "limit", "retry_at"})


# ---------------------------------------------------------------------------
# Refusals
# ---------------------------------------------------------------------------


class BudgetRefusedError(Exception):
    """A paid call the budget does not admit. Nothing was sent.

    Carries the typed refusal of the ledger and its figures, never a sentence: the
    app words it in the reader's language (TASK-550 exposes the contract, TASK-551
    the copy).
    """

    def __init__(self, refusal: BudgetRefusal, params: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(refusal.value)
        self.refusal = refusal
        self.params: Dict[str, Any] = dict(params or {})
        self.observed = False

    @classmethod
    def suspended(cls, exc: OperatorSuspendedError) -> "BudgetRefusedError":
        return cls(BudgetRefusal.PROVIDER_SUSPENDED, exc.params())

    @classmethod
    def for_item(cls, exc: ItemTooLargeError) -> "BudgetRefusedError":
        admission = beta_budget.refusal_for_item_limit(exc.exceeded)
        return cls(BudgetRefusal.ITEM_TOO_LARGE, admission.params)

    @property
    def error_code(self) -> str:
        return self.refusal.value

    @property
    def http_status(self) -> int:
        return _HTTP_STATUS.get(self.refusal, 403)

    @property
    def failure_code(self) -> MediaFailureCode:
        """The code a job refused by this answer is marked failed with."""
        return _FAILURE_CODES.get(self.refusal, MediaFailureCode.BUDGET_EXHAUSTED)

    def public_params(self) -> Dict[str, Any]:
        return {key: value for key, value in self.params.items() if key in _PUBLIC_PARAMS}

    def error_body(self) -> Dict[str, Any]:
        """The refusal as an API error body: the code, then its figures, flat."""
        return {"error_code": self.error_code, **self.public_params()}

    def headers(self) -> Dict[str, str]:
        return {"X-Quota-Error-Code": self.error_code}


class BudgetBusyError(Exception):
    """Another delivery holds the right to send this step, and may still be sending.

    The answer to a duplicate delivery inside the lease of the one that claimed the
    attempt: the caller sends nothing and acknowledges, the delivery in flight owns
    the outcome.
    """


P = ParamSpec("P")
R = TypeVar("R")


def _observe_refusals(function: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """Capture both prechecks and worker refusals, once through nested gates."""
    @wraps(function)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return await function(*args, **kwargs)
        except BudgetRefusedError as refusal:
            if not refusal.observed:
                refusal.observed = True
                payer = args[0] if args else kwargs.get("user_id")
                if isinstance(payer, str) and payer:
                    lines = kwargs.get("lines")
                    components = [line.component.value for line in lines] if isinstance(lines, (list, tuple)) else []
                    component = kwargs.get("component")
                    if isinstance(component, Component):
                        components.append(component.value)
                    operation = kwargs.get("operation_id") or kwargs.get("media_item_id")
                    operation = operation or get_log_context().get("request_id") or function.__name__
                    await beta_budget.observe(
                        payer, outcome="refused", operation_id=str(operation), components=components or [function.__name__],
                        refusal=refusal.refusal.value, params=refusal.params,
                    )
            raise
    return wrapped


def _unavailable(event: str, *, user_id: str, operation_id: str, exc: BaseException) -> BudgetRefusedError:
    log_event(
        logger,
        logging.ERROR,
        event,
        "Beta budget ledger unavailable; the paid call is refused",
        user_id=user_id,
        operation_id=operation_id,
        error_type=type(exc).__name__,
    )
    return BudgetRefusedError(BudgetRefusal.BUDGET_UNAVAILABLE)


# ---------------------------------------------------------------------------
# One claimed attempt
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BudgetCall:
    """The right to send one request, under one reserved attempt.

    ``content_media_key`` names the content whose rule-12 value a settlement of an
    import step adds to (:data:`IMPORT_VALUE_COMPONENTS`).
    """

    user_id: str
    operation_id: str
    attempt_id: str
    component: Component
    content_media_key: Optional[str] = None
    #: The provider of the attempt, whose circuit the outcome is reported to.
    provider: str = ""

    async def settle(self, cost: MeasuredCost, *, metric_source: str) -> Optional[int]:
        """A result reached the user: charge its real cost. Never raises.

        Returns the nano-euros this call charged, ``None`` when nothing moved (the
        attempt was already closed, or the ledger failed and the backstop will
        release it).
        """
        try:
            outcome = await beta_budget.settle(
                self.user_id, self.attempt_id, cost=cost, metric_source=metric_source
            )
            if outcome != CloseOutcome.APPLIED:
                return None
            attempt = await beta_budget.get_attempt(self.user_id, self.attempt_id)
        except Exception as exc:  # noqa: BLE001 - the provider already answered
            log_event(
                logger,
                logging.ERROR,
                "budget_guard.settle_failed",
                "Settlement failed; the attempt stays open until the backstop",
                user_id=self.user_id,
                attempt_id=self.attempt_id,
                cost_usd=str(cost.usd),
                error_type=type(exc).__name__,
            )
            return None
        await operator_guard.record_success(self.provider, self.attempt_id)
        consumed = attempt.consumed_nano_eur if attempt is not None else None
        if consumed and self.content_media_key and self.component.value in IMPORT_VALUE_COMPONENTS:
            from media_summarizer.utils import media_idempotence

            await media_idempotence.add_budget_value(
                media_key=self.content_media_key, operation_id=self.operation_id, nano_eur=consumed
            )
        return consumed

    async def release(
        self,
        *,
        reason: ReleaseReason = ReleaseReason.FAILED,
        operator_cost: Optional[MeasuredCost] = None,
        failure: Optional[ProviderFailure] = None,
        retry_after_seconds: Optional[float] = None,
    ) -> None:
        """No result reached the user: hand the hold back (rule 5). Never raises.

        ``operator_cost`` is what the provider billed for the failed call when it
        is known — zero for an error the provider answered without processing
        anything. Left out for a claimed call, the reserved bound is recorded as
        the operator's spend, because a missing metric is never a zero cost.

        ``failure`` is what the failure says about the provider (:func:`failure_of`),
        for its circuit; ``None`` for a failure of the item itself.
        """
        await _release_quietly(self.user_id, self.attempt_id, reason=reason, operator_cost=operator_cost)
        await operator_guard.record_failure(
            self.provider, self.attempt_id, failure, retry_after_seconds=retry_after_seconds
        )

    async def release_for(self, exc: BaseException, *, operator_cost: Optional[MeasuredCost] = None) -> None:
        """Release after ``exc`` was raised around the call, classified for the circuit."""
        await self.release(
            operator_cost=operator_cost,
            failure=failure_of(exc),
            retry_after_seconds=getattr(exc, "retry_after_seconds", None),
        )


def failure_of(exc: Optional[BaseException]) -> Optional[ProviderFailure]:
    """What an exception raised around a provider call says about the provider."""
    return operator_guard.failure_of(exc)


def no_cost() -> MeasuredCost:
    """The operator cost of a call the provider answered without processing anything.

    An error status (a refused URL, an authentication error, a rate limit) bills
    nothing, so its release records zero rather than the reserved bound.
    """
    return MeasuredCost(usd=Decimal(0), usage={}, tariff_version="not_billed")


async def _release_quietly(
    user_id: str,
    attempt_id: str,
    *,
    reason: ReleaseReason,
    operator_cost: Optional[MeasuredCost] = None,
) -> None:
    try:
        await beta_budget.release(user_id, attempt_id, reason=reason, operator_cost=operator_cost)
    except Exception as exc:  # noqa: BLE001 - the backstop releases what this misses
        log_event(
            logger,
            logging.ERROR,
            "budget_guard.release_failed",
            "Release failed; the attempt stays open until the backstop",
            user_id=user_id,
            attempt_id=attempt_id,
            reason=reason.value,
            error_type=type(exc).__name__,
        )


# ---------------------------------------------------------------------------
# Admission
# ---------------------------------------------------------------------------


async def pricing() -> PricingContext:
    """The formula, rate and barème; an unreadable configuration refuses (rule 7)."""
    try:
        return await beta_budget.load_pricing_context()
    except Exception as exc:  # noqa: BLE001 - no admission on an unknown configuration
        log_event(
            logger,
            logging.ERROR,
            "budget_guard.pricing_unavailable",
            "Pricing context unreadable; the paid call is refused",
            error_type=type(exc).__name__,
        )
        raise BudgetRefusedError(BudgetRefusal.BUDGET_UNAVAILABLE) from exc


def _build(ctx: PricingContext, builder: Callable[[PricingContext], Sequence[ReservationLine]]) -> List[ReservationLine]:
    try:
        return list(builder(ctx))
    except ItemTooLargeError as exc:
        raise BudgetRefusedError.for_item(exc) from exc


@_observe_refusals
async def admit(
    user_id: str,
    *,
    operation_id: str,
    lines: Sequence[ReservationLine],
    try_number: int = 1,
) -> None:
    """Hold the bound of every line of an operation, in one write, or refuse."""
    if not user_id:
        # Nobody to charge is nobody whose budget bounds the call: refused, never
        # let through (rule 9).
        log_event(
            logger,
            logging.ERROR,
            "budget_guard.no_payer",
            "Paid call with no account to charge; refused",
            operation_id=operation_id,
        )
        raise BudgetRefusedError(BudgetRefusal.BUDGET_UNAVAILABLE)
    admission = await beta_budget.reserve(
        user_id, operation_id=operation_id, lines=lines, try_number=try_number
    )
    if not admission.admitted:
        raise BudgetRefusedError(admission.refusal or BudgetRefusal.BUDGET_UNAVAILABLE, admission.params)


@dataclass(frozen=True)
class TextEstimate:
    """How long the text of an import will be, from what is known before it exists.

    The first measure given wins: the text itself, then the audio duration, then
    the page count. With none, the per-item ceiling of the medium is reserved —
    240 minutes of speech, or 100 pages for a document — never a provisional
    minimum (rule 3). ``max_tokens`` replaces the ceiling for a medium with a
    smaller natural bound (an X post). ``embedded_images`` adds, to a text read
    from the file, one document page of text per picture the parse may OCR (a
    DOCX).
    """

    text_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    page_count: Optional[int] = None
    document: bool = False
    max_tokens: Optional[int] = None
    embedded_images: int = 0

    def tokens(self, ctx: PricingContext) -> int:
        if self.text_bytes is not None and self.text_bytes >= 0:
            return (
                ceil(self.text_bytes / BYTES_PER_TOKEN)
                + self.embedded_images * ctx.formula.text_tokens_per_document_page
            )
        estimated = beta_budget.estimated_text_tokens(
            ctx, duration_seconds=self.duration_seconds, page_count=self.page_count
        )
        if estimated > 0:
            return estimated
        if self.max_tokens is not None:
            return self.max_tokens
        limits = ctx.formula.item_limits
        if self.document:
            return limits.document_pages * ctx.formula.text_tokens_per_document_page
        return limits.audio_minutes * ctx.formula.text_tokens_per_audio_minute


def import_operation_id(job: Any) -> str:
    """The operation an import's budget is held under: the library row of the save.

    The row is what every later step of the import can name — the preview
    artifact is scoped on it, the translation is asked for it — so its id ties the
    acquisition, the preview and the translation of one save into one admission.
    A job with no library row (an automatic RSS poll) uses its own id.
    """
    return str(getattr(job, "media_item_id", None) or getattr(job, "id", None) or "")


def _normalized_language(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip().lower()
    return text.split("-")[0].split("_")[0] or None


async def _reading_language(user_id: str, media_item_id: Optional[str]) -> Optional[str]:
    if not media_item_id:
        return None
    from media_summarizer.utils import user_media as user_media_store

    try:
        record = await user_media_store.get_user_media(user_id, media_item_id)
    except Exception as exc:  # noqa: BLE001 - reserving the translation is the safe side
        log_event(
            logger,
            logging.WARNING,
            "budget_guard.reading_language_unreadable",
            "Library row unreadable; the translation is reserved",
            user_id=user_id,
            media_item_id=media_item_id,
            error_type=type(exc).__name__,
        )
        return "unknown"
    return _normalized_language(record.reading_language) if record is not None else None


def blurb_line(ctx: PricingContext, *, text_tokens: int) -> ReservationLine:
    """The preview reserved with an import, from the estimated text (rule 10)."""
    return beta_budget.llm_line(
        ctx,
        component=Component.REVIEW_BLURB,
        model=LLM_MODEL,
        input_tokens=min(text_tokens, _BLURB_MAX_CORPUS_TOKENS) + BLURB_PROMPT_TOKENS,
        max_input_tokens=LLM_MODEL_MAX_INPUT_TOKENS,
        max_output_tokens=LLM_MAX_COMPLETION_TOKENS,
        measured=False,
    )


def import_translation_line(ctx: PricingContext, *, text_tokens: int) -> ReservationLine:
    """The full-text translation reserved with an import (rules 10 and 11)."""
    return beta_budget.translation_line(
        ctx,
        model=LLM_MODEL,
        input_tokens=text_tokens + TRANSLATION_PROMPT_TOKENS,
        measured=False,
    )


@_observe_refusals
async def admit_import(
    user_id: str,
    *,
    operation_id: str,
    acquisition: Callable[[PricingContext], Sequence[ReservationLine]] = lambda ctx: (),
    text: TextEstimate = TextEstimate(),
    media_item_id: Optional[str] = None,
    content_language: Optional[str] = None,
    defer_automatic: bool = False,
) -> None:
    """Admit an import: its paid acquisition, its preview and its translation at once.

    Rule 10: one decision for the user — the whole import is admitted, or it is
    refused before anything is spent. The preview and the translation are added
    to the admission unless this operation already holds them (a later admission
    of the same import: the Deepgram fallback of a TikTok after its Apify run, the
    transcription of an Instagram reel after its collection), and only when there
    is a library row to show them on. The translation is left out when the
    content's language is already known to be the save's reading language; when it
    turns out unnecessary later, its part is released (``not_needed``).

    ``defer_automatic`` leaves the preview and the translation for the second
    admission of an import whose acquisition happens in two steps (an Instagram
    post, whose audio length or image count is only known after the Apify run).

    Raises :class:`BudgetRefusedError`; nothing is held then.
    """
    ctx = await pricing()
    lines = _build(ctx, acquisition)
    if media_item_id and not defer_automatic:
        tokens = text.tokens(ctx)
        lines.append(_build(ctx, lambda c: [blurb_line(c, text_tokens=tokens)])[0])
        reading = await _reading_language(user_id, media_item_id)
        known = _normalized_language(content_language)
        if reading and not (known and known == reading):
            lines.append(_build(ctx, lambda c: [import_translation_line(c, text_tokens=tokens)])[0])

    try:
        present = await _present_steps(user_id, operation_id)
    except LedgerUnavailableError as exc:
        raise _unavailable("budget_guard.admission_unavailable", user_id=user_id, operation_id=operation_id, exc=exc) from exc
    missing = [line for line in lines if beta_budget.step_key(line.component, line.part) not in present]
    if not missing:
        return
    await admit(user_id, operation_id=operation_id, lines=missing)


async def _present_steps(user_id: str, operation_id: str) -> Set[str]:
    if not user_id or not operation_id:
        return set()
    return {attempt.component for attempt in await beta_budget.list_operation_attempts(user_id, operation_id)}


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------


def _latest(attempts: Iterable[BudgetAttempt], step: str) -> Optional[BudgetAttempt]:
    of_step = [attempt for attempt in attempts if attempt.component == step]
    return max(of_step, key=lambda attempt: attempt.try_number, default=None)


@_observe_refusals
async def start(
    user_id: str,
    *,
    operation_id: str,
    component: Component,
    line: Callable[[PricingContext], ReservationLine],
    lease: timedelta,
    part: str = "",
    content_media_key: Optional[str] = None,
) -> BudgetCall:
    """Take the right to send one request of ``component``, reserving it if needed.

    The attempt an admission already holds for this step is claimed as it is. When
    there is none to claim — the step's last try was settled or released (a retry,
    the Unstructured fallback after LlamaParse, a duplicate after a success) or no
    admission ever covered it — a new try is reserved with ``line`` and claimed,
    each new try being its own reservation (rule 6). A try still ``sending`` is the
    trace of a delivery that died mid-call: past ``lease`` it is released as
    ``lost_in_flight`` and a new try is reserved; inside it, another delivery may
    still be sending, and :class:`BudgetBusyError` tells the caller to stand down.

    ``lease`` is how long a live delivery may hold a claim. A caller already
    protected by an exclusive claim of its own (the artifact lease, the chat
    attempt, the translation lock) passes zero: any ``sending`` try it finds was
    left by a delivery that no longer holds that claim.

    Raises :class:`BudgetRefusedError` — nothing may be sent — when the budget
    refuses the new try, the provider is suspended (``provider_suspended``, the held
    attempt released at zero) or the ledger fails.
    """
    if not user_id:
        log_event(
            logger,
            logging.ERROR,
            "budget_guard.no_payer",
            "Paid call with no account to charge; refused",
            operation_id=operation_id,
        )
        raise BudgetRefusedError(BudgetRefusal.BUDGET_UNAVAILABLE)
    step = beta_budget.step_key(component, part)
    try:
        latest = _latest(await beta_budget.list_operation_attempts(user_id, operation_id), step)
        if latest is not None and latest.status == AttemptStatus.HELD:
            if await _claim(user_id, operation_id, latest.attempt_id, provider=latest.provider):
                return _call(user_id, operation_id, latest.attempt_id, component, content_media_key, latest.provider)
            latest = await beta_budget.get_attempt(user_id, latest.attempt_id)
        if latest is not None and latest.status == AttemptStatus.SENDING:
            outcome = await beta_budget.release(
                user_id, latest.attempt_id, reason=ReleaseReason.LOST_IN_FLIGHT, lost_after=lease
            )
            if outcome == CloseOutcome.STILL_IN_LEASE:
                raise BudgetBusyError(latest.attempt_id)
        next_try = latest.try_number + 1 if latest is not None else 1
    except LedgerUnavailableError as exc:
        raise _unavailable("budget_guard.start_unavailable", user_id=user_id, operation_id=operation_id, exc=exc) from exc

    ctx = await pricing()
    reservation = _build(ctx, lambda c: [line(c)])[0]
    if beta_budget.step_key(reservation.component, reservation.part) != step:
        raise ValueError(f"line for {beta_budget.step_key(reservation.component, reservation.part)} given to {step}")
    await admit(user_id, operation_id=operation_id, lines=[reservation], try_number=next_try)
    attempt_id = beta_budget.attempt_id(operation_id, component, next_try, part)
    try:
        claimed = await _claim(user_id, operation_id, attempt_id, provider=reservation.provider)
    except LedgerUnavailableError as exc:
        await _release_quietly(user_id, attempt_id, reason=ReleaseReason.FAILED)
        raise _unavailable("budget_guard.claim_unavailable", user_id=user_id, operation_id=operation_id, exc=exc) from exc
    if not claimed:
        # A concurrent delivery reserved the same try and claimed it first.
        raise BudgetBusyError(attempt_id)
    return _call(user_id, operation_id, attempt_id, component, content_media_key, reservation.provider)


async def _claim(user_id: str, operation_id: str, attempt_id: str, *, provider: str) -> bool:
    """Claim a held attempt; a suspended provider releases it and refuses (TASK-566).

    The request never left, so the hold goes back to the tester at zero cost; the
    next delivery reserves a new try, refused at its own claim while the
    suspension lasts.
    """
    try:
        return await beta_budget.claim_send(user_id, attempt_id, provider=provider)
    except OperatorSuspendedError as exc:
        await _release_quietly(user_id, attempt_id, reason=ReleaseReason.SUSPENDED)
        log_event(
            logger,
            logging.WARNING,
            "budget_guard.send_suspended",
            "Send refused: the provider is suspended",
            user_id=user_id,
            operation_id=operation_id,
            attempt_id=attempt_id,
            scope=exc.scope,
            reason=exc.reason,
        )
        raise BudgetRefusedError.suspended(exc) from exc


def _call(
    user_id: str,
    operation_id: str,
    attempt_id: str,
    component: Component,
    content_media_key: Optional[str],
    provider: str,
) -> BudgetCall:
    return BudgetCall(
        user_id=user_id,
        operation_id=operation_id,
        attempt_id=attempt_id,
        component=component,
        content_media_key=content_media_key,
        provider=provider,
    )


# ---------------------------------------------------------------------------
# Closing what an operation no longer needs
# ---------------------------------------------------------------------------


async def release_held(
    user_id: Optional[str],
    operation_id: Optional[str],
    component: Component,
    *,
    part: str = "",
    reason: ReleaseReason = ReleaseReason.NOT_NEEDED,
) -> int:
    """Release the attempts of a step still held, never sent. Never raises.

    For a part an admission reserved that will not run: the preview of a content
    whose preview already exists, the translation into a language the text is
    already in, the image of a carousel that could not be downloaded. Returns how
    many were released.
    """
    if not user_id or not operation_id:
        return 0
    step = beta_budget.step_key(component, part)
    try:
        attempts = await beta_budget.list_operation_attempts(user_id, operation_id)
    except Exception as exc:  # noqa: BLE001 - the backstop releases what this misses
        log_event(
            logger,
            logging.WARNING,
            "budget_guard.release_held_failed",
            "Could not list the attempts to release; the backstop will",
            user_id=user_id,
            operation_id=operation_id,
            step=step,
            error_type=type(exc).__name__,
        )
        return 0
    released = 0
    for attempt in attempts:
        if attempt.component == step and attempt.status == AttemptStatus.HELD:
            await _release_quietly(user_id, attempt.attempt_id, reason=reason)
            released += 1
    return released


async def release_open(
    user_id: Optional[str],
    operation_id: Optional[str],
    *,
    reason: ReleaseReason = ReleaseReason.FAILED,
) -> int:
    """Release every attempt of an operation still open. Never raises.

    The import failed and nothing reached the user (rule 5): every hold goes back
    to the tester. A step still ``held`` never left (no provider cost); a step
    ``sending`` may have been billed and is recorded at its bound as the operator's
    spend unless its worker released it earlier with the measured cost.
    """
    if not user_id or not operation_id:
        return 0
    try:
        attempts = await beta_budget.list_operation_attempts(user_id, operation_id)
    except Exception as exc:  # noqa: BLE001 - the backstop releases what this misses
        log_event(
            logger,
            logging.WARNING,
            "budget_guard.release_open_failed",
            "Could not list the attempts of a failed import; the backstop will",
            user_id=user_id,
            operation_id=operation_id,
            error_type=type(exc).__name__,
        )
        return 0
    released = 0
    for attempt in attempts:
        if attempt.is_open:
            await _release_quietly(user_id, attempt.attempt_id, reason=reason)
            released += 1
    if released:
        log_event(
            logger,
            logging.INFO,
            "budget_guard.operation_released",
            "Open attempts of a failed operation released",
            user_id=user_id,
            operation_id=operation_id,
            released=released,
        )
    return released


#: The steps that acquire an import's content, as opposed to its automatic preview
#: and translation, which run after it is delivered.
_ACQUISITION_COMPONENTS = frozenset(
    {
        Component.COLLECTION.value,
        Component.TRANSCRIPTION.value,
        Component.DOCUMENT_PARSING.value,
    }
)


async def release_unused_acquisition(user_id: Optional[str], operation_id: Optional[str]) -> int:
    """Release the acquisition steps of a delivered import that never ran. Never raises.

    An import admitted with more than it used: the image of a carousel that could
    not be downloaded, or was past the OCR time budget. Only ``held`` attempts are
    released (``not_needed``): nothing was sent under them. The preview and the
    translation are left alone, they run after the delivery.
    """
    if not user_id or not operation_id:
        return 0
    try:
        attempts = await beta_budget.list_operation_attempts(user_id, operation_id)
    except Exception as exc:  # noqa: BLE001 - the backstop releases what this misses
        log_event(
            logger,
            logging.WARNING,
            "budget_guard.release_unused_failed",
            "Could not list the attempts of a delivered import; the backstop will",
            user_id=user_id,
            operation_id=operation_id,
            error_type=type(exc).__name__,
        )
        return 0
    released = 0
    for attempt in attempts:
        step = attempt.component.split(".", 1)[0]
        if step in _ACQUISITION_COMPONENTS and attempt.status == AttemptStatus.HELD:
            await _release_quietly(user_id, attempt.attempt_id, reason=ReleaseReason.NOT_NEEDED)
            released += 1
    return released


async def settle_collections(user_id: Optional[str], operation_id: Optional[str], *, content_media_key: Optional[str]) -> int:
    """Settle the collections of a delivered import still open. Never raises.

    An Apify run and an X post read are priced per result, and one result is what
    an import asks for and gets: once the import is delivered, its collection is
    charged that price (the API reports no cost per request; rule 8 covers a run
    that billed more). The workers that know the outcome settle their collection
    themselves; this catches the ones that complete elsewhere — an Instagram reel,
    finished by the transcription worker.
    """
    if not user_id or not operation_id:
        return 0
    try:
        attempts = await beta_budget.list_operation_attempts(user_id, operation_id)
        ctx = await beta_budget.load_pricing_context()
    except Exception as exc:  # noqa: BLE001 - the backstop releases what this misses
        log_event(
            logger,
            logging.WARNING,
            "budget_guard.settle_collections_failed",
            "Could not read the collections of a delivered import",
            user_id=user_id,
            operation_id=operation_id,
            error_type=type(exc).__name__,
        )
        return 0
    settled = 0
    for attempt in attempts:
        if attempt.component != Component.COLLECTION.value or not attempt.is_open:
            continue
        if attempt.kind == ProviderKind.APIFY.value:
            cost = beta_budget.apify_cost(ctx, actor_id=attempt.model, results=1)
        elif attempt.kind == ProviderKind.X_API.value:
            cost = beta_budget.x_cost(ctx, posts=1)
        else:
            continue
        call = _call(user_id, operation_id, attempt.attempt_id, Component.COLLECTION, content_media_key, attempt.provider)
        if await call.settle(cost, metric_source="fixed_price_delivered") is not None:
            settled += 1
    return settled


# ---------------------------------------------------------------------------
# Synchronous refusals before a processing starts
# ---------------------------------------------------------------------------


@_observe_refusals
async def precheck(user_id: str) -> None:
    """Refuse a new paid processing at once when the month has nothing left.

    Not an admission — the atomic one happens before the provider call (rule 4) —
    but the answer a submission gets when nothing could be admitted anyway: the
    beta formula is closed, the month's available amount is spent, all new spend
    is paused or an operator ceiling is reached (TASK-566), or the counter cannot
    be read (rule 7). Reading, organising and re-filing a media already held
    never come through here.
    """
    ctx = await pricing()
    now = datetime.now(timezone.utc)
    if not ctx.formula.is_open(now):
        raise BudgetRefusedError(BudgetRefusal.NOT_ENTITLED)
    try:
        counter = await beta_budget.get_period_counter(user_id, now=now)
    except Exception as exc:  # noqa: BLE001 - an unknown state is not a full budget
        raise _unavailable("budget_guard.precheck_unavailable", user_id=user_id, operation_id="precheck", exc=exc) from exc
    if counter.available_nano_eur <= 0:
        raise BudgetRefusedError(
            BudgetRefusal.BUDGET_EXHAUSTED,
            {"period_end": beta_budget.next_period_start(now).isoformat()},
        )
    try:
        await operator_guard.precheck(ctx.operator_limits, now=now)
    except OperatorSuspendedError as exc:
        raise BudgetRefusedError.suspended(exc) from exc
    except LedgerUnavailableError as exc:
        raise _unavailable("budget_guard.precheck_unavailable", user_id=user_id, operation_id="precheck", exc=exc) from exc


# ---------------------------------------------------------------------------
# Rule 12: a content another account already paid for
# ---------------------------------------------------------------------------


@_observe_refusals
async def charge_content_reuse(
    user_id: str,
    *,
    media_item_id: str,
    ledger_row: Optional[Mapping[str, Any]],
    reading_language: Optional[str],
) -> int:
    """Charge a save of content processed for another account (rule 12).

    The new save is debited the settled value kept with the content — its
    acquisition, and the preview and the translation in this save's reading
    language when they already exist, which this save is then given — as if it
    had been processed for it, without any provider call. What does not exist yet
    in its language is generated for it and paid on its real calls. Refused
    like a new processing when the month does not cover it
    (:class:`BudgetRefusedError`). The caller has already established that this
    account does not hold the content yet (task-281: re-filing is free).

    A value of zero — a content processed before the budget existed, or whose
    processing settled nothing — charges nothing and writes nothing. Returns the
    nano-euros charged.
    """
    from media_summarizer.utils import media_idempotence

    value = media_idempotence.budget_value_of(dict(ledger_row) if ledger_row else None)
    transcript_key = media_idempotence.transcript_s3_key_of(dict(ledger_row) if ledger_row else None)
    language = _normalized_language(reading_language)
    if transcript_key and language:
        from media_summarizer.utils.translation_idempotence import (
            TranslationStatus,
            build_translation_fingerprint,
            get_translation_lock,
        )

        try:
            lock = await get_translation_lock(
                build_translation_fingerprint(transcript_s3_key=transcript_key, target_language=language)
            )
        except Exception as exc:  # noqa: BLE001 - the import value still applies
            log_event(
                logger,
                logging.WARNING,
                "budget_guard.reuse_translation_unreadable",
                "Translation lock unreadable; the reuse is charged its import only",
                user_id=user_id,
                media_item_id=media_item_id,
                error_type=type(exc).__name__,
            )
            lock = None
        if lock is not None and lock.status == TranslationStatus.DONE and lock.budget_value_nano_eur:
            value += int(lock.budget_value_nano_eur)

    value += media_idempotence.preview_value_of(dict(ledger_row) if ledger_row else None, language)

    if value <= 0:
        await beta_budget.observe(user_id, outcome="reused", operation_id=media_item_id, components=["reuse_unvalued"])
        return 0
    source = str((ledger_row or {}).get("job_id") or "")
    admission = await beta_budget.charge_reuse(
        user_id,
        operation_id=media_item_id,
        value_nano_eur=value,
        source_operation_id=source,
    )
    if not admission.admitted:
        raise BudgetRefusedError(admission.refusal or BudgetRefusal.BUDGET_UNAVAILABLE, admission.params)
    return value


# ---------------------------------------------------------------------------
# LLM bounds and costs
# ---------------------------------------------------------------------------


def request_input_tokens(
    messages: Sequence[Mapping[str, Any]],
    response_format: Optional[Mapping[str, Any]] = None,
) -> int:
    """Upper bound of the input tokens of a Chat Completions request.

    Its UTF-8 bytes — every message's content, the Structured Outputs schema when
    one is sent — plus a fixed overhead per message and per request. A token of a
    byte-level BPE vocabulary covers at least one byte, so this is never below the
    prompt tokens the provider bills; on Latin text it is about 3.4 times the
    estimate the context ceilings use (``llm_corpus.BYTES_PER_TOKEN``), and the
    settlement brings it back to the real figure.
    """
    total = _REQUEST_OVERHEAD_BYTES
    for message in messages:
        total += len(str(message.get("content") or "").encode("utf-8")) + _MESSAGE_OVERHEAD_BYTES
    if response_format:
        total += len(json.dumps(response_format, ensure_ascii=False).encode("utf-8"))
    return total


def estimated_input_tokens(messages: Sequence[Mapping[str, Any]]) -> int:
    """The estimate of the tokens a request sends (``llm_corpus.BYTES_PER_TOKEN``)."""
    content_bytes = sum(len(str(message.get("content") or "").encode("utf-8")) for message in messages)
    return max(1, ceil(content_bytes / BYTES_PER_TOKEN))


def llm_call_line(
    ctx: PricingContext,
    *,
    component: Component,
    messages: Sequence[Mapping[str, Any]],
    response_format: Optional[Mapping[str, Any]] = None,
    max_output_tokens: int = LLM_MAX_COMPLETION_TOKENS,
) -> ReservationLine:
    """Bound of a generation, a preview or a chat turn, from the request about to leave."""
    return beta_budget.llm_line(
        ctx,
        component=component,
        model=LLM_MODEL,
        input_tokens=request_input_tokens(messages, response_format),
        max_input_tokens=LLM_MODEL_MAX_INPUT_TOKENS,
        max_output_tokens=max_output_tokens,
    )


def chat_turn_operation_id(turn_id: str) -> str:
    """The operation a chat turn is held under: the logical turn, never an attempt."""
    return f"chat:{turn_id}"


def chat_turn_admission_line(ctx: PricingContext, *, estimated_input_tokens: int) -> ReservationLine:
    """Bound of a chat turn admitted before its request exists.

    The API knows the turn's input from the snapshot as an estimate in tokens
    (``chat_prompt.estimate_turn_input_tokens``, bytes over ``BYTES_PER_TOKEN``,
    on the high side of the request the worker sends). Turned back into bytes it
    is the same byte-count bound as :func:`request_input_tokens`; the output is the
    shared ceiling every chat call sends.
    """
    return beta_budget.llm_line(
        ctx,
        component=Component.CHAT_TURN,
        model=LLM_MODEL,
        input_tokens=ceil(max(1, estimated_input_tokens) * BYTES_PER_TOKEN) + _REQUEST_OVERHEAD_BYTES,
        max_input_tokens=LLM_MODEL_MAX_INPUT_TOKENS,
        max_output_tokens=LLM_MAX_COMPLETION_TOKENS,
        measured=False,
    )


def translation_output_reserve(ctx: PricingContext, messages: Sequence[Mapping[str, Any]]) -> int:
    """Output tokens one full-text translation call is reserved for (rule 11, amended).

    1.5 times the estimated tokens of the request. Not sent to the provider: the
    real output is settled on, even past this reservation (rule 8).
    """
    return beta_budget.translation_output_reserve(ctx, estimated_input_tokens(messages))


def translation_call_line(ctx: PricingContext, *, messages: Sequence[Mapping[str, Any]]) -> ReservationLine:
    """Reservation of one full-text translation call: the request's bytes as input,
    1.5 times its estimated tokens as output (an estimate, not a cap)."""
    input_bound = request_input_tokens(messages)
    if input_bound > LLM_MODEL_MAX_INPUT_TOKENS:
        from media_summarizer.core.models.beta_budget import ItemLimitExceeded

        raise ItemTooLargeError(
            ItemLimitExceeded(quantity="input_tokens", measured=input_bound, limit=LLM_MODEL_MAX_INPUT_TOKENS)
        )
    output = translation_output_reserve(ctx, messages)
    return ReservationLine(
        component=Component.TRANSLATION,
        kind=ProviderKind.LLM,
        provider="openai",
        model=LLM_MODEL,
        quantities={"input_tokens": input_bound, "output_tokens": output},
        bound_usd=beta_budget.llm_bound_usd(ctx, model=LLM_MODEL, input_tokens=input_bound, output_tokens=output),
        # The output is an estimate: the call is not capped at it.
        measured=False,
    )


async def llm_cost(usage: ArtifactLlmUsage) -> MeasuredCost:
    """The cost of a call from the provider's usage block, at the current barème."""
    ctx = await beta_budget.load_pricing_context()
    return beta_budget.llm_cost(
        ctx,
        model=usage.model or LLM_MODEL,
        prompt_tokens=usage.prompt_tokens,
        cached_tokens=usage.cached_tokens,
        cache_write_tokens=usage.cache_write_tokens,
        completion_tokens=usage.completion_tokens,
    )


def llm_metric_source(usage: ArtifactLlmUsage) -> str:
    """Where a settled LLM cost comes from: the provider's usage, or an estimate.

    ``estimated`` is the usage of a stream that ended without its usage chunk (a
    stop, a cut): the input from the bytes sent, the output from the text
    received, reasoning left out — the only figure there is, kept apart so
    TASK-552 can tell it from a measured one.
    """
    return "estimated" if usage.usage_estimated else "provider_usage"
