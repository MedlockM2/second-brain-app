"""Arm the full-text translation at ingestion, not at first read (task-414).

Until task-414 the only trigger of a transcript translation was
``GET /api/media/{id}/raw-content``: a media processed weeks ago and opened for
the first time from the Digest still showed "Translation in progress…" for the
60-90 s the translation takes. The translation now starts when the ingestion
finishes, for the reading language of every account that saved the media, so it
is ready by the time anyone opens it.

What this is **not**: the blocking prewarm that task-203 removed. That one
``await``-ed the translation inside each ingestion worker before
``job.mark_completed()`` and timed out on every long transcript. Here:

- the caller is the completion-events consumer
  (``workers/events/media_completed_worker.py``), which runs *after* the
  ingestion worker has uploaded the transcript, completed its job and published
  the event — the ingestion job waits on nothing;
- the work is one S3 read at most (only when the source gave no language tag),
  a local ``langdetect`` pass, and per target language one conditional
  ``PutItem`` plus one ``SendMessage``. The translation itself runs in
  ``transcript_translation_worker``, exactly as a lazy one would.

The enqueue goes through
:func:`~media_summarizer.core.services.transcript_translation.reserve_and_dispatch_translation`,
the same atomic reservation ``/raw-content`` uses. A redelivered completion
event, or a reader polling ``/raw-content`` while this runs, reads the existing
lock and enqueues nothing: the task-203 anti-thundering-herd guarantee holds
across both triggers.

Targets come from the immutable reading language of every saved library row
(task-545), not from account preferences at completion time. The search worker
also arms a missing translation when a deduplicated save needs a new language.
Every caller resolves the source through the content ledger.

Beta budget (task-549, rule 10 of the task-547 decision): each language is charged
to the first save that reads in it — the submitter's import first, which reserved
the translation with its acquisition, then the watchers' saves, which reserve it
when the call is made. When the submitter's own translation turns out unnecessary
(the text is already in its language, its language cannot be established, or
another save already owns that translation), the part its import reserved is
handed back (``not_needed``).
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Dict, Iterable, Optional

from media_summarizer.core.models import ProcessingJob
from media_summarizer.core.models.beta_budget import Component
from media_summarizer.core.services import budget_guard
from media_summarizer.core.services.transcript_translation import (
    TRANSCRIPT_BUCKET,
    TranslationDispatchOutcome,
    TranslationPayer,
    detect_language,
    job_source_language_hint,
    normalize_language_tag,
    reserve_and_dispatch_translation,
    should_translate,
)
from media_summarizer.utils import s3, user_media
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

TRIGGER_INGESTION = "ingestion"


class IngestionTranslationSkip(str, Enum):
    """Why no translation was dispatched for a target language. Stable, logged values."""

    #: The transcript is already in this language (or the target is outside the
    #: V1 languages): nothing to translate, ever.
    NOT_NEEDED = "not_needed"
    #: The transcript language could not be established (no source tag, empty
    #: text, or the transcript could not be read). ``/raw-content`` decides again
    #: at read time from the same inputs.
    LANGUAGE_UNKNOWN = "language_unknown"


IngestionTranslationResult = TranslationDispatchOutcome | IngestionTranslationSkip


async def arm_transcript_translations(
    *,
    job: ProcessingJob,
    user_ids: Iterable[str],
    transcript_s3_key: Optional[str] = None,
) -> Dict[str, IngestionTranslationResult]:
    """Enqueue the translation each saver's reading language will need.

    ``user_ids`` are the accounts that saved this media during its ingestion — the
    submitter and every watcher whose save was folded into the same job. Their
    saves' captured reading languages are deduplicated, so three French readers cost one
    reservation, not three.

    Returns the result per target language (empty when nobody has a reading
    language). Never raises for a per-language failure: the dispatch gate already
    turns those into outcomes, and the caller is a completion hook whose message
    must still be deleted.
    """
    key = (getattr(job, "transcription_s3_key", None) or transcript_s3_key or "").strip()
    submitter = TranslationPayer(
        user_id=job.user_id or "",
        operation_id=budget_guard.import_operation_id(job),
    )
    if not key:
        await _release_submitter_translation(submitter)
        return {}

    targets = await _reading_languages(
        user_ids, job.media_key or "", import_save_id=submitter.operation_id
    )
    if not targets:
        await _release_submitter_translation(submitter)
        return {}

    source_hint = job_source_language_hint(job)
    source = getattr(job, "source_platform", None) or None
    detected_language, detection_method = await _detect_transcript_language(
        transcript_s3_key=key,
        source_hint=source_hint,
    )

    results: Dict[str, IngestionTranslationResult] = {}
    submitter_dispatched = False
    for target, payer in targets.items():
        if detected_language is None:
            results[target] = IngestionTranslationSkip.LANGUAGE_UNKNOWN
        elif not should_translate(detected_language, target):
            results[target] = IngestionTranslationSkip.NOT_NEEDED
        else:
            results[target] = await reserve_and_dispatch_translation(
                media_key=job.media_key or "",
                transcript_s3_key=key,
                target_language=target,
                source_language_hint=source_hint,
                source=source,
                job_id=getattr(job, "id", None),
                trigger=TRIGGER_INGESTION,
                payer=payer,
            )
            if payer == submitter and results[target] == TranslationDispatchOutcome.ENQUEUED:
                submitter_dispatched = True
    if not submitter_dispatched:
        await _release_submitter_translation(submitter)

    log_event(
        logger,
        logging.INFO,
        "translation.ingestion_armed",
        "Transcript translations armed at ingestion",
        job_id=getattr(job, "id", None),
        transcript_s3_key=key,
        source=source,
        detected_language=detected_language,
        detection_method=detection_method,
        results={target: result.value for target, result in results.items()},
    )
    return results


async def _reading_languages(
    user_ids: Iterable[str], media_key: str, *, import_save_id: str
) -> Dict[str, TranslationPayer]:
    """Languages captured by these saves, each with the first save that reads in it.

    In the order of ``user_ids`` — the submitter first, and among its saves the one
    this ingestion imported (``import_save_id``) — so a language the submitter
    reads in is charged to the import that reserved it.
    """
    languages: Dict[str, TranslationPayer] = {}
    for user_id in dict.fromkeys(u for u in user_ids if u):
        records = await user_media.list_for_user_by_media_key(user_id, media_key)
        for record in sorted(
            records,
            key=lambda r: (r.media_item_id != import_save_id, str(r.saved_at or "")),
        ):
            language = normalize_language_tag(record.reading_language)
            if language and language not in languages:
                languages[language] = TranslationPayer(
                    user_id=user_id, operation_id=record.media_item_id
                )
    return languages


async def _release_submitter_translation(submitter: TranslationPayer) -> None:
    """The submitter's import reserved a translation no call will use."""
    await budget_guard.release_held(
        submitter.user_id, submitter.operation_id, Component.TRANSLATION
    )


async def _detect_transcript_language(
    *,
    transcript_s3_key: str,
    source_hint: Optional[str],
) -> tuple[Optional[str], str]:
    """Same detection ``/raw-content`` runs, so both triggers decide alike.

    A reliable source tag answers without reading the transcript; only when there
    is none is the text downloaded and classified locally (free, deterministic).
    """
    if normalize_language_tag(source_hint):
        return detect_language("", source_hint=source_hint)
    try:
        raw_bytes = await s3.download_file_to_memory(
            bucket=TRANSCRIPT_BUCKET,
            key=transcript_s3_key,
        )
    except Exception as exc:  # noqa: BLE001 - the lazy path will decide at read time
        log_event(
            logger,
            logging.WARNING,
            "translation.ingestion_transcript_read_failed",
            "Could not read the transcript to detect its language",
            transcript_s3_key=transcript_s3_key,
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        return None, "unknown"
    return detect_language(
        (raw_bytes or b"").decode("utf-8", errors="replace"),
        source_hint=None,
    )
