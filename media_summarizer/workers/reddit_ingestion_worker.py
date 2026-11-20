"""
Queue-first Reddit thread ingestion worker (TASK-633).

Every Reddit link -- shared from the phone, saved from the extension, a thread,
an ``old.reddit`` page, an app share link ``/r/<sub>/s/<code>`` or ``redd.it`` --
is read through Apify. Nothing is downloaded or rendered first: Reddit refuses
AWS addresses whatever the client (a block page for the static reader, an HTTP
4xx for the ``web-render`` Chromium), and OpenAI's ``web_search`` reads a thread
but will not copy it out. Why these two actors is in
`infrastructure/reddit_apify.py`.

Pipeline, one message type at a time:

- ``ingest``: start the primary actor (``kaix~reddit-scraper``), the whole
  thread, and return. The run calls back through the Apify webhook.
- ``apify_callback`` from the primary: a run that returned the post is stored.
  A failed run, or one without the post, starts the fallback actor
  (``automation-lab~reddit-scraper``) under the same import.
- ``apify_callback`` from the fallback: stored the same way. If it fails too,
  the page the browser extension sent, when there was one, is stored instead
  (it holds the post and the comments the page had inserted,
  `resolvers/reddit_thread.py`); without it the import fails.
- ``apify_backstop``: no callback within the deadline, the import fails.

Beta budget (task-549): the import is admitted before the primary run starts,
its collection reserved for the post and ``PRIMARY_BOUND_COMMENTS`` comments.
Each run is closed at what it really cost -- the larger of Apify's
``usageTotalUsd`` and its charged events priced at the barème -- settled when its
thread reaches the user, released as operator spend when it delivered nothing.
When the fallback runs, both runs are counted.
"""

from __future__ import annotations

import json
import logging
from io import BytesIO
from typing import Any, Dict, Optional

from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.ingestion_failures import IngestionFailure
from media_summarizer.core.models.processing_job import ProcessingJob
from media_summarizer.core.services import beta_budget, budget_guard
from media_summarizer.core.services.transcript_formatting import (
    count_paragraphs,
    normalize_transcript_text,
)
from media_summarizer.infrastructure import apify_adapter, reddit_apify
from media_summarizer.infrastructure.apify_adapter import ApifyActorKind
from media_summarizer.utils import database_async, s3, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)
from media_summarizer.workers import apify_orchestration
from media_summarizer.workers.ingestion_failures import apify_failure_code
from media_summarizer.workers.sqs_delivery import is_last_delivery

logger = logging.getLogger(__name__)

TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")
REDDIT_INGESTION_QUEUE = required_env("REDDIT_INGESTION_QUEUE")
EPISODE_COMPLETED_EVENTS_QUEUE = required_env("EPISODE_COMPLETED_EVENTS_QUEUE")

SOURCE_PLATFORM = "reddit"
#: The most dataset items read from one run: far above any thread a reader saves,
#: and a bound on the time one invocation spends paging through a dataset.
_MAX_DATASET_ITEMS = 20_000


class RedditIngestionError(IngestionFailure):
    """Failure of a Reddit import, named by a stable code."""


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------


async def _start_run(
    *,
    job: ProcessingJob,
    kind: ApifyActorKind,
    message_body: Dict[str, Any],
    replace_active_run: bool,
) -> Dict[str, Any]:
    """Start one actor on the thread and return without waiting for it."""
    normalized_url = str(message_body.get("normalized_url") or "").strip()
    actor_id = apify_adapter.configured_actor_id(kind)
    context = {
        key: value
        for key, value in message_body.items()
        if key not in ("message_type", "apify_run_id", "apify_status")
    }
    context["job_id"] = job.id
    try:
        run = await apify_orchestration.start_run_for_job(
            job=job,
            kind=kind,
            source_platform=SOURCE_PLATFORM,
            input_data=reddit_apify.actor_input(actor_id, normalized_url),
            queue_name=REDDIT_INGESTION_QUEUE,
            context=context,
            replace_active_run=replace_active_run,
            bound_results=reddit_apify.bound_items(actor_id),
        )
    except apify_adapter.ApifyAdapterError as exc:
        raise RedditIngestionError(
            apify_failure_code(exc.code),
            details=exc.code,
            retryable=exc.retryable,
            provider="apify",
            apify_actor_id=actor_id,
            provider_detail=exc.detail or None,
        ) from exc
    log_event(
        logger,
        logging.INFO,
        "apify.orchestration",
        "Reddit Apify run started",
        job_id=job.id,
        apify_actor_id=actor_id,
        apify_run_id=run.run_id,
        fallback=replace_active_run,
    )
    return {"mode": "apify_pending", "job_id": job.id, "apify_actor_id": actor_id}


