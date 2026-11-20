"""
Queue-first Facebook ingestion worker (TASK-636).

Every public Facebook link -- reel, video, ``/watch``, ``fb.watch``, the app's
share links, page/profile/group posts, ``permalink.php``, ``story.php``, a lone
photo -- is read through Apify, with or without the page the browser extension
sent: Facebook shows AWS a login wall and does not even resolve its share links
there. Why these actors is in `infrastructure/facebook_apify.py`.

Pipeline, one Apify run at a time, each finishing through the Apify webhook:

- **Video** (``facebook_link_kind`` says so at submission):
  ``neuro-scraper`` first; a failed run, or one without an audio or video URL,
  starts ``lance_api``. The audio goes to Deepgram in ``push`` mode like an
  Instagram reel (Meta's CDN refuses Deepgram's own fetch). No comments.
- **Post**: ``apify/facebook-posts-scraper``. A lone photo answers with the post
  it belongs to, and the actor is run again on that post. A video post goes down
  the video path with the post's text as its caption. Any other post reads its
  comments with ``thedoor`` (replies included, ``APIFY_FACEBOOK_MAX_COMMENTS``),
  then its images go through the shared OCR chain (`workers/post_images.py`) and
  the whole is stored as one text (`resolvers/discussion_text.py`).
- ``apify_backstop``: no callback within the deadline, the import fails.

Beta budget (task-549): the first run is admitted with the import, its preview
and translation deferred to the transcription (video) or to the OCR admission
(post). Each run is closed on its callback at what it really cost -- the larger
of ``usageTotalUsd`` and its charged events at the barème (rule of TASK-633) --
settled when it delivered what the next step uses, released as operator spend
when it did not. Fallback, second photo read and comments are counted alike.

A content that is not public, was deleted, or that no actor could read fails the
import with an existing code; the reader is not told why (the detail is in the
logs and the job's error metadata).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlsplit

from media_summarizer.core.media_ingestion.adapters.classifiers import (
    FACEBOOK_VIDEO,
    facebook_link_kind,
)
from media_summarizer.core.media_ingestion.domain import MediaType
from media_summarizer.core.media_ingestion.title_derivation import first_sentence, select_title
from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.ingestion_failures import IngestionFailure
from media_summarizer.core.models.processing_job import ProcessingJob
from media_summarizer.core.services import audio_quota_gate, beta_budget, budget_guard, cover_capture
from media_summarizer.core.services.budget_guard import BudgetRefusedError, TextEstimate
from media_summarizer.core.services.document_parsing_service import record_document_pool_spend
from media_summarizer.core.services.transcript_formatting import (
    count_paragraphs,
    normalize_transcript_text,
)
from media_summarizer.infrastructure import apify_adapter, facebook_apify
from media_summarizer.infrastructure.apify_adapter import ApifyActorKind
from media_summarizer.infrastructure.resolvers.discussion_text import (
    DiscussionComment,
    render_discussion,
)
from media_summarizer.utils import database_async, s3, sqs
from media_summarizer.utils.deepgram_dispatch import enqueue_deepgram_transcription
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)
from media_summarizer.workers import apify_orchestration, post_images
from media_summarizer.workers.ingestion_failures import apify_failure_code
from media_summarizer.workers.sqs_delivery import is_last_delivery

logger = logging.getLogger(__name__)

TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")
FACEBOOK_INGESTION_QUEUE = required_env("FACEBOOK_INGESTION_QUEUE")
EPISODE_COMPLETED_EVENTS_QUEUE = required_env("EPISODE_COMPLETED_EVENTS_QUEUE")

SOURCE_PLATFORM = "facebook"
ERROR_STEP = "facebook_ingestion"
#: Facebook's own captions are kept as metadata only, and a processing job is one
#: DynamoDB item: the head is enough to know what Facebook had.
_FACEBOOK_TRANSCRIPT_KEPT_CHARS = 2000
#: The most items read from a comments run: the cap plus room for the replies the
#: actor adds beyond it.
_MAX_COMMENT_ITEMS = facebook_apify.MAX_COMMENTS * 2 + 100


class FacebookIngestionError(IngestionFailure):
    """Failure of a Facebook import, named by a stable code."""


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------


async def _start_run(
    *,
    job: ProcessingJob,
    kind: ApifyActorKind,
    url: str,
    context: Dict[str, Any],
    first: bool,
) -> Dict[str, Any]:
    """Start one actor on ``url`` and return without waiting for it."""
    actor_id = apify_adapter.configured_actor_id(kind)
    stored = {key: value for key, value in context.items() if key not in ("message_type", "apify_run_id", "apify_status")}
    stored["job_id"] = job.id
    stored["target_url"] = url
    try:
        run = await apify_orchestration.start_run_for_job(
            job=job,
            kind=kind,
            source_platform=SOURCE_PLATFORM,
            input_data=facebook_apify.actor_input(kind.value, url),
            queue_name=FACEBOOK_INGESTION_QUEUE,
            context=stored,
            replace_active_run=not first,
            # The audio length or the post's size is only known after the run:
            # the preview and the translation are admitted then.
            defer_automatic=True,
            bound_results=facebook_apify.bound_items(kind.value),
        )
    except apify_adapter.ApifyAdapterError as exc:
        raise FacebookIngestionError(
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
        "Facebook Apify run started",
        job_id=job.id,
        apify_actor_id=actor_id,
        apify_actor_kind=kind.value,
        apify_run_id=run.run_id,
    )
    return {"mode": "apify_pending", "job_id": job.id, "apify_actor_id": actor_id}


async def _read_items(*, job: ProcessingJob, succeeded: bool, max_items: int) -> List[Dict[str, Any]]:
    if not succeeded:
        return []
    try:
        return await apify_adapter.fetch_dataset_items(
            source_platform=SOURCE_PLATFORM,
            dataset_id=job.apify_dataset_id or "",
            max_items=max_items,
            # One run, one result on the shared pool, whatever the comment count.
            pool_units=1,
        )
    except apify_adapter.ApifyAdapterError as exc:
        if exc.retryable:
            raise FacebookIngestionError(
                apify_failure_code(exc.code), details=exc.code, retryable=True, provider="apify"
            ) from exc
        return []


async def _close_run(
    *, job: ProcessingJob, context: Dict[str, Any], run_id: str, items_read: int, delivered: bool
) -> beta_budget.MeasuredCost:
    """Close this run on the budget at its real cost and add it to the import's account."""
    actor_id = job.apify_actor_id or ""
    cost = await apify_orchestration.measured_run_cost(
        source_platform=SOURCE_PLATFORM, actor_id=actor_id, run_id=run_id, items_read=items_read
    )
    await budget_guard.close_apify_collection(
        job.user_id,
        budget_guard.import_operation_id(job),
        actor_id=actor_id,
        cost=cost,
        delivered=delivered,
        content_media_key=job.media_key,
    )
    context["apify_actors"] = [*context.get("apify_actors", []), actor_id]
    context["apify_cost_usd"] = str(Decimal(str(context.get("apify_cost_usd") or "0")) + cost.usd)
    return cost


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


