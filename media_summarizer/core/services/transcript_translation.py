"""
Source-agnostic transcript language detection and translation.

This module serves the **reader**: the full text a user opens on a foreign media
is translated into their reading language, in the background, and cached. The
translation is armed at ingestion for every account that saved the media
(``core/services/ingestion_translation_service.py``, task-414), so it is ready
when the media is first opened; ``/raw-content``
(``core/services/raw_content_service.py``) recovers missing translations for the
same language captured on each save (task-545). The search worker shares that
resolver and never indexes foreign source text before its translation. Both go through
:func:`reserve_and_dispatch_translation`. Artifact generation
does *not* come through here any more — it reads the original transcript and asks
the model for the output language (task-398) — so nothing on the generation path
waits on a translation.

The step, which runs after a transcript is available:

1. Detect the transcript language (ISO 639-1).
   - Prefer a reliable language tag exposed by the source (e.g. Deepgram
     ``detected_language``, YouTube subtitle language, ``<podcast:transcript
     language>``) when present.
   - Otherwise detect locally with ``langdetect``. Local detection is FREE and
     avoids an LLM round-trip on the common path where the transcript is already
     in the user's reading language (no translation needed).

2. Decide whether to translate: only when ``detected_language`` differs from the
   save's fixed ``reading_language`` (task-545) AND the target is one of the 11 V1
   languages validated in the task-189 benchmark.

3. Translate with the shared model of ``core/services/llm_config.py``
   (``gpt-6-luna``, Standard processing): on 2026-10-27 the owner extended the
   task-72 decision of 2026-10-10 to this step (task-556), which ran on the
   GPT-5-nano of task-189 until then. The task-189 prompt preserves oral
   register, paragraphs, timestamps and speaker labels. No chunking (see
   :func:`_call_translation_llm` for why one call is enough).

4. Persist the translated transcript in the same S3 bucket/structure as the
   originals, under a deterministic, idempotent key keyed on
   ``(transcript_s3_key, target_language)`` so a couple is never re-translated.

The detection method choice (local ``langdetect`` first, LLM only for the actual
translation) is justified by the task-189 benchmark: it keeps the no-translation
path zero-cost and reserves the paid LLM call for transcripts that genuinely need
to be translated.

**Beta budget** (task-549, rules 6, 10 and 11 of the task-547 decision). Every
dispatch names its payer (:class:`TranslationPayer`): the account whose import
reserved the translation, or the account whose save asks for it later. Each call
to the provider is a try of the payer's ``translation`` step, reserved for the
request's bytes and 1.5 × its input as output (rule 11 as amended on 2026-10-28:
a reservation, not a cap — the call carries no output ceiling of its own). A translation stored settles on
the provider's usage, and that settled value is kept on the translation lock for
rule 12; a call that failed or whose text could not be stored is released. A try
the budget refuses ends the translation as a transient failure: the reader is
shown the original text, as for any failed translation.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import aiohttp

from media_summarizer.core.models.beta_budget import Component
from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.core.services import budget_guard
from media_summarizer.core.services.budget_guard import BudgetCall, BudgetRefusedError
from media_summarizer.core.services.llm_client import (
    LlmMessage,
    estimate_usage,
    read_usage,
)
from media_summarizer.core.services.llm_config import (
    LLM_MODEL,
    LLM_REASONING_EFFORT,
)
from media_summarizer.utils import s3, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.llm_failure import (
    REFUSAL_AUTHENTICATION,
    LLMFailureKind,
    classify_llm_failure,
)
from media_summarizer.utils.logging_config import log_event
from media_summarizer.utils.translation_idempotence import (
    TranslationStatus,
    build_translation_fingerprint,
    get_translation_lock,
    mark_translation_failed,
    reserve_translation,
)

logger = logging.getLogger(__name__)

# --- Configuration -----------------------------------------------------------

TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")
TRANSCRIPT_TRANSLATION_QUEUE = required_env("TRANSCRIPT_TRANSLATION_QUEUE")
LLM_API_URL = os.environ.get(
    "LLM_API_URL", "https://api.openai.com/v1/chat/completions"
)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

TRANSLATION_TIMEOUT_SECONDS = int(
    os.environ.get("TRANSLATION_TIMEOUT_SECONDS", "180")
)
TRANSLATION_MAX_RETRIES = int(os.environ.get("TRANSLATION_MAX_RETRIES", "3"))
TRANSLATION_BACKOFF_BASE_SECONDS = float(
    os.environ.get("TRANSLATION_BACKOFF_BASE_SECONDS", "1.0")
)

# 11 V1 languages validated by the task-189 benchmark (ISO 639-1 -> English name).
V1_LANGUAGE_NAMES: Dict[str, str] = {
    "fr": "French",
    "en": "English",
    "es": "Spanish",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "ja": "Japanese",
    "zh": "Chinese",
    "ar": "Arabic",
    "hi": "Hindi",
}
V1_LANGUAGES = frozenset(V1_LANGUAGE_NAMES.keys())


class TranscriptTranslationError(Exception):
    """Raised when translation fails, after exhausting the retries it deserved.

    This exception carries the two axes of
    ``media_summarizer/utils/llm_failure.py``, which answer two different
    questions. Do not collapse them:

    - ``failure_kind`` (``transient`` / ``permanent``) says whether the same call
      is worth making again. It drives the retry budget and the re-reservation
      gate. It travels with the exception because the decision is taken where the
      provider's answer is read -- the layers above only forward it, they never
      re-interpret a message. The default is the conservative one: an error whose
      origin we did not classify is treated as transient, i.e. re-attemptable.
    - ``refusal_reason`` / ``provider_status`` name *what the operator must do* --
      top up the account, rotate a key, or wait. They are filled only when the
      provider itself declined, and they feed the ``LlmGenerationFailures``
      metric, so the worker never has to parse this exception's message.

    A permanent failure is not always a provider refusal (an unknown model is
    permanent with no ``refusal_reason``), and a provider refusal is not always
    permanent (a named rate limit is transient), which is why both are kept.
    """

    def __init__(
        self,
        message: str,
        *,
        failure_kind: str = LLMFailureKind.TRANSIENT,
        refusal_reason: Optional[str] = None,
        provider_status: Optional[int] = None,
    ) -> None:
        super().__init__(message)
        self.failure_kind = failure_kind
        self.refusal_reason = refusal_reason
        self.provider_status = provider_status


class TranslationInProgressError(Exception):
    """Raised when a translation is already queued or in-progress (lock held).

    Callers should NOT attempt a synchronous translation and should instead
    signal to the client that the translation will complete asynchronously.
    """

    def __init__(self, status: str, message: str = "Translation is in progress") -> None:
        super().__init__(message)
        self.translation_status = status


def normalize_language_tag(value: Optional[str]) -> Optional[str]:
    """Normalize a language tag to a bare ISO 639-1 code (lowercase, no region).

    Examples: ``"EN-US"`` -> ``"en"``, ``"pt_BR"`` -> ``"pt"``, ``"zh-Hans"`` ->
    ``"zh"``. Returns ``None`` for empty / unknown values.
    """
    if not value:
        return None
    code = str(value).strip().lower()
    if not code or code in {"unknown", "und", "auto", "mul", "zxx"}:
        return None
    # Split on region/script separators and keep the primary subtag.
    primary = code.replace("_", "-").split("-", 1)[0]
    return primary or None


def detect_language(
    transcript: str,
    *,
    source_hint: Optional[str] = None,
) -> Tuple[Optional[str], str]:
    """Detect the transcript language.

    Returns ``(iso_639_1_or_None, method)`` where ``method`` is one of
    ``"source_tag"``, ``"langdetect"`` or ``"unknown"``.

    A reliable source-provided tag wins when present; otherwise the text is
    classified locally with ``langdetect`` (free, no LLM call).
    """
    hint = normalize_language_tag(source_hint)
    if hint:
        return hint, "source_tag"

    text = (transcript or "").strip()
    if not text:
        return None, "unknown"

    try:
        from langdetect import DetectorFactory, detect

        # Make detection deterministic across runs (idempotence).
        DetectorFactory.seed = 0
        detected = normalize_language_tag(detect(text))
        if detected:
            return detected, "langdetect"
    except Exception as exc:  # pragma: no cover - defensive
        log_event(
            logger,
            logging.WARNING,
            "translation.detect_failed",
            "Local language detection failed",
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
    return None, "unknown"


def should_translate(
    detected_language: Optional[str],
    target_language: Optional[str],
) -> bool:
    """Return True when a translation should be performed.

    Translate only when the detected language is known, differs from the target,
    and the target is one of the 11 V1 languages.
    """
    detected = normalize_language_tag(detected_language)
    target = normalize_language_tag(target_language)
    if not detected or not target:
        return False
    if detected == target:
        return False
    return target in V1_LANGUAGES


def build_translated_transcript_key(
    *,
    transcript_s3_key: str,
    target_language: str,
) -> str:
    """Deterministic, idempotent S3 key for a translated transcript.

    Keyed on ``(transcript_s3_key, target_language)`` so the same couple always
    resolves to the same object — the cache key required by AC#7.
    """
    target = normalize_language_tag(target_language) or "xx"
    base = transcript_s3_key.rsplit(".", 1)
    if len(base) == 2:
        stem, ext = base
        return f"{stem}.translated.{target}.{ext}"
    return f"{transcript_s3_key}.translated.{target}"


def _build_system_prompt(*, source_language: str, target_language: str) -> str:
    """Translation prompt from the task-189 README ("System Prompt").

    Sent as the ``developer`` message: see :func:`_call_translation_llm`.
    """
    source_name = V1_LANGUAGE_NAMES.get(source_language, source_language)
    target_name = V1_LANGUAGE_NAMES.get(target_language, target_language)
    return (
        "You are a translation assistant specialized in translating transcripts.\n"
        "\n"
        "Rules:\n"
        f"- Translate the following transcript from {source_name} to {target_name}.\n"
        "- Preserve ALL formatting: paragraph breaks, line breaks, timestamps "
        "(e.g., [00:05:32]), speaker labels.\n"
        "- Maintain the oral/conversational register. Do NOT formalize the language.\n"
        "- Keep proper nouns, brand names, and technical terms in their original "
        "form when appropriate.\n"
        "- If timestamps or speaker labels are present, keep them exactly as-is "
        "(do not translate them).\n"
        "- Output ONLY the translated text. No commentary, no notes, no explanations."
    )


@dataclass(frozen=True)
class TranslationPayer:
    """Who a translation is charged to, and under which operation of theirs.

    ``operation_id`` is the payer's save (its library row): the import that
    reserved the translation with its acquisition (rule 10), or the save whose
    reader asks for it later, which reserves it then.
    """

    user_id: str
    operation_id: str

    def to_message(self) -> Dict[str, str]:
        return {"budget_user_id": self.user_id, "budget_operation_id": self.operation_id}

    @classmethod
    def from_message(cls, body: Dict[str, Any]) -> Optional["TranslationPayer"]:
        user_id = str(body.get("budget_user_id") or "").strip()
        operation_id = str(body.get("budget_operation_id") or "").strip()
        if not user_id or not operation_id:
            return None
        return cls(user_id=user_id, operation_id=operation_id)


def _translation_messages(*, transcript: str, source_language: str, target_language: str) -> List[LlmMessage]:
    return [
        {
            "role": "developer",
            "content": _build_system_prompt(
                source_language=source_language,
                target_language=target_language,
            ),
        },
        {"role": "user", "content": transcript},
    ]


async def _call_translation_llm(
    *,
    messages: List[LlmMessage],
) -> Tuple[str, ArtifactLlmUsage]:
    """Call the shared model once. Returns ``(translated_text, usage)``.

    The request follows ``llm_config`` (task-556): ``LLM_MODEL`` and
    ``LLM_REASONING_EFFORT``, Standard processing, no sampling parameter. Checked
    on 2026-10-28 against https://developers.openai.com/api/docs/models/gpt-6-luna
    and the Chat Completions reference: Chat Completions is a supported endpoint;
    ``reasoning_effort`` accepts ``none`` to ``max``, ``medium`` being the default;
    the model documents no ``temperature``; and "with o1 models and newer, use
    developer messages" rather than system messages, hence the ``developer`` role.

    No ``max_completion_tokens`` is sent: only the model's own maximum (128 000
    output tokens, reasoning included) bounds the answer. The owner amended rule 11
    of the task-547 decision on 2026-10-28: its 1.5 × input is what the call is
    *reserved* for, never a cap on the generation, which would cut a short text
    whose reasoning ate the allowance. The shared ``LLM_MAX_COMPLETION_TOKENS`` is
    not reused either: 32 000 tokens would cut every long translation. An answer
    the model maximum cut (``finish_reason: length``) is stored as it is and
    logged.

    No chunking. Luna has a 1 050 000-token window and at most 128 000 output
    tokens, reasoning included, which leaves 922 000 for the input: more than
    240 minutes of audio, a 100-page document or an article (at most 2 MB of
    HTML) produce. What binds first is the output: a translation is about as long
    as its source, so a source text much above 100 000 tokens comes back cut
    (``finish_reason: length``). A text file or a spreadsheet, bounded only by the
    upload size, can exceed even the window, and the provider then refuses it.

    The usage is priced by ``llm_pricing`` under the model the provider names,
    like every other call (``llm_client.read_usage``).
    """
    if not OPENAI_API_KEY:
        # No key configured: three attempts would make three identical no-ops.
        raise TranscriptTranslationError(
            "OPENAI_API_KEY environment variable is required for translation",
            failure_kind=LLMFailureKind.PERMANENT,
            refusal_reason=REFUSAL_AUTHENTICATION,
        )

    payload: Dict[str, Any] = {
        "model": LLM_MODEL,
        "reasoning_effort": LLM_REASONING_EFFORT,
        "messages": messages,
    }
    timeout = aiohttp.ClientTimeout(total=TRANSLATION_TIMEOUT_SECONDS)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            LLM_API_URL,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        ) as response:
            if response.status >= 400:
                body = await response.text()
                # The only place in the pipeline that sees the provider's raw
                # answer, so the only place that can classify it -- and it reads
                # it once, for both axes.
                failure = classify_llm_failure(
                    status_code=response.status,
                    body=body,
                    retry_after=response.headers.get("Retry-After"),
                )
                raise TranscriptTranslationError(
                    f"translation_llm_http_{response.status}: {body[:300]}",
                    failure_kind=failure.kind,
                    refusal_reason=failure.refusal_reason,
                    provider_status=response.status,
                )
            result = await response.json()
            choice = result["choices"][0]
            content = choice["message"]["content"]
            answered_by = result.get("model") or LLM_MODEL
            if choice.get("finish_reason") == "length":
                log_event(
                    logger,
                    logging.WARNING,
                    "translation.output_limit_reached",
                    "Translation cut by the model's output maximum; stored as is",
                )
            usage = result.get("usage")
            if not usage:
                return content, estimate_usage(messages, content or "", model=answered_by)
            return content, read_usage({**usage, "model": answered_by})


async def _start_translation_call(payer: Optional[TranslationPayer], messages: List[LlmMessage]) -> BudgetCall:
    """Take the right to send one translation call.

    The translation lock is the exclusive claim on this couple, so the budget's
    lease is zero. Raises ``BudgetRefusedError``: nothing may be sent, and a
    translation with no payer is refused like a call with no account (rule 9).
    """
    if payer is None:
        raise BudgetRefusedError(budget_guard.BudgetRefusal.BUDGET_UNAVAILABLE)
    return await budget_guard.start(
        payer.user_id,
        operation_id=payer.operation_id,
        component=Component.TRANSLATION,
        line=lambda c: budget_guard.translation_call_line(c, messages=messages),
        lease=timedelta(0),
    )


async def _translate_with_retry(
    *,
    transcript: str,
    source_language: str,
    target_language: str,
    payer: Optional[TranslationPayer],
) -> Tuple[str, ArtifactLlmUsage, BudgetCall]:
    """Translate with exponential backoff, spending it on transient failures only.

    The retry budget exists for failures the next second may fix. A permanent one
    -- no credit, rejected key, unknown model -- ends the loop on the first
    answer: repeating it costs a provider call per attempt and cannot change the
    verdict (task-327 AC#2).

    Each attempt is a try of its own on the payer's budget (rule 6): released at
    zero when the provider answered an error, at its bound otherwise. The call of
    the attempt that answered is returned open, for the caller to settle once the
    text is stored. ``BudgetRefusedError`` propagates: nothing more is sent.
    """
    messages = _translation_messages(
        transcript=transcript,
        source_language=source_language,
        target_language=target_language,
    )
    last_exc: Optional[Exception] = None
    for attempt in range(1, TRANSLATION_MAX_RETRIES + 1):
        call = await _start_translation_call(payer, messages)
        try:
            text, usage = await _call_translation_llm(messages=messages)
            return text, usage, call
        except BaseException as exc:  # noqa: BLE001 - classified below
            answered = getattr(exc, "provider_status", None) is not None
            await call.release(operator_cost=budget_guard.no_cost() if answered else None)
            if not isinstance(exc, Exception):
                raise
            last_exc = exc
            failure_kind = getattr(exc, "failure_kind", LLMFailureKind.TRANSIENT)
            if failure_kind == LLMFailureKind.PERMANENT:
                log_event(
                    logger,
                    logging.ERROR,
                    "translation.permanent_failure",
                    "Translation refused for a reason no retry can change",
                    attempt=attempt,
                    max_retries=TRANSLATION_MAX_RETRIES,
                    error_type=type(exc).__name__,
                    detail=str(exc)[:200],
                )
                raise TranscriptTranslationError(
                    f"translation_permanently_failed: {exc}",
                    failure_kind=LLMFailureKind.PERMANENT,
                ) from exc
            if attempt >= TRANSLATION_MAX_RETRIES:
                break
            backoff = TRANSLATION_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
            log_event(
                logger,
                logging.WARNING,
                "translation.retry",
                "Translation attempt failed, retrying with backoff",
                attempt=attempt,
                max_retries=TRANSLATION_MAX_RETRIES,
                backoff_seconds=backoff,
                error_type=type(exc).__name__,
                detail=str(exc)[:200],
            )
            await asyncio.sleep(backoff)
    # Carry the provider's verdict through the wrapper: without it the terminal
    # error is a string, and the failure metric could not tell "the account has no
    # credit left" from "the translation blew up".
    raise TranscriptTranslationError(
        f"translation_failed_after_{TRANSLATION_MAX_RETRIES}_attempts: {last_exc}",
        # Reaching here means every attempt was transient: a permanent failure
        # re-raises from the except block above without consuming the budget.
        failure_kind=LLMFailureKind.TRANSIENT,
        refusal_reason=getattr(last_exc, "refusal_reason", None),
        provider_status=getattr(last_exc, "provider_status", None),
    )


class TranslationOutcome:
    """Result of :func:`ensure_translated_transcript`.

    ``transcript_s3_key`` is the key downstream artifact generation must read.
    When translation succeeds it points at the translated object; otherwise it
    falls back to the original transcript key.
    """

    def __init__(
        self,
        *,
        transcript_s3_key: str,
        detected_language: Optional[str],
        detection_method: str,
        target_language: Optional[str],
        is_translated: bool,
        translation_failed: bool = False,
        translation_error: Optional[str] = None,
        failure_kind: Optional[str] = None,
        translation_refusal_reason: Optional[str] = None,
        budget_value_nano_eur: Optional[int] = None,
    ) -> None:
        self.transcript_s3_key = transcript_s3_key
        self.detected_language = detected_language
        self.detection_method = detection_method
        self.target_language = target_language
        self.is_translated = is_translated
        self.translation_failed = translation_failed
        self.translation_error = translation_error
        #: Set with ``translation_failed`` only, and forwarded onto the lock so
        #: the next caller can tell "not yet" from "not ever".
        self.failure_kind = failure_kind
        # Set when the provider itself declined (quota / credentials / rate
        # limit). The worker reads it to classify its failure metric, because on
        # this path the failure never surfaces as an exception.
        self.translation_refusal_reason = translation_refusal_reason
        #: What the call that produced this text was charged, settled on the
        #: provider's usage: kept on the translation lock for rule 12. None for a
        #: cache hit, a skip or a failure.
        self.budget_value_nano_eur = budget_value_nano_eur

    def metadata(self) -> Dict[str, Any]:
        """Translation metadata block embedded in the artifact envelope."""
        return {
            "is_translated": self.is_translated,
            "translated_from": self.detected_language if self.is_translated else None,
            "target_language": self.target_language,
            "detected_language": self.detected_language,
            "detection_method": self.detection_method,
            "translation_failed": self.translation_failed,
        }


class TranslationDispatchOutcome(str, Enum):
    """What :func:`reserve_and_dispatch_translation` did. Stable, logged values."""

    #: This caller won the reservation and the SQS message was sent.
    ENQUEUED = "enqueued"
    #: The couple is already queued, in progress, done, or permanently failed:
    #: another caller owns it and no message was sent.
    ALREADY_RESERVED = "already_reserved"
    #: The reservation write itself errored. Nothing was sent; the caller treats
    #: the couple as in flight, and the next access retries the reservation.
    RESERVATION_FAILED = "reservation_failed"
    #: Reserved, but the SQS send failed. The lock was moved to a transient
    #: ``failed`` so the next access may reserve it again.
    DISPATCH_FAILED = "dispatch_failed"


async def enqueue_translation_job(
    *,
    media_key: str,
    transcript_s3_key: str,
    target_language: str,
    source_language_hint: Optional[str],
    source: Optional[str],
    job_id: Optional[str],
    payer: Optional[TranslationPayer],
) -> None:
    """Dispatch one previously reserved translation to the SQS worker."""
    await sqs.send_message(
        queue_name=TRANSCRIPT_TRANSLATION_QUEUE,
        message_body={
            "media_key": media_key,
            "transcript_s3_key": transcript_s3_key,
            "target_language": target_language,
            "source_language_hint": source_language_hint,
            "source": source,
            "job_id": job_id,
            **(payer.to_message() if payer is not None else {}),
        },
    )


async def reserve_and_dispatch_translation(
    *,
    media_key: str,
    transcript_s3_key: str,
    target_language: str,
    source_language_hint: Optional[str],
    source: Optional[str],
    job_id: Optional[str],
    trigger: str,
    payer: Optional[TranslationPayer],
    allow_done_retry: bool = False,
) -> TranslationDispatchOutcome:
    """The one gate every translation request goes through (task-203, task-414).

    Two callers ask for a translation: the ingestion completion hook, which arms
    it as soon as the transcript exists, and ``/raw-content``, which remains the
    recovery for a save whose translation is missing. The search worker uses the
    same resolver; account preference changes never reach this gate. All go
    through the same atomic reservation on ``(transcript_s3_key, target_language)``,
    so whichever comes first enqueues and the other one reads the state — the
    proactive and the lazy trigger can never enqueue the same couple twice.

    Never raises and never waits on the translation itself: one conditional
    ``PutItem`` and one ``SendMessage``. ``trigger`` only labels the logs.
    ``payer`` travels with the message: the worker charges its calls to it.
    """
    try:
        reserved = await reserve_translation(
            transcript_s3_key=transcript_s3_key,
            target_language=target_language,
            allow_done_retry=allow_done_retry,
        )
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "translation.reserve_failed",
            "Failed to reserve translation; treating as already in-flight",
            trigger=trigger,
            transcript_s3_key=transcript_s3_key,
            target_language=target_language,
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        return TranslationDispatchOutcome.RESERVATION_FAILED

    if not reserved:
        log_event(
            logger,
            logging.INFO,
            "translation.already_reserved",
            "Translation already reserved by another caller; not re-enqueuing",
            trigger=trigger,
            transcript_s3_key=transcript_s3_key,
            target_language=target_language,
        )
        return TranslationDispatchOutcome.ALREADY_RESERVED

    try:
        await enqueue_translation_job(
            media_key=media_key,
            transcript_s3_key=transcript_s3_key,
            target_language=target_language,
            source_language_hint=source_language_hint,
            source=source,
            job_id=job_id,
            payer=payer,
        )
    except Exception as exc:
        # Transient by default: an SQS hiccup must leave the couple reservable.
        await mark_translation_failed(
            transcript_s3_key=transcript_s3_key,
            target_language=target_language,
            error_message=(
                f"translation_enqueue_failed: {type(exc).__name__}: {str(exc)[:200]}"
            ),
        )
        log_event(
            logger,
            logging.ERROR,
            "translation.enqueue_failed",
            "Failed to enqueue translation job; next access will retry",
            trigger=trigger,
            queue=TRANSCRIPT_TRANSLATION_QUEUE,
            transcript_s3_key=transcript_s3_key,
            target_language=target_language,
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        return TranslationDispatchOutcome.DISPATCH_FAILED

    log_event(
        logger,
        logging.INFO,
        "translation.enqueued",
        "Translation reserved and async job dispatched",
        trigger=trigger,
        transcript_s3_key=transcript_s3_key,
        target_language=target_language,
        job_id=job_id,
    )
    return TranslationDispatchOutcome.ENQUEUED


async def ensure_translated_transcript(
    *,
    transcript_s3_key: str,
    transcript_text: str,
    target_language: Optional[str],
    source: Optional[str] = None,
    source_language_hint: Optional[str] = None,
    transcript_bucket: str = TRANSCRIPT_BUCKET,
    translation_owner_id: Optional[str] = None,
    payer: Optional[TranslationPayer] = None,
) -> TranslationOutcome:
    """Common detect+translate step. Source-agnostic.

    ``payer`` is who the provider calls are charged to (task-549); without one, a
    translation that needs a call is refused and the original text is kept.

    - Detects the transcript language (source tag first, then local langdetect).
    - Translates to ``target_language`` only when needed and supported.
    - Idempotent: a ``(transcript_s3_key, target_language)`` couple already
      present in S3 is reused, never re-translated.
    - An SQS worker may continue through its own ``in_progress`` lock by passing
      the message id that atomically claimed the lock.
    - On translation failure: retries with backoff, then falls back to the
      original transcript (``translation_failed=True``) so artifact generation
      still proceeds. The mobile UI surfaces the failure via the badge.
    """
    started = time.monotonic()
    detected_language, detection_method = detect_language(
        transcript_text,
        source_hint=source_language_hint,
    )
    normalized_target = normalize_language_tag(target_language)

    if not should_translate(detected_language, normalized_target):
        log_event(
            logger,
            logging.INFO,
            "translation.skipped",
            "Transcript already in target language or target unsupported",
            source=source,
            detected_language=detected_language,
            target_language=normalized_target,
            detection_method=detection_method,
            translated=False,
        )
        return TranslationOutcome(
            transcript_s3_key=transcript_s3_key,
            detected_language=detected_language,
            detection_method=detection_method,
            target_language=normalized_target,
            is_translated=False,
        )

    assert detected_language is not None  # guaranteed by should_translate
    assert normalized_target is not None

    translated_key = build_translated_transcript_key(
        transcript_s3_key=transcript_s3_key,
        target_language=normalized_target,
    )

    # --- Check the DynamoDB translation lock before attempting synchronous translation ---
    # This prevents a redundant LLM call when the transcript_translation worker is
    # already translating the same (transcript_s3_key, target_language) pair (task-214).
    fingerprint = build_translation_fingerprint(
        transcript_s3_key=transcript_s3_key,
        target_language=normalized_target,
    )
    try:
        translation_lock = await get_translation_lock(fingerprint)
    except Exception as exc:  # pragma: no cover - defensive
        log_event(
            logger,
            logging.WARNING,
            "translation.lock_read_failed",
            "Failed to read translation lock; proceeding with S3 check",
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        translation_lock = None

    # If translation is queued or in_progress, do NOT attempt a synchronous translation.
    # Raise so the caller (artifact API) can return 409 to the client.
    owns_in_progress_lock = bool(
        translation_owner_id
        and translation_lock
        and translation_lock.worker_owner_id == translation_owner_id
    )
    if translation_lock and not owns_in_progress_lock and translation_lock.status in (
        TranslationStatus.QUEUED,
        TranslationStatus.IN_PROGRESS,
    ):
        log_event(
            logger,
            logging.INFO,
            "translation.in_flight_detected",
            "Translation already in-flight; refusing synchronous translation",
            transcript_s3_key=transcript_s3_key,
            target_language=normalized_target,
            translation_status=translation_lock.status,
        )
        raise TranslationInProgressError(
            status=translation_lock.status,
            message=(
                f"Translation is currently {translation_lock.status} for this transcript. "
                "Please retry after the translation completes."
            ),
        )

    # Idempotence: reuse an already-produced translation for this couple.
    try:
        if await s3.object_exists(bucket=transcript_bucket, key=translated_key):
            log_event(
                logger,
                logging.INFO,
                "translation.cache_hit",
                "Reusing previously translated transcript",
                source=source,
                detected_language=detected_language,
                target_language=normalized_target,
                detection_method=detection_method,
                translated=True,
            )
            return TranslationOutcome(
                transcript_s3_key=translated_key,
                detected_language=detected_language,
                detection_method=detection_method,
                target_language=normalized_target,
                is_translated=True,
            )
    except Exception as exc:  # pragma: no cover - defensive
        log_event(
            logger,
            logging.WARNING,
            "translation.cache_lookup_failed",
            "Translated transcript existence check failed; will translate",
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )

    # If lock says "done" but S3 object is missing (rare inconsistency),
    # fall through to synchronous re-translation below (AC#3).

    try:
        translated_text, usage, call = await _translate_with_retry(
            transcript=transcript_text,
            source_language=detected_language,
            target_language=normalized_target,
            payer=payer,
        )
    except BudgetRefusedError as refusal:
        # The payer's month does not cover the call, or the counter cannot be
        # read: nothing was sent, and the reader keeps the original text (rule
        # 10). Transient: a new month, or another reader, may ask again.
        log_event(
            logger,
            logging.INFO,
            "translation.budget_refused",
            "Translation refused by the beta budget; original text kept",
            source=source,
            target_language=normalized_target,
            error_code=refusal.error_code,
        )
        return TranslationOutcome(
            transcript_s3_key=transcript_s3_key,
            detected_language=detected_language,
            detection_method=detection_method,
            target_language=normalized_target,
            is_translated=False,
            translation_failed=True,
            translation_error=refusal.error_code,
            failure_kind=LLMFailureKind.TRANSIENT,
        )
    except TranscriptTranslationError as exc:
        # Documented fallback: pass the ORIGINAL transcript to artifacts and flag
        # the failure so the mobile UI can tell the user it wasn't translated.
        log_event(
            logger,
            logging.ERROR,
            "translation.failed",
            "Translation failed; falling back to original transcript",
            source=source,
            detected_language=detected_language,
            target_language=normalized_target,
            detection_method=detection_method,
            model=LLM_MODEL,
            translated=False,
            failure_kind=exc.failure_kind,
            detail=str(exc)[:300],
            refusal_reason=exc.refusal_reason,
            provider_status=exc.provider_status,
        )
        return TranslationOutcome(
            transcript_s3_key=transcript_s3_key,
            detected_language=detected_language,
            detection_method=detection_method,
            target_language=normalized_target,
            is_translated=False,
            translation_failed=True,
            translation_error=str(exc)[:300],
            failure_kind=exc.failure_kind,
            translation_refusal_reason=exc.refusal_reason,
        )

    try:
        usage_cost = await budget_guard.llm_cost(usage)
    except Exception:  # noqa: BLE001 - the bound stands in for an unpriced usage
        usage_cost = None
    payload_bytes = (translated_text or "").encode("utf-8")
    try:
        await s3.upload_file_object(
            bucket=transcript_bucket,
            key=translated_key,
            file_obj=BytesIO(payload_bytes),
            content_type="text/plain; charset=utf-8",
            metadata={
                "is-translated": "true",
                "translated-from": detected_language,
                "target-language": normalized_target,
                "source-transcript-key": transcript_s3_key,
            },
        )
    except BaseException:
        # Billed, never stored: nothing reached a reader (rule 5).
        await call.release(operator_cost=usage_cost)
        raise
    budget_value = (
        await call.settle(usage_cost, metric_source=budget_guard.llm_metric_source(usage))
        if usage_cost is not None
        else None
    )

    duration_ms = int((time.monotonic() - started) * 1000)
    log_event(
        logger,
        logging.INFO,
        "translation.completed",
        "Transcript translated",
        source=source,
        detected_language=detected_language,
        target_language=normalized_target,
        detection_method=detection_method,
        # The model the provider says answered, which is what the cost is read
        # against.
        model=usage.model,
        prompt_tokens=usage.prompt_tokens,
        cached_tokens=usage.cached_tokens,
        cache_write_tokens=usage.cache_write_tokens,
        completion_tokens=usage.completion_tokens,
        usage_estimated=usage.usage_estimated,
        duration_ms=duration_ms,
        estimated_cost_eur=usage.cost_eur,
        translated=True,
    )
    return TranslationOutcome(
        transcript_s3_key=translated_key,
        detected_language=detected_language,
        detection_method=detection_method,
        target_language=normalized_target,
        is_translated=True,
        budget_value_nano_eur=budget_value,
    )


def job_source_language_hint(job: Any) -> Optional[str]:
    """Reliable source-provided language tag from a job's transcription metadata.

    Deepgram persists the detected/forced language in ``transcription_metadata``;
    YouTube/TikTok subtitle workers and the Podcasting 2.0 short-circuit do the
    same. We treat that tag as a trustworthy detection hint.
    """
    metadata = getattr(job, "transcription_metadata", None)
    if isinstance(metadata, dict):
        for key in ("detected_language", "language"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value
    return None


async def persist_detected_language(job: Any, detected_language: Optional[str]) -> None:
    """Best-effort persistence of the detected language on the job (idempotent)."""
    if not detected_language:
        return
    metadata = dict(getattr(job, "transcription_metadata", None) or {})
    if metadata.get("detected_language") == detected_language:
        return
    metadata["detected_language"] = detected_language
    try:
        job.set_transcription_metadata(metadata)
        from media_summarizer.utils import database_async

        await database_async.update_processing_job(job)
    except Exception as exc:  # pragma: no cover - non-fatal
        log_event(
            logger,
            logging.WARNING,
            "translation.detected_language_persist_failed",
            "Failed to persist detected_language on job (non-fatal)",
            media_item_id=getattr(job, "id", None),
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
