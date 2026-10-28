"""
Shared gate for every producer that enqueues a transcription (task-250, task-549).

The producer that resolves the audio URL is the last place where an import can
still be refused *before* Deepgram spends anything. Whatever the media came from —
a podcast feed, a YouTube-less audio URL, a TikTok without captions, an Instagram
reel, a shared voice note, an automatic RSS poll — if it is about to be
transcribed it goes through here. This module holds the sequence they all need, so
no producer drifts from it:

1. establish the duration (``audio_duration_probe``: known metadata, else the
   container header over a few Range requests);
2. admit the import on the beta budget in one conditional write: the
   transcription bounded by that duration, plus the automatic preview and
   full-text translation of the import when this operation does not hold them yet
   (rules 1 and 10 of the task-547 decision). A duration that cannot be read
   reserves the per-item ceiling, 240 minutes (rule 3); one above it is refused as
   ``item_too_large`` (rule 2);
3. on refusal, fail the job with the budget's code and tell the completion
   pipeline, so the producer only has to return without enqueueing.

The contract with the transcription worker is ``audio_duration_seconds`` in the SQS
payload: the measured duration the reservation was bounded with. The worker
claims the held attempt, and reserves any further try (a retry, the push-mode
fallback) from the same figure.

There is no "already held" exemption here any more (task-281 is applied where no
call is made, in the deduplication path): a transcription that runs is a provider
call, and every provider call is reserved and charged (R.2).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.services import audio_duration_probe, beta_budget, budget_guard
from media_summarizer.core.services.budget_guard import BudgetRefusedError, TextEstimate
from media_summarizer.utils import database_async, sqs
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)


@dataclass
class AudioGateDecision:
    """What the gate decided, and what the producer must forward downstream."""

    allowed: bool
    duration_seconds: int = 0
    refusal: Optional[BudgetRefusedError] = None

    @property
    def error_code(self) -> Optional[str]:
        return self.refusal.error_code if self.refusal is not None else None

    @property
    def failure_code(self) -> MediaFailureCode:
        """The failure code written on the refused job.

        The gate runs in a worker, long after the request that produced the item
        is over, so it cannot negotiate a language: it writes a code and the app
        renders it in the reader's own language.
        """
        if self.refusal is None:
            return MediaFailureCode.BUDGET_UNAVAILABLE
        return self.refusal.failure_code


async def resolve_audio_duration_seconds(
    *,
    known_duration_seconds: int = 0,
    audio_bytes: Optional[bytes] = None,
    audio_url: Optional[str] = None,
    probe_budget_seconds: float = audio_duration_probe.DEFAULT_PROBE_BUDGET_SECONDS,
) -> int:
    """Best available duration for a submission, or 0 when unobtainable.

    Cheapest source first: a duration the platform already told us (feed
    metadata, extractor output), then the local bytes, then an HTTP Range probe
    on the remote URL. Returning 0 is a valid answer and means "accept anyway,
    reserve the per-item ceiling, settle on what Deepgram bills".
    """
    if known_duration_seconds and known_duration_seconds > 0:
        return int(known_duration_seconds)

    if audio_bytes:
        local = audio_duration_probe.probe_duration_seconds_from_bytes(audio_bytes)
        if local:
            return local

    if audio_url:
        remote = await audio_duration_probe.probe_duration_seconds_from_url(
            audio_url, budget_seconds=probe_budget_seconds
        )
        if remote:
            return remote

    return 0


async def _publish_failure_event(
    *,
    job_id: str,
    media_key: Optional[str],
    reason: str,
) -> None:
    """Tell the completion pipeline the job is over, so clients stop waiting.

    Best effort: the auto-poll worker has no events queue configured and nobody
    is waiting on a screen for those items.
    """
    queue_name = os.environ.get("EPISODE_COMPLETED_EVENTS_QUEUE")
    if not queue_name:
        return
    try:
        await sqs.send_message(
            queue_name=queue_name,
            message_body={
                "event_type": "episode_completion_status",
                "status": "failure",
                "media_key": media_key,
                "canonical_job_id": job_id,
                "reason": reason,
            },
        )
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "event.publish_failed",
            "Failed to publish budget refusal event",
            job_id=job_id,
            media_key=media_key,
            exc_info=exc,
        )


async def gate_audio_transcription(
    *,
    job_id: str,
    user_id: Optional[str],
    job: Any = None,
    media_key: Optional[str] = None,
    audio_url: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    known_duration_seconds: int = 0,
    content_language: Optional[str] = None,
    error_step: str = "budget_admission",
    probe_budget_seconds: float = audio_duration_probe.DEFAULT_PROBE_BUDGET_SECONDS,
    mark_job_failed: bool = True,
) -> AudioGateDecision:
    """Admit a transcription on the beta budget, right before a Deepgram enqueue.

    The import is held under the operation of the save (``budget_guard.
    import_operation_id``): the job's library row, or the job itself when it has
    none. On refusal the job is marked failed with the budget's code and a failure
    event is published, so the caller only has to return without enqueueing.

    Without a ``user_id`` there is nobody whose budget bounds the call: refused,
    never let through (rule 9).
    """
    source_platform = getattr(job, "source_platform", None)
    duration_seconds = await resolve_audio_duration_seconds(
        known_duration_seconds=known_duration_seconds,
        audio_bytes=audio_bytes,
        audio_url=audio_url,
        probe_budget_seconds=probe_budget_seconds,
    )
    operation_id = budget_guard.import_operation_id(job) or job_id
    measured = float(duration_seconds) if duration_seconds > 0 else None

    try:
        await budget_guard.admit_import(
            user_id or "",
            operation_id=operation_id,
            acquisition=lambda ctx: [beta_budget.transcription_line(ctx, duration_seconds=measured)],
            text=TextEstimate(duration_seconds=measured),
            media_item_id=getattr(job, "media_item_id", None),
            content_language=content_language,
        )
    except BudgetRefusedError as refusal:
        decision = AudioGateDecision(allowed=False, duration_seconds=duration_seconds, refusal=refusal)
        log_event(
            logger,
            logging.INFO,
            "budget.audio_gate_refused",
            "Transcription refused by the beta budget before any provider spend",
            job_id=job_id,
            user_id=user_id,
            source_platform=source_platform,
            duration_seconds=duration_seconds,
            error_code=refusal.error_code,
        )
        if mark_job_failed:
            await _fail_job(
                job=job,
                job_id=job_id,
                media_key=media_key,
                decision=decision,
                error_step=error_step,
            )
        return decision

    log_event(
        logger,
        logging.INFO,
        "budget.audio_gate_admitted",
        "Transcription admitted on the beta budget",
        job_id=job_id,
        user_id=user_id,
        media_key=media_key,
        operation_id=operation_id,
        source_platform=source_platform,
        duration_seconds=duration_seconds,
        measured=measured is not None,
    )
    return AudioGateDecision(allowed=True, duration_seconds=duration_seconds)


async def _fail_job(
    *,
    job: Any,
    job_id: str,
    media_key: Optional[str],
    decision: AudioGateDecision,
    error_step: str,
) -> None:
    reason = decision.error_code or decision.failure_code.value
    try:
        target_job = job or await database_async.get_processing_job_by_id(job_id)
        if target_job:
            target_job.mark_failed(
                error_code=decision.failure_code,
                error_step=error_step,
                error_metadata={
                    "reason": reason,
                    "duration_seconds": decision.duration_seconds,
                },
            )
            await database_async.update_processing_job(target_job)
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "budget.gate_job_update_failed",
            "Could not mark the job failed after a budget refusal",
            job_id=job_id,
            exc_info=exc,
        )
    await _publish_failure_event(job_id=job_id, media_key=media_key, reason=reason)