async def _read_run(
    *, job: ProcessingJob, actor_id: str, run_id: str, succeeded: bool
) -> tuple[Optional[reddit_apify.ApifyRedditThread], beta_budget.MeasuredCost]:
    """The thread one run returned, if any, and what the run cost."""
    items: list[Dict[str, Any]] = []
    if succeeded:
        try:
            items = await apify_adapter.fetch_dataset_items(
                source_platform=SOURCE_PLATFORM,
                dataset_id=job.apify_dataset_id or "",
                max_items=_MAX_DATASET_ITEMS,
                # One import, one result on the shared pool, whatever the comment
                # count: the pool's unit is a result of the per-result actors.
                pool_units=1,
            )
        except apify_adapter.ApifyAdapterError as exc:
            if exc.retryable:
                raise RedditIngestionError(
                    apify_failure_code(exc.code),
                    details=exc.code,
                    retryable=True,
                    provider="apify",
                ) from exc
            items = []
    thread = reddit_apify.thread_from_items(
        items, strip_indentation=reddit_apify.rebuilds_text_from_html(actor_id)
    )
    cost = await apify_orchestration.measured_run_cost(
        source_platform=SOURCE_PLATFORM, actor_id=actor_id, run_id=run_id, items_read=len(items)
    )
    return thread, cost


# ---------------------------------------------------------------------------
# Storing the thread
# ---------------------------------------------------------------------------


async def _store_thread(
    *,
    job: ProcessingJob,
    message_body: Dict[str, Any],
    markdown: str,
    title: Optional[str],
    subreddit: Optional[str],
    extraction: Dict[str, Any],
) -> Dict[str, Any]:
    normalized_url = str(message_body.get("normalized_url") or "")
    text = normalize_transcript_text(markdown, source="article")
    transcript_s3_key = f"{job.id}.txt"
    await s3.upload_file_object(
        bucket=TRANSCRIPT_BUCKET,
        key=transcript_s3_key,
        file_obj=BytesIO(text.encode("utf-8")),
        content_type="text/plain",
        metadata={
            "content-type": "text/plain",
            "job-type": "reddit-thread",
            "provider": str(extraction.get("extractor") or "reddit"),
        },
    )
    transcription_metadata = {
        "provider": extraction.get("extractor"),
        "model_used": extraction.get("apify_actor_id") or "reddit_page",
        "segments_count": count_paragraphs(text),
        "source_url": normalized_url,
    }
    if title:
        job.title = title
    if subreddit:
        job.creator_name = subreddit
    job.set_transcription_location(transcript_s3_key)
    job.set_transcription_metadata(transcription_metadata)
    job.extraction_metadata = {
        "source_platform": SOURCE_PLATFORM,
        "extractor_version": "v1",
        "requested_url": normalized_url,
        **extraction,
    }
    job.mark_completed()
    return {"transcript_s3_key": transcript_s3_key, "transcription_metadata": transcription_metadata}


async def _complete(job: ProcessingJob, message_body: Dict[str, Any], stored: Dict[str, Any], mode: str) -> Dict[str, Any]:
    if not await apify_orchestration.complete_callback(job):
        return {"mode": "apify_callback_ignored", "job_id": job.id}
    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": message_body.get("media_key") or job.media_key,
            "canonical_job_id": job.id,
            "transcription_s3_key": stored["transcript_s3_key"],
            "transcription_metadata": stored["transcription_metadata"],
        },
    )
    await _drop_page_thread(message_body)
    return {"mode": mode, "job_id": job.id}


