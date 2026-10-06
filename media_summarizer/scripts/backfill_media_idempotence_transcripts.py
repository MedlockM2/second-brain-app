"""Record the transcript location on the ledger rows written before task-432.

Until task-432 the location of a content's transcript lived on the processing job
row of whichever account submitted it first. Account deletion removes every job
row of the account it erases, so a media two accounts had saved lost its text the
day the first of them left. The location now lives on the ``media_idempotence``
row of the ``media_key`` — keyed on the content, carrying no user id — and that is
the only place any reader looks.

Rows written before the change carry no location, so every one of them reads as
"this content has no text" even when the object is right there. This pass closes
that, row by row, and asks the cheapest question first:

1. **The job row**, when it still exists: ``transcription_s3_key`` is exactly the
   value the ledger should carry, and ``transcription_metadata`` usually carries
   the language tag too.
2. **The transcript bucket**, listed under the job id. Transcript keys are
   ``<job_id>.<ext>``, so a job swept by its TTL years ago is no obstacle: the
   object names itself. Translated derivatives (``.translated.<lang>.``) are
   skipped — the ledger names the *source* text, and every translation is a
   derived key of it.
3. **Nothing at all.** Then the row names no text that exists. A ``processed`` row
   in that state is actively harmful: it tells every future save of that URL "done
   already, job X" and the save is persisted as ready over an object nobody can
   read. It is deleted, together with whatever its job prefix still holds, so the
   content goes back to being re-ingestable. Rows that claim nothing (``reserved``
   — in flight, ``failed`` — ended without a transcript) are left alone and
   reported: they name no location, so there is none to record.

A row whose location is found is also moved to ``processed``, through
``mark_processed`` and therefore under its usual condition: the write is refused if
the ledger has moved on to another job, so a reservation taken after this scan
started is never stamped with a dead job's outcome.

Usage:
  uv run python -m media_summarizer.scripts.backfill_media_idempotence_transcripts

Dry run by default -- every row is inspected and counted, nothing is written. Set
``MEDIA_IDEMPOTENCE_BACKFILL_APPLY=true`` to perform the writes. Re-running is
safe and cheap: a row that already carries a location is skipped on sight.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from media_summarizer.core.services import media_purge_service
from media_summarizer.utils import database_async, media_idempotence
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)

APPLY = os.environ.get("MEDIA_IDEMPOTENCE_BACKFILL_APPLY", "false").lower() == "true"

#: The marker that tells a translated derivative from the source object, exactly as
#: ``transcript_translation.build_translated_transcript_key`` writes it.
_TRANSLATED_MARKER = ".translated."

_PROCESSED = "processed"


async def _scan_ledger() -> List[Dict[str, Any]]:
    """Every ledger row. A global content ledger at V1 scale is a small table."""
    session = database_async.get_session()
    rows: List[Dict[str, Any]] = []
    async with session.resource(
        "dynamodb", region_name=database_async.AWS_REGION
    ) as dynamodb:
        table = await dynamodb.Table(media_idempotence.MEDIA_IDEMPOTENCE_TABLE)
        scan_kwargs: Dict[str, Any] = {}
        while True:
            resp = await table.scan(**scan_kwargs)
            rows.extend(resp.get("Items", []))
            last_key = resp.get("LastEvaluatedKey")
            if not last_key:
                return rows
            scan_kwargs["ExclusiveStartKey"] = last_key


async def _locate_from_job(job_id: str) -> Tuple[Optional[str], Optional[str], str]:
    """``(transcript_key, language, source)`` read off the job row, if it is there."""
    try:
        job = await database_async.get_processing_job_by_id(job_id)
    except Exception as exc:  # noqa: BLE001 - a dead job is the normal case here
        logger.warning("Could not read job %s: %s", job_id, exc)
        return None, None, "job_read_failed"
    if job is None:
        return None, None, "job_gone"
    key = (getattr(job, "transcription_s3_key", None) or "").strip()
    if not key:
        return None, None, "job_without_transcript"
    metadata = getattr(job, "transcription_metadata", None)
    language = None
    if isinstance(metadata, dict):
        for attribute in ("detected_language", "language"):
            value = metadata.get(attribute)
            if isinstance(value, str) and value.strip():
                language = value.strip()
                break
    return key, language, "job_row"


async def _locate_from_bucket(job_id: str) -> Optional[str]:
    """The source transcript object this job wrote, found by its own key prefix."""
    try:
        keys = await media_purge_service.list_prefix(
            required_env("TRANSCRIPT_BUCKET"), job_id
        )
    except Exception as exc:  # noqa: BLE001 - a listing failure is not a verdict
        logger.warning("Could not list transcripts of job %s: %s", job_id, exc)
        return None
    sources = sorted(key for key in keys if _TRANSLATED_MARKER not in key)
    if not sources:
        return None
    if len(sources) > 1:
        # One job writes one source transcript. More than one means a re-processing
        # under the same id wrote a second extension; the ledger takes the first in
        # lexicographic order so the choice is at least deterministic and visible.
        logger.warning("Job %s has several source transcripts: %s", job_id, sources)
    return sources[0]


async def backfill() -> Counter:
    outcomes: Counter = Counter()

    for row in await _scan_ledger():
        media_key = str(row.get("media_key") or "")
        status = str(row.get("status") or "").strip().lower()
        job_id = str(row.get("job_id") or "")

        if media_idempotence.transcript_s3_key_of(row):
            outcomes["skipped_already_located"] += 1
            continue
        if not job_id:
            outcomes[f"skipped_no_job_id_{status or 'unknown'}"] += 1
            print(f"{media_key}: {status or 'unknown'} with no job id, left alone")
            continue

        transcript_key, language, source = await _locate_from_job(job_id)
        if not transcript_key:
            transcript_key = await _locate_from_bucket(job_id)
            source = "bucket_listing" if transcript_key else source

        if transcript_key:
            outcomes[f"located_{source}"] += 1
            print(
                f"{media_key}: transcript {transcript_key} "
                f"(from {source}, status {status or 'unknown'})"
            )
            if APPLY:
                moved = await media_idempotence.mark_processed(
                    media_key=media_key,
                    job_id=job_id,
                    transcript_s3_key=transcript_key,
                    source_language=language,
                )
                outcomes["written" if moved else "write_refused_ledger_moved_on"] += 1
            continue

        if status != _PROCESSED:
            # Claims no transcript, so there is no location to record and nothing
            # it names to delete. `reserved` belongs to the task-390
            # reconciliation, `failed` is a legitimate terminal record.
            outcomes[f"left_alone_{status or 'unknown'}"] += 1
            continue

        print(
            f"{media_key}: processed, job {job_id}, no transcript anywhere "
            f"({source}) -- deleting the row and sweeping the job"
        )
        outcomes["deleted_naming_nothing"] += 1
        if APPLY:
            swept = await media_purge_service.purge_job_objects(job_id)
            for step, count in swept.items():
                outcomes[f"swept_{step}"] += count
            if await media_idempotence.delete_content_entry(
                media_key=media_key, job_id=job_id
            ):
                outcomes["rows_deleted"] += 1
            else:
                outcomes["delete_refused_ledger_moved_on"] += 1

    return outcomes


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    outcomes = asyncio.run(backfill())
    print()
    print("APPLY" if APPLY else "DRY RUN (set MEDIA_IDEMPOTENCE_BACKFILL_APPLY=true)")
    for name in sorted(outcomes):
        print(f"  {name}: {outcomes[name]}")


if __name__ == "__main__":
    main()