async def process_facebook_message(message_body: Dict[str, Any]) -> Dict[str, Any]:
    message_type = str(message_body.get("message_type") or "ingest")
    job_id = str(message_body.get("job_id") or "").strip()
    if not job_id:
        raise FacebookIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_job_id")
    job = await database_async.get_processing_job_by_id(job_id)
    if not job:
        raise FacebookIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="processing_job_not_found")

    if message_type == "apify_backstop":
        expired = await apify_orchestration.expire_backstop(
            job_id=job_id,
            run_id=str(message_body.get("apify_run_id") or ""),
            source_platform=SOURCE_PLATFORM,
        )
        if expired:
            await _publish_failure(job_id, message_body.get("media_key") or expired.media_key, "apify_callback_deadline_exceeded")
        return {"mode": "apify_backstop", "job_id": job_id}

    if message_type == "apify_callback":
        run_id = str(message_body.get("apify_run_id") or "").strip()
        status = str(message_body.get("apify_status") or "").upper()
        claimed = await apify_orchestration.claim_callback(job_id, run_id)
        if not claimed:
            return {"mode": "apify_callback_ignored", "job_id": job_id}
        return await _on_callback(job=claimed, run_id=run_id, succeeded=status == "SUCCEEDED")

    normalized_url = str(message_body.get("normalized_url") or "").strip()
    if not normalized_url:
        raise FacebookIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_normalized_url")
    split = urlsplit(normalized_url)
    kind = facebook_link_kind(
        host=(split.hostname or "").lower(),
        path=(split.path or "/").lower(),
        query_params=parse_qs(split.query, keep_blank_values=True),
    )
    job.mark_extracting()
    await database_async.update_processing_job(job)
    context = {**message_body, "facebook_kind": kind}
    first_kind = ApifyActorKind.FACEBOOK_VIDEO if kind == FACEBOOK_VIDEO else ApifyActorKind.FACEBOOK_POST
    return await _start_run(job=job, kind=first_kind, url=normalized_url, context=context, first=True)