async def _page_thread(message_body: Dict[str, Any]) -> Optional[str]:
    key = str(message_body.get("page_thread_s3_key") or "").strip()
    if not key:
        return None
    try:
        return (await s3.download_file_to_memory(TRANSCRIPT_BUCKET, key)).decode("utf-8")
    except Exception as exc:  # noqa: BLE001 - a missing fallback is a failed import, not a crash
        log_event(
            logger,
            logging.WARNING,
            "reddit.page_thread_unreadable",
            "The page kept as the last resort could not be read",
            error_type=type(exc).__name__,
        )
        return None


async def _drop_page_thread(message_body: Dict[str, Any]) -> None:
    key = str(message_body.get("page_thread_s3_key") or "").strip()
    if not key:
        return
    try:
        await s3.delete_object(TRANSCRIPT_BUCKET, key)
    except Exception:  # noqa: BLE001 - a leftover file is harmless
        pass


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


async def process_reddit_message(message_body: Dict[str, Any]) -> Dict[str, Any]:
    message_type = str(message_body.get("message_type") or "ingest")
    job_id = str(message_body.get("job_id") or "").strip()
    if not job_id:
        raise RedditIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_job_id")
    job = await database_async.get_processing_job_by_id(job_id)
    if not job:
        raise RedditIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="processing_job_not_found")

    if message_type == "apify_backstop":
        expired = await apify_orchestration.expire_backstop(
            job_id=job_id,
            run_id=str(message_body.get("apify_run_id") or ""),
            source_platform=SOURCE_PLATFORM,
        )
        if expired:
            await _publish_failure(job_id, message_body.get("media_key") or expired.media_key, "apify_callback_deadline_exceeded")
            await _drop_page_thread(message_body)
        return {"mode": "apify_backstop", "job_id": job_id}

    if message_type == "apify_callback":
        run_id = str(message_body.get("apify_run_id") or "").strip()
        status = str(message_body.get("apify_status") or "").upper()
        claimed = await apify_orchestration.claim_callback(job_id, run_id)
        if not claimed:
            return {"mode": "apify_callback_ignored", "job_id": job_id}
        return await _on_callback(job=claimed, run_id=run_id, succeeded=status == "SUCCEEDED")

    if not str(message_body.get("normalized_url") or "").strip():
        raise RedditIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_normalized_url")
    job.mark_extracting()
    await database_async.update_processing_job(job)
    return await _start_run(job=job, kind=ApifyActorKind.REDDIT_PRIMARY, message_body=message_body, replace_active_run=False)


async def _on_callback(*, job: ProcessingJob, run_id: str, succeeded: bool) -> Dict[str, Any]:
    message_body = dict(job.apify_context or {})
    actor_id = job.apify_actor_id or ""
    fallback = reddit_apify.is_fallback_actor(actor_id)
    thread, cost = await _read_run(job=job, actor_id=actor_id, run_id=run_id, succeeded=succeeded)
    await budget_guard.close_apify_collection(
        job.user_id,
        budget_guard.import_operation_id(job),
        actor_id=actor_id,
        cost=cost,
        delivered=thread is not None,
        content_media_key=job.media_key,
    )
    log_event(
        logger,
        logging.INFO,
        "apify.run_read",
        "Reddit Apify run read",
        job_id=job.id,
        apify_actor_id=actor_id,
        apify_run_id=run_id,
        run_succeeded=succeeded,
        thread_found=thread is not None,
        comments_fetched=thread.comments_fetched if thread else 0,
        run_cost_usd=str(cost.usd),
    )

    if thread is not None:
        stored = await _store_thread(
            job=job,
            message_body=message_body,
            markdown=thread.markdown,
            title=thread.title,
            subreddit=thread.subreddit,
            extraction={
                "extractor": "apify_reddit",
                "apify_actor_id": actor_id,
                "apify_run_id": run_id,
                "apify_fallback": fallback,
                "comments_fetched": thread.comments_fetched,
                "comments_total": thread.comments_total,
                "run_cost_usd": str(cost.usd),
            },
        )
        return await _complete(job, message_body, stored, "apify_thread")

    if not fallback:
        try:
            return await _start_run(
                job=job,
                kind=ApifyActorKind.REDDIT_FALLBACK,
                message_body=message_body,
                replace_active_run=True,
            )
        except RedditIngestionError as exc:
            # A fallback that cannot start (refused by the budget, missing
            # configuration) has failed as surely as one that ran: the page is
            # next. A passing outage is retried instead.
            if exc.retryable:
                raise
            actor_id = apify_adapter.configured_actor_id(ApifyActorKind.REDDIT_FALLBACK)
            failure: RedditIngestionError = exc
    else:
        failure = RedditIngestionError(
            MediaFailureCode.PROVIDER_UNAVAILABLE,
            details="apify_reddit_no_thread",
            provider="apify",
            apify_actor_id=actor_id,
        )

    page = await _page_thread(message_body)
    if page:
        stored = await _store_thread(
            job=job,
            message_body=message_body,
            markdown=page,
            title=None,
            subreddit=None,
            extraction={
                "extractor": "reddit_page",
                "apify_actor_id": None,
                "apify_fallback": True,
                "apify_failed_actor_id": actor_id,
            },
        )
        return await _complete(job, message_body, stored, "page_thread")
    raise failure


