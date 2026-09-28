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

The target is the owner's reading language, read the way the ingestion-time
``review_blurb`` reads it (``review_blurb_service._reading_language``). The
transcript key is the canonical content job's, because that is the key
``/raw-content`` resolves through the content ledger for every account.
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Dict, Iterable, List, Optional

from media_summarizer.core.models import ProcessingJob
from media_summarizer.core.services.transcript_translation import (
    TRANSCRIPT_BUCKET,
    TranslationDispatchOutcome,
    detect_language,
    job_source_language_hint,
    normalize_language_tag,
    reserve_and_dispatch_translation,
    should_translate,
)
from media_summarizer.utils import database_async, s3
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
    reading languages are deduplicated, so three French readers cost one
    reservation, not three.

    Returns the result per target language (empty when nobody has a reading
    language). Never raises for a per-language failure: the dispatch gate already
    turns those into outcomes, and the caller is a completion hook whose message
    must still be deleted.
    """
    key = (getattr(job, "transcription_s3_key", None) or transcript_s3_key or "").strip()
    if not key:
        return {}

    targets = await _reading_languages(user_ids)
    if not targets:
        return {}

    source_hint = job_source_language_hint(job)
    source = getattr(job, "source_platform", None) or None
    detected_language, detection_method = await _detect_transcript_language(
        transcript_s3_key=key,
        source_hint=source_hint,
    )

    results: Dict[str, IngestionTranslationResult] = {}
    for target in targets:
        if detected_language is None:
            results[target] = IngestionTranslationSkip.LANGUAGE_UNKNOWN
        elif not should_translate(detected_language, target):
            results[target] = IngestionTranslationSkip.NOT_NEEDED
        else:
            results[target] = await reserve_and_dispatch_translation(
                transcript_s3_key=key,
                target_language=target,
                source_language_hint=source_hint,
                source=source,
                job_id=getattr(job, "id", None),
                trigger=TRIGGER_INGESTION,
            )

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


async def _reading_languages(user_ids: Iterable[str]) -> List[str]:
    """Distinct normalized reading languages of these accounts, in first-seen order.

    An account that cannot be read, or has no reading language, contributes
    nothing: ``/raw-content`` would not translate for it either.
    """
    languages: List[str] = []
    for user_id in dict.fromkeys(u for u in user_ids if u):
        try:
            user = await database_async.get_user_by_id(user_id)
        except Exception as exc:  # noqa: BLE001 - one unreadable account skips itself
            log_event(
                logger,
                logging.WARNING,
                "translation.ingestion_user_read_failed",
                "Could not read the saver's reading language; skipping this account",
                user_id=user_id,
                error_type=type(exc).__name__,
            )
            continue
        language = normalize_language_tag(getattr(user, "reading_language", None))
        if language and language not in languages:
            languages.append(language)
    return languages


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