async def _on_callback(*, job: ProcessingJob, run_id: str, succeeded: bool) -> Dict[str, Any]:
    context = dict(job.apify_context or {})
    role = job.apify_actor_kind or ""
    target_url = str(context.get("target_url") or context.get("normalized_url") or "")

    if role in (ApifyActorKind.FACEBOOK_VIDEO.value, ApifyActorKind.FACEBOOK_VIDEO_FALLBACK.value):
        items = await _read_items(job=job, succeeded=succeeded, max_items=10)
        video = facebook_apify.video_from_items(role, items)
        await _close_run(job=job, context=context, run_id=run_id, items_read=len(items), delivered=video is not None)
        _log_run(job, run_id, succeeded, found=video is not None)
        if video is not None:
            return await _complete_video(job=job, context=context, video=video)
        if role == ApifyActorKind.FACEBOOK_VIDEO.value:
            return await _start_run(
                job=job, kind=ApifyActorKind.FACEBOOK_VIDEO_FALLBACK, url=target_url, context=context, first=False
            )
        raise _unreadable("apify_facebook_no_video", succeeded)

    if role == ApifyActorKind.FACEBOOK_POST.value:
        items = await _read_items(job=job, succeeded=succeeded, max_items=10)
        lookup = facebook_apify.post_from_items(items, requested_url=target_url)
        delivered = lookup.post is not None or lookup.container_url is not None
        await _close_run(job=job, context=context, run_id=run_id, items_read=len(items), delivered=delivered)
        _log_run(job, run_id, succeeded, found=delivered)
        if lookup.container_url and not context.get("photo_container_read"):
            # A lone photo: its text, link and comments are the post's.
            context["photo_container_read"] = True
            return await _start_run(
                job=job, kind=ApifyActorKind.FACEBOOK_POST, url=lookup.container_url, context=context, first=False
            )
        post = lookup.post
        if post is None:
            raise _unreadable("apify_facebook_no_post", succeeded)
        context["post"] = asdict(post)
        if post.video_url:
            return await _start_run(
                job=job, kind=ApifyActorKind.FACEBOOK_VIDEO, url=post.video_url, context=context, first=False
            )
        if post.comments_total == 0:
            return await _complete_post(job=job, context=context, post=post, comments=[], comments_read=False)
        return await _start_run(
            job=job, kind=ApifyActorKind.FACEBOOK_COMMENTS, url=post.url, context=context, first=False
        )

    if role == ApifyActorKind.FACEBOOK_COMMENTS.value:
        items = await _read_items(job=job, succeeded=succeeded, max_items=_MAX_COMMENT_ITEMS)
        comments = facebook_apify.comments_from_items(items)
        # The comments are a part of the post: without them, the post is still read.
        await _close_run(job=job, context=context, run_id=run_id, items_read=len(items), delivered=bool(comments))
        _log_run(job, run_id, succeeded, found=bool(comments))
        post = facebook_apify.FacebookPost(**context["post"])
        return await _complete_post(job=job, context=context, post=post, comments=comments, comments_read=True)

    raise FacebookIngestionError(MediaFailureCode.INVALID_JOB_MESSAGE, details="unknown_apify_actor_kind", apify_actor_kind=role)