async def _publish_failure(job_id: Optional[str], media_key: Optional[str], reason: str) -> None:
    if not job_id:
        return
    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "failure",
            "media_key": media_key,
            "canonical_job_id": job_id,
            "reason": reason,
        },
    )


async def _mark_failed(body: Dict[str, Any], error: RedditIngestionError) -> None:
    job_id = body.get("job_id")
    if not job_id:
        return
    job = await database_async.get_processing_job_by_id(job_id)
    if not job or job.is_terminal_state():
        return
    job.mark_failed(
        error_code=error.code,
        error_step="reddit_ingestion",
        error_metadata=error.error_metadata(step="reddit_ingestion"),
    )
    await database_async.update_processing_job(job)
    await _publish_failure(job_id, body.get("media_key") or job.media_key, error.reason)
    await _drop_page_thread(dict(job.apify_context or body))


async def process_message(message: Dict[str, Any]) -> None:
    try:
        body: Dict[str, Any] = json.loads(message.get("Body", "{}"))
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "worker.invalid_message",
            "Invalid JSON in Reddit ingestion message",
            queue=REDDIT_INGESTION_QUEUE,
            exc_info=exc,
        )
        return

    context_token = bind_log_context(
        job_id=body.get("job_id"),
        media_item_id=body.get("job_id"),
        queue=REDDIT_INGESTION_QUEUE,
        resolver_key=body.get("resolver_key") or "reddit.default",
        source_platform=SOURCE_PLATFORM,
        provider="apify",
    )
    last_delivery = is_last_delivery(message)
    try:
        result = await process_reddit_message(body)
        log_event(
            logger,
            logging.INFO,
            "transcription.completed" if result["mode"] in ("apify_thread", "page_thread") else "apify.orchestration",
            "Reddit ingestion advanced",
            job_id=result["job_id"],
            media_item_id=result["job_id"],
            orchestration_mode=result["mode"],
        )
    except RedditIngestionError as exc:
        if exc.retryable and not last_delivery:
            raise
        await _mark_failed(body, exc)
        log_event(
            logger,
            logging.ERROR,
            "transcription.failed",
            "Reddit ingestion failed",
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            error_code=exc.code.value,
            detail=exc.details,
            exc_info=exc,
        )
    except Exception as exc:
        if not last_delivery:
            raise
        final = RedditIngestionError(
            MediaFailureCode.UNEXPECTED_ERROR,
            details="unexpected_exception",
            exception_type=type(exc).__name__,
        )
        await _mark_failed(body, final)
        log_event(
            logger,
            logging.ERROR,
            "transcription.failed",
            "Reddit ingestion failed after retries",
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            error_code=final.code.value,
            exc_info=exc,
        )
    finally:
        reset_log_context(context_token)