def _unreadable(details: str, succeeded: bool) -> FacebookIngestionError:
    """No actor could read the link: not public, deleted, or the actors failed."""
    return FacebookIngestionError(
        MediaFailureCode.MEDIA_UNAVAILABLE if succeeded else MediaFailureCode.PROVIDER_UNAVAILABLE,
        details=details,
        provider="apify",
    )


def _log_run(job: ProcessingJob, run_id: str, succeeded: bool, *, found: bool) -> None:
    log_event(
        logger,
        logging.INFO,
        "apify.run_read",
        "Facebook Apify run read",
        job_id=job.id,
        apify_actor_id=job.apify_actor_id,
        apify_actor_kind=job.apify_actor_kind,
        apify_run_id=run_id,
        run_succeeded=succeeded,
        content_found=found,
    )


def _extraction_metadata(context: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    return {
        "source_platform": SOURCE_PLATFORM,
        "extractor": "facebook_ingestion_worker",
        "extractor_version": "v1",
        "provider": "apify",
        "source_url": context.get("normalized_url"),
        "facebook_kind": context.get("facebook_kind"),
        "apify_actors": context.get("apify_actors", []),
        "apify_cost_usd": context.get("apify_cost_usd"),
        "resolved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **extra,
    }


# ---------------------------------------------------------------------------
# A video: to Deepgram
# ---------------------------------------------------------------------------


async def _complete_video(
    *, job: ProcessingJob, context: Dict[str, Any], video: facebook_apify.FacebookVideo
) -> Dict[str, Any]:
    post = context.get("post") or {}
    # A video reached through its post is captioned by the post's text.
    caption = post.get("text") or video.caption or None
    creator = post.get("group") or post.get("author") or video.owner_name
    title = select_title([first_sentence(caption)], authors=[creator])
    job.extraction_metadata = _extraction_metadata(
        context,
        resolved_url=video.media_url,
        transcript_source="deepgram_pending",
        # Read by the artifact corpus as the source description (task-383).
        resolver_metadata={
            "caption": caption,
            "owner_name": creator,
            "published": video.published or post.get("published"),
            "duration_seconds": video.duration_seconds,
            "media_url_kind": video.media_url_kind,
            "canonical_url": video.canonical_url,
            "facebook_transcript": (video.facebook_transcript or "")[:_FACEBOOK_TRANSCRIPT_KEPT_CHARS] or None,
        },
    )
    job.media_url = video.media_url
    job.media_type = MediaType.SHORT_VIDEO.value
    if title:
        job.title = title
    if creator:
        job.creator_name = creator
    # Meta's CDN URLs are signed and expire within days: the cover is re-hosted.
    cover = await cover_capture.capture_from_url(source_url=video.cover_url or post.get("cover_url"), media_item_id=job.media_item_id)
    if cover:
        job.media_image = cover
    job.mark_transcribing()
    if not await apify_orchestration.complete_callback(job):
        return {"mode": "apify_callback_ignored", "job_id": job.id}

    duration = int(video.duration_seconds or 0)
    user_id = str(context.get("user_id") or job.user_id or "")
    media_key = str(context.get("media_key") or job.media_key or "")
    gate = await audio_quota_gate.gate_audio_transcription(
        job_id=job.id,
        user_id=user_id,
        job=job,
        media_key=media_key,
        known_duration_seconds=duration,
        error_step=ERROR_STEP,
    )
    if not gate.allowed:
        return {"mode": "quota_refused", "job_id": job.id, "error_code": gate.error_code}

    # Meta's CDN refuses Deepgram's own fetch: the Deepgram worker downloads the
    # bytes and posts them itself, as for an Instagram reel.
    await enqueue_deepgram_transcription(
        job_id=job.id,
        audio_url=video.media_url,
        deepgram_mode="push",
        source_platform=SOURCE_PLATFORM,
        media_key=media_key,
        user_id=user_id,
        user_email=context.get("user_email"),
        normalized_url=context.get("normalized_url"),
        episode_title=job.title,
        podcast_title=job.title,
        audio_duration_seconds=gate.duration_seconds or duration,
        resolver_key="facebook.default",
    )
    log_event(
        logger,
        logging.INFO,
        "transcription.enqueued",
        "Facebook video queued for Deepgram (push mode)",
        job_id=job.id,
        media_item_id=job.id,
        media_url_kind=video.media_url_kind,
        apify_cost_usd=context.get("apify_cost_usd"),
    )
    return {"mode": "deepgram_queue", "job_id": job.id}


# ---------------------------------------------------------------------------
# A post: its text, link, images and comments as one text
# ---------------------------------------------------------------------------


def _post_text(
    post: facebook_apify.FacebookPost, image_sections: List[str], comments: List[DiscussionComment]
) -> str:
    sections = [post.text]
    if post.link_url:
        sections.append(f"[{post.link_title}]({post.link_url})" if post.link_title else post.link_url)
    sections.extend(f"## Image {index}\n\n{text}" for index, text in enumerate(image_sections, start=1))
    return render_discussion(
        title=None,
        context=(post.group, post.author, post.published),
        sections=sections,
        comments=comments,
        total=post.comments_total,
    )


async def _complete_post(
    *,
    job: ProcessingJob,
    context: Dict[str, Any],
    post: facebook_apify.FacebookPost,
    comments: List[DiscussionComment],
    comments_read: bool,
) -> Dict[str, Any]:
    user_id = str(context.get("user_id") or job.user_id or "")
    image_urls = post.image_urls[: post_images.POST_IMAGE_PARSE_MAX_IMAGES]
    without_images = _post_text(post, [], comments)
    try:
        # The post's images, one page each, with its preview and translation sized
        # on the text already read (rule 10, second admission).
        await post_images.admit_post_images(
            job=job,
            user_id=user_id,
            image_count=len(image_urls),
            text=TextEstimate(text_bytes=len(without_images.encode("utf-8")), embedded_images=len(image_urls)),
        )
        started = time.monotonic()
        parsed = (
            await post_images.parse_post_images(job=job, job_id=job.id, user_id=user_id, image_urls=image_urls)
            if image_urls
            else post_images.PostImageText()
        )
    except BudgetRefusedError as refusal:
        raise FacebookIngestionError(refusal.failure_code, details=refusal.error_code) from refusal
    parse_seconds = int(time.monotonic() - started)
    if parsed.images_parsed:
        await record_document_pool_spend(
            job_id=job.id,
            document_format=parsed.document_format,
            page_count=parsed.images_parsed,
            provider=parsed.provider or "",
            llamaparse_pages=parsed.llamaparse_pages,
        )

    markdown = _post_text(post, parsed.sections, comments)
    if not markdown.strip():
        for done in parsed.delivered:
            await done.release()
        raise FacebookIngestionError(MediaFailureCode.POST_TEXT_EMPTY, details="facebook_post_no_text")

    shown_comments = sum(1 for comment in comments if comment.body.strip())
    text = normalize_transcript_text(markdown, source="article")
    transcript_s3_key = f"{job.id}.txt"
    try:
        await s3.upload_file_object(
            bucket=TRANSCRIPT_BUCKET,
            key=transcript_s3_key,
            file_obj=BytesIO(text.encode("utf-8")),
            content_type="text/plain",
            metadata={"content-type": "text/plain", "job-type": "facebook-post", "provider": "apify_facebook"},
        )
    except BaseException:
        # The images are parsed and billed; a redelivery would pay them again.
        for done in parsed.delivered:
            await done.release()
        raise
    transcription_metadata = {
        "provider": "apify_facebook",
        "model_used": job.apify_actor_id,
        "segments_count": count_paragraphs(text),
        "source_url": context.get("normalized_url"),
        "image_count": len(post.image_urls),
        "images_parsed": parsed.images_parsed,
    }
    title = select_title([first_sentence(post.text)], authors=[post.creator_name])
    if title:
        job.title = title
    if post.creator_name:
        job.creator_name = post.creator_name
    cover = await cover_capture.capture_from_url(source_url=post.cover_url, media_item_id=job.media_item_id)
    if cover:
        job.media_image = cover
    job.extraction_metadata = _extraction_metadata(
        context,
        transcript_source="facebook_post",
        resolved_url=post.url,
        comments_fetched=shown_comments,
        comments_total=post.comments_total,
        comments_read=comments_read,
        image_count=len(post.image_urls),
        images_parsed=parsed.images_parsed,
    )
    job.set_transcription_location(transcript_s3_key)
    job.set_transcription_metadata(transcription_metadata)
    if parsed.images_parsed:
        job.set_processing_duration("transcription", parse_seconds)
    job.mark_completed()
    if not await apify_orchestration.complete_callback(job):
        return {"mode": "apify_callback_ignored", "job_id": job.id}
    for done in parsed.delivered:
        await done.settle()

    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": context.get("media_key") or job.media_key,
            "canonical_job_id": job.id,
            "transcription_s3_key": transcript_s3_key,
            "transcription_metadata": transcription_metadata,
        },
    )
    log_event(
        logger,
        logging.INFO,
        "transcription.completed",
        "Facebook post stored",
        job_id=job.id,
        media_item_id=job.id,
        comments_fetched=shown_comments,
        comments_total=post.comments_total,
        images_parsed=parsed.images_parsed,
        apify_cost_usd=context.get("apify_cost_usd"),
    )
    return {"mode": "post_completed", "job_id": job.id}


# ---------------------------------------------------------------------------
# Failure
# ---------------------------------------------------------------------------


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


async def _mark_failed(body: Dict[str, Any], error: FacebookIngestionError) -> None:
    job_id = body.get("job_id")
    if not job_id:
        return
    job = await database_async.get_processing_job_by_id(job_id)
    if not job or job.is_terminal_state():
        return
    if job.apify_state == "processing":
        job.apify_state = "processed"
        job.apify_completed_at = datetime.now(timezone.utc)
    job.mark_failed(
        error_code=error.code,
        error_step=ERROR_STEP,
        error_metadata=error.error_metadata(step=ERROR_STEP),
    )
    await database_async.update_processing_job(job)
    await _publish_failure(job_id, body.get("media_key") or job.media_key, error.reason)


async def process_message(message: Dict[str, Any]) -> None:
    try:
        body: Dict[str, Any] = json.loads(message.get("Body", "{}"))
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "worker.invalid_message",
            "Invalid JSON in Facebook ingestion message",
            queue=FACEBOOK_INGESTION_QUEUE,
            exc_info=exc,
        )
        return

    context_token = bind_log_context(
        job_id=body.get("job_id"),
        media_item_id=body.get("job_id"),
        queue=FACEBOOK_INGESTION_QUEUE,
        resolver_key=body.get("resolver_key") or "facebook.default",
        source_platform=SOURCE_PLATFORM,
        provider="apify",
    )
    last_delivery = is_last_delivery(message)
    try:
        result = await process_facebook_message(body)
        log_event(
            logger,
            logging.INFO,
            "apify.orchestration",
            "Facebook ingestion advanced",
            job_id=result["job_id"],
            media_item_id=result["job_id"],
            orchestration_mode=result["mode"],
        )
    except FacebookIngestionError as exc:
        if exc.retryable and not last_delivery:
            raise
        await _mark_failed(body, exc)
        log_event(
            logger,
            logging.ERROR,
            "transcription.failed",
            "Facebook ingestion failed",
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            error_code=exc.code.value,
            detail=exc.details,
            exc_info=exc,
        )
    except Exception as exc:
        if not last_delivery:
            raise
        final = FacebookIngestionError(
            MediaFailureCode.UNEXPECTED_ERROR,
            details="unexpected_exception",
            exception_type=type(exc).__name__,
        )
        await _mark_failed(body, final)
        log_event(
            logger,
            logging.ERROR,
            "transcription.failed",
            "Facebook ingestion failed after retries",
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            error_code=final.code.value,
            exc_info=exc,
        )
    finally:
        reset_log_context(context_token)
