"""
Queue-first Instagram ingestion worker.

This is the only place Instagram resolution runs (task-274). The API used to
resolve inline, which could not work: yt-dlp plus, on an IP block, an Apify run
measured at 63-100 s never fit the 30 s ceiling API Gateway imposes on the
request, so every save timed out with nothing persisted while the actor run was
billed and discarded.

Pipeline:
- Consumes messages from INSTAGRAM_INGESTION_QUEUE
- Resolves content via InstagramApifyResolver (yt-dlp first, Apify Reel/Post
  Scrapers on an IP block)
- For reels: enqueues a Deepgram transcription job pointing at the resolved
  audio URL (or video URL fallback) with deepgram_mode="push" -- Instagram CDNs
  block Deepgram's pull, so the Deepgram worker downloads the bytes and posts
  them itself. Carries the derived title (task-266), and nothing descriptive: the caption stays on the job, under
  extraction_metadata.resolver_metadata.caption, which is where the artifact
  corpus reads it (task-383).
- Image posts (single and carousel): every image of the post is downloaded on the
  Apify callback and OCR'd through the shared parsing chain
  (`workers/post_images.py`, LlamaParse then Unstructured).
  The concatenated text is the transcript, one section per image, and the job
  completes like any other source. When no image yields a word, the caption
  becomes the transcript instead (task-384).
- Fails terminally when no audio URL is available.
- Marks the processing job as extracting/transcribing along the way.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional

from media_summarizer.core.media_ingestion.domain import (
    ClassifiedUrl,
    IngestUrlCommand,
    IngestUrlRequest,
    MediaFamily,
    MediaType,
    ResolveContext,
    ResolvedMedia,
    SourcePlatform,
    UserContext,
)
from media_summarizer.core.media_ingestion.errors import NonRetryableProviderResolutionError
from media_summarizer.core.media_ingestion.source_description import (
    SOURCE_DESCRIPTION_IN_TRANSCRIPT_KEY,
    normalize_source_description,
)
from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.ingestion_failures import IngestionFailure
from media_summarizer.core.models.processing_job import ProcessingJob
from media_summarizer.core.services import (
    audio_quota_gate,
    cover_capture,
)
from media_summarizer.core.services.budget_guard import BudgetRefusedError
from media_summarizer.core.services.document_parsing_service import (
    record_document_pool_spend,
)
from media_summarizer.core.services.transcript_formatting import (
    count_paragraphs,
    normalize_transcript_text,
)
from media_summarizer.infrastructure import apify_adapter
from media_summarizer.infrastructure.apify_adapter import ApifyActorKind
from media_summarizer.infrastructure.resolvers.instagram_apify_resolver import (
    InstagramApifyRequired,
    InstagramApifyResolver,
    InstagramContentType,
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

INSTAGRAM_INGESTION_QUEUE = required_env("INSTAGRAM_INGESTION_QUEUE")
EPISODE_COMPLETED_EVENTS_QUEUE = required_env("EPISODE_COMPLETED_EVENTS_QUEUE")
# Shared by the API and every worker (`modules/platform/runtime_env.tf`), so the
# Instagram Lambda already had it: the transcript of a photo post lands in the
# same bucket, under the same key shape, as every other source.
TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")

class InstagramIngestionError(IngestionFailure):
    """An Instagram ingestion failure. See `IngestionFailure` for the shape."""


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _build_resolve_context(
    *,
    normalized_url: str,
    media_key: str,
    user_id: str,
) -> ResolveContext:
    """Build a minimal ResolveContext for the InstagramApifyResolver."""
    return ResolveContext(
        command=IngestUrlCommand(
            user=UserContext(user_id=user_id, user_email=""),
            request=IngestUrlRequest(url=normalized_url),
        ),
        normalized_url=normalized_url,
        media_key=media_key,
        classification=ClassifiedUrl(
            media_family=MediaFamily.SOCIAL_VIDEO,
            source_platform=SourcePlatform.INSTAGRAM,
            resolver_key="instagram.default",
        ),
    )


def _build_extraction_metadata(
    *,
    source_url: str,
    download_url: Optional[str] = None,
    content_type: Optional[str] = None,
    transcript_source: Optional[str] = None,
    resolver_metadata: Optional[Dict[str, Any]] = None,
    last_error_code: Optional[str] = None,
    failure_details: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "source_platform": "instagram",
        "extractor": "instagram_ingestion_worker",
        "extractor_version": "v2",
        "provider": "apify",
        "source_url": source_url,
        "resolved_url": download_url,
        "instagram_content_type": content_type,
        "transcript_source": transcript_source,
        "resolver_metadata": resolver_metadata,
        "last_error_code": last_error_code,
        "failure_details": failure_details,
        "resolved_at": _now_iso_utc(),
    }


def _build_image_transcript(sections: List[str]) -> str:
    """The text of the images as one transcript, one section per image.

    A single image is its own transcript with no heading: there is no second
    section to tell it apart from. From two images up, each one is titled by its
    rank in the carousel, so the reader tab and every prompt built on the text keep
    the order the author published the slides in.
    """
    if len(sections) == 1:
        return sections[0]
    return "\n\n".join(
        f"## Image {index}\n\n{section}" for index, section in enumerate(sections, start=1)
    )


async def _upload_image_transcript(job_id: str, text: str) -> str:
    """Store the post's text under the job's key, as markdown.

    `.md` is not decoration: `raw_content_service._detect_source_format` reads the
    extension and leaves markdown untouched, which is what preserves the headings
    the parsers produced and the section per image added above.
    """
    transcript_s3_key = f"{job_id}.md"
    await s3.upload_file_object(
        bucket=TRANSCRIPT_BUCKET,
        key=transcript_s3_key,
        file_obj=BytesIO(text.encode("utf-8")),
        content_type="text/markdown",
        metadata={
            "content-type": "text/markdown",
            "job-type": "instagram-image-post",
        },
    )
    return transcript_s3_key


async def _publish_failure_event(
    *,
    job_id: Optional[str],
    media_key: Optional[str],
    reason: str,
) -> None:
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


async def _mark_job_failed(
    *,
    job_id: Optional[str],
    normalized_url: str,
    error: InstagramIngestionError,
) -> None:
    if not job_id:
        return

    job = await database_async.get_processing_job_by_id(job_id)
    if not job:
        return

    job.extraction_metadata = _build_extraction_metadata(
        source_url=normalized_url,
        last_error_code=error.code.value,
        failure_details=error.details,
    )
    job.extraction_metadata["failed_at"] = _now_iso_utc()
    if job.apify_state == "processing":
        job.apify_state = "processed"
        job.apify_completed_at = datetime.now(timezone.utc)
    job.mark_failed(
        error_code=error.code,
        error_step="instagram_ingestion",
        error_metadata=error.error_metadata(step="instagram_ingestion"),
    )
    await database_async.update_processing_job(job)


async def _complete_image_post(
    *,
    job: ProcessingJob,
    job_id: str,
    message_type: str,
    media_key: str,
    user_id: str,
    normalized_url: str,
    resolved: ResolvedMedia,
) -> Dict[str, Any]:
    """Finish a photo post: OCR its images, or fall back to its caption.

    Three outcomes, and only the third is a failure:

    1. **Some image yielded text.** That text is the transcript, one section per
       image. The caption is *not* copied into it -- it travels as the source
       description (task-383), which the artifact corpus already reads from
       `extraction_metadata.resolver_metadata.caption` and lays out in its own
       block. Copying it here would put the same paragraph twice in every prompt,
       and would show it inside the reader tab, which displays the transcript
       verbatim.
    2. **No image yielded text, but there is a caption.** A sunset gives OCR
       nothing, and a job cannot complete on an empty transcript
       (`artifact_service._load_transcript_bytes` refuses one). The caption becomes
       the body, and the description is suppressed for this job so the same text is
       not served twice.
    3. **Neither.** Terminal failure, under the code that says which of the two
       happened.

    The images are admitted on the beta budget before the first is parsed, one
    page each, with the post's preview and translation (`post_images.admit_post_images`);
    a refusal fails the import. Each image delivered is settled on its billed
    page once the transcript is stored; an image that never reached a provider
    (an unreachable slide, the time budget spent) is released by the completion
    pipeline, which closes every step of the import still held.
    """
    resolver_metadata = resolved.metadata or {}
    resolved_content_type = resolver_metadata.get("instagram_content_type")
    image_urls = [
        url.strip()
        for url in (resolver_metadata.get("image_urls") or [])
        if isinstance(url, str) and url.strip()
    ]
    caption = normalize_source_description(resolver_metadata.get("caption"))

    extraction_metadata = _build_extraction_metadata(
        source_url=normalized_url,
        content_type=resolved_content_type,
        transcript_source="instagram_image_ocr",
        resolver_metadata=resolver_metadata,
    )
    job.extraction_metadata = extraction_metadata
    # The title, the account name and the cover exist for the same reason and at
    # the same moment as on a reel: the resolver has just run. The cover is the
    # first image of the post, re-hosted rather than hotlinked because Instagram's
    # signed CDN URLs 403 within days (task-302 §5.1).
    if resolved.title:
        job.title = resolved.title
    if resolved.creator_name:
        job.creator_name = resolved.creator_name
    cover_locator = await cover_capture.capture_from_url(
        source_url=resolved.cover_url,
        media_item_id=job.media_item_id,
    )
    if cover_locator:
        job.media_image = cover_locator

    try:
        await post_images.admit_post_images(
            job=job,
            user_id=user_id,
            image_count=min(len(image_urls), post_images.POST_IMAGE_PARSE_MAX_IMAGES),
        )
        started = time.monotonic()
        parsed = await post_images.parse_post_images(
            job=job, job_id=job_id, user_id=user_id, image_urls=image_urls
        )
    except BudgetRefusedError as refusal:
        raise InstagramIngestionError(
            refusal.failure_code,
            details=refusal.error_code,
            instagram_content_type=resolved_content_type,
        ) from refusal
    parse_duration = int(time.monotonic() - started)

    # N images is N pages of the shared LlamaParse pool, keyed on the job id so a
    # re-claimed callback cannot count twice (the operator's pool, TASK-557).
    if parsed.images_parsed:
        await record_document_pool_spend(
            job_id=job_id,
            document_format=parsed.document_format,
            page_count=parsed.images_parsed,
            provider=parsed.provider or "",
            llamaparse_pages=parsed.llamaparse_pages,
        )

    if parsed.sections:
        transcript_text = _build_image_transcript(parsed.sections)
        transcript_source = "instagram_image_ocr"
        provider = parsed.provider or "llamaparse"
    elif caption:
        transcript_text = normalize_transcript_text(caption, source="instagram")
        transcript_source = "instagram_caption"
        provider = "instagram_caption"
        extraction_metadata[SOURCE_DESCRIPTION_IN_TRANSCRIPT_KEY] = True
        log_event(
            logger,
            logging.INFO,
            "media.ingest.image_post_caption_only",
            "No image yielded text; the caption becomes the transcript",
            job_id=job_id,
            media_item_id=job_id,
            image_count=len(image_urls),
            images_parsed=parsed.images_parsed,
        )
        # The OCR found nothing usable: the caption is the text, and the parses
        # that answered with some delivered nothing (rule 5).
        for done in parsed.delivered:
            await done.release()
        parsed.delivered = []
    else:
        # Nothing readable and nothing written: the two ways that happens get the
        # two codes the app already words. `only_empty_results` means the providers
        # answered and found no text (a photo with no legible words); anything else
        # means the chain itself failed on every image -- our outage, not the post.
        raise InstagramIngestionError(
            MediaFailureCode.POST_TEXT_EMPTY
            if parsed.only_empty_results
            else MediaFailureCode.PROVIDER_UNAVAILABLE,
            details="instagram_image_post_no_text",
            instagram_content_type=resolved_content_type,
            post_type=resolver_metadata.get("post_type"),
            image_count=len(image_urls),
            images_parsed=parsed.images_parsed,
        )

    try:
        transcript_s3_key = await _upload_image_transcript(job_id, transcript_text)
    except Exception as exc:
        for done in parsed.delivered:
            await done.release()
        # Permanent (task-573): the images are parsed and billed, and a
        # redelivery would parse and pay for every one of them again.
        raise InstagramIngestionError(
            MediaFailureCode.UNEXPECTED_ERROR,
            details="instagram_image_transcript_store_failed",
            exception_type=type(exc).__name__,
        ) from exc
    except BaseException:
        for done in parsed.delivered:
            await done.release()
        raise
    transcription_metadata = {
        "provider": provider,
        "source": transcript_source,
        "image_count": len(image_urls),
        "images_parsed": parsed.images_parsed,
        # Paragraph count, comparable across sources (task-231 §13.1).
        "segments_count": count_paragraphs(transcript_text),
        # No duration key: a photo post has none, and its absence is what makes
        # the API return no duration and the app show none.
        "source_url": normalized_url,
    }

    job.set_transcription_location(transcript_s3_key)
    job.set_transcription_metadata(transcription_metadata)
    job.set_processing_duration("transcription", parse_duration)
    # Until this line the library row described a photo post as a video, because
    # the media type was whatever submission guessed from the URL. The mirror
    # copies it across (`durable_media_service.mirror_job`).
    job.media_type = MediaType.IMAGE_POST.value
    job.mark_completed()

    if message_type == "apify_callback":
        # Same guard as the reel branch: a redelivered callback that lost the race
        # writes nothing and publishes nothing. The claim taken at the top of the
        # callback path is what keeps a second delivery from re-parsing at all.
        if not await apify_orchestration.complete_callback(job):
            return {"job_id": job_id, "routed_to": "duplicate_callback"}
    else:
        await database_async.update_processing_job(job)

    # The text is stored on its job: each image that delivered it is charged the
    # page its provider billed.
    for done in parsed.delivered:
        await done.settle()

    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": media_key,
            "canonical_job_id": job_id,
            "transcription_s3_key": transcript_s3_key,
            "transcription_metadata": transcription_metadata,
        },
    )

    log_event(
        logger,
        logging.INFO,
        "transcription.completed",
        "Instagram image post transcribed from its images",
        job_id=job_id,
        media_item_id=job_id,
        instagram_content_type=resolved_content_type,
        post_type=resolver_metadata.get("post_type"),
        image_count=len(image_urls),
        images_parsed=parsed.images_parsed,
        provider=provider,
        transcript_source=transcript_source,
        duration_seconds=parse_duration,
    )

    return {
        "job_id": job_id,
        "media_key": media_key,
        "content_type": resolved_content_type,
        "transcript_source": transcript_source,
        "routed_to": "image_post_completed",
    }


async def process_instagram_message(message_body: Dict[str, Any]) -> Dict[str, Any]:
    """Process an initial, callback, or deadline Instagram queue message."""
    message_type = str(message_body.get("message_type") or "ingest")
    job_id = (message_body.get("job_id") or "").strip()
    normalized_url = (message_body.get("normalized_url") or "").strip()
    media_key = (message_body.get("media_key") or "").strip()
    user_id = (message_body.get("user_id") or "").strip()

    if not job_id:
        raise InstagramIngestionError(
            MediaFailureCode.INVALID_JOB_MESSAGE,
            details="missing_job_id",
            message_type=message_type,
        )
    if not normalized_url:
        raise InstagramIngestionError(
            MediaFailureCode.INVALID_JOB_MESSAGE,
            details="missing_normalized_url",
            message_type=message_type,
        )

    job = await database_async.get_processing_job_by_id(job_id)
    if not job:
        raise InstagramIngestionError(
            MediaFailureCode.INVALID_JOB_MESSAGE,
            details="processing_job_not_found",
            message_type=message_type,
        )

    resolver = InstagramApifyResolver()

    if message_type == "apify_backstop":
        expired = await apify_orchestration.expire_backstop(
            job_id=job_id,
            run_id=str(message_body.get("apify_run_id") or ""),
            source_platform="instagram",
        )
        if expired:
            await _publish_failure_event(
                job_id=job_id,
                media_key=media_key or expired.media_key,
                reason="apify_callback_deadline_exceeded",
            )
        return {"job_id": job_id, "routed_to": "backstop"}

    if message_type == "apify_callback":
        run_id = str(message_body.get("apify_run_id") or "").strip()
        job = await apify_orchestration.claim_callback(job_id, run_id)
        if not job:
            return {"job_id": job_id, "routed_to": "duplicate_callback"}
        if str(message_body.get("apify_status") or "") != "SUCCEEDED":
            raise InstagramIngestionError(
                MediaFailureCode.PROVIDER_UNAVAILABLE,
                details="apify_run_not_succeeded",
                provider="apify",
                apify_status=str(message_body.get("apify_status") or "unknown"),
            )
        stored_context = dict(job.apify_context or {})
        normalized_url = str(stored_context.get("normalized_url") or "").strip()
        media_key = str(stored_context.get("media_key") or job.media_key or "").strip()
        user_id = str(stored_context.get("user_id") or job.user_id).strip()
        try:
            content_type = InstagramContentType(str(stored_context.get("instagram_content_type") or ""))
            items = await apify_adapter.fetch_dataset_items(
                source_platform="instagram",
                dataset_id=job.apify_dataset_id or "",
            )
            context = _build_resolve_context(
                normalized_url=normalized_url,
                media_key=media_key or job_id,
                user_id=user_id or "unknown",
            )
            resolved = resolver.resolve_apify_dataset(
                context=context,
                content_type=content_type,
                actor_id=job.apify_actor_id or "",
                items=items,
            )
        except apify_adapter.ApifyAdapterError as exc:
            raise InstagramIngestionError(
                apify_failure_code(exc.code),
                details=exc.code,
                retryable=exc.retryable,
                provider="apify",
                provider_detail=exc.detail or None,
            ) from exc
        except NonRetryableProviderResolutionError as exc:
            # The resolver has already named the failure from what the actor
            # answered -- an age gate, a deleted reel, a reel without its media
            # URL -- and that code is what the reader is told. Rewriting it to
            # PROVIDER_RESULT_INVALID told an age-gated reel's reader to try
            # again later.
            raise InstagramIngestionError(
                exc.code,
                details=exc.details,
                **{
                    **exc.context,
                    "provider": "apify",
                    "exception_type": type(exc).__name__,
                },
            ) from exc
        except ValueError as exc:
            raise InstagramIngestionError(
                MediaFailureCode.PROVIDER_RESULT_INVALID,
                details="apify_result_invalid",
                provider="apify",
                exception_type=type(exc).__name__,
            ) from exc
        message_body = stored_context
    else:
        job.mark_extracting()
        await database_async.update_processing_job(job)
        context = _build_resolve_context(
            normalized_url=normalized_url,
            media_key=media_key or job_id,
            user_id=user_id or "unknown",
        )
        try:
            # Always raises `InstagramApifyRequired` since task-310: Apify is
            # the only Instagram path, so the resolver classifies and hands
            # over. The assignment satisfies the `ContentResolverPort`
            # signature; only the callback continuation below produces a
            # terminal `ResolvedMedia`.
            resolved = await resolver.resolve(context)
        except InstagramApifyRequired as exc:
            kind = ApifyActorKind.INSTAGRAM_POST if exc.content_type == InstagramContentType.POST else ApifyActorKind.INSTAGRAM_REEL
            stored_context = {
                **message_body,
                "normalized_url": exc.normalized_url,
                "instagram_content_type": exc.content_type.value,
            }
            try:
                run = await apify_orchestration.start_run_for_job(
                    job=job,
                    kind=kind,
                    source_platform="instagram",
                    input_data=resolver.build_apify_input(
                        normalized_url=exc.normalized_url,
                        content_type=exc.content_type,
                    ),
                    queue_name=INSTAGRAM_INGESTION_QUEUE,
                    context=stored_context,
                    # The audio length or the image count is only known once
                    # the run has answered: the preview and the translation are
                    # admitted then, with the transcription or the OCR.
                    defer_automatic=True,
                )
            except apify_adapter.ApifyAdapterError as adapter_exc:
                raise InstagramIngestionError(
                    apify_failure_code(adapter_exc.code),
                    details=adapter_exc.code,
                    retryable=adapter_exc.retryable,
                    provider="apify",
                    provider_detail=adapter_exc.detail or None,
                    apify_actor_kind=kind.value,
                ) from adapter_exc
            return {
                "job_id": job_id,
                "media_key": media_key,
                "content_type": exc.content_type.value,
                "routed_to": "apify_webhook",
                "apify_run_id": run.run_id,
            }
        except NonRetryableProviderResolutionError as exc:
            raise InstagramIngestionError(
                exc.code,
                details=exc.details,
                exception_type=type(exc).__name__,
            ) from exc

    # Extract metadata from resolver result
    resolver_metadata = resolved.metadata or {}
    resolved_content_type = resolver_metadata.get("instagram_content_type")
    transcript_source = resolver_metadata.get("transcript_source")

    if resolved.media_type == MediaType.IMAGE_POST:
        return await _complete_image_post(
            job=job,
            job_id=job_id,
            message_type=message_type,
            media_key=media_key,
            user_id=user_id,
            normalized_url=normalized_url,
            resolved=resolved,
        )

    # The resolver returns audio_url for reels -> hand off to Deepgram in push
    # mode: Instagram CDNs block Deepgram's own fetch, so the Deepgram worker
    # downloads the bytes and posts them itself.
    if resolved.audio_url:
        duration_value = resolver_metadata.get("duration_seconds") or 0
        try:
            audio_duration_seconds = int(float(duration_value))
        except (TypeError, ValueError):
            audio_duration_seconds = 0

        extraction_metadata = _build_extraction_metadata(
            source_url=normalized_url,
            download_url=resolved.audio_url,
            content_type=resolved_content_type,
            transcript_source=transcript_source or "deepgram_pending",
            resolver_metadata=resolver_metadata,
        )
        job.extraction_metadata = extraction_metadata
        job.media_url = resolved.audio_url
        # The caption only exists once the resolver has run, and the resolver
        # runs here rather than at submission time -- so this is where the title
        # reaches the job, and through the mirror the library row (task-266).
        # Before this, the caption was resolved, logged, and dropped.
        if resolved.title:
            job.title = resolved.title
        # The account name and the cover exist for the same reason and at the
        # same moment as the caption: the resolver just ran. Instagram serves
        # signed `scontent.*.cdninstagram.com` URLs that 403 within days, so the
        # cover is re-hosted rather than stored as-is (task-302 §5.1). A failure
        # returns None and the tile falls back to its media-type icon.
        if resolved.creator_name:
            job.creator_name = resolved.creator_name
        cover_locator = await cover_capture.capture_from_url(
            source_url=resolved.cover_url,
            media_item_id=job.media_item_id,
        )
        if cover_locator:
            job.media_image = cover_locator
        job.mark_transcribing()
        if message_type == "apify_callback":
            if not await apify_orchestration.complete_callback(job):
                return {"job_id": job_id, "routed_to": "duplicate_callback"}
        else:
            await database_async.update_processing_job(job)

        # A reel is about to be transcribed by the minute like any other audio:
        # the meter follows the provider call, not the URL (task-287). This gate
        # is the last point where that Deepgram spend can still be refused, and
        # the only place it is charged -- without it a reel was transcribed for
        # free whatever the user's remaining allowance.
        gate = await audio_quota_gate.gate_audio_transcription(
            job_id=job_id,
            user_id=user_id,
            job=job,
            media_key=media_key,
            known_duration_seconds=audio_duration_seconds,
            error_step="instagram_ingestion",
        )
        if not gate.allowed:
            return {
                "job_id": job_id,
                "media_key": media_key,
                "content_type": resolved_content_type,
                "routed_to": "quota_refused",
                "error_code": gate.error_code,
            }

        await enqueue_deepgram_transcription(
            job_id=job_id,
            audio_url=resolved.audio_url,
            deepgram_mode="push",
            source_platform="instagram",
            media_key=media_key,
            user_id=user_id,
            user_email=message_body.get("user_email"),
            normalized_url=normalized_url,
            # The title the resolver derived from the caption, falling back to
            # what the API stored at submission (task-266).
            episode_title=job.title or message_body.get("episode_title"),
            podcast_title=job.title or message_body.get("podcast_title"),
            audio_duration_seconds=gate.duration_seconds or audio_duration_seconds,
            resolver_key=resolved.resolver_key,
        )

        log_event(
            logger,
            logging.INFO,
            "transcription.enqueued",
            "Instagram reel queued for Deepgram (push mode)",
            job_id=job_id,
            media_item_id=job_id,
            instagram_content_type=resolved_content_type,
            transcript_source="deepgram_pending",
            audio_url_kind=resolver_metadata.get("audio_url_kind"),
        )

        return {
            "job_id": job_id,
            "media_key": media_key,
            "content_type": resolved_content_type,
            "transcript_source": "deepgram_pending",
            "routed_to": "deepgram_queue",
        }

    # If we reach here, the resolver returned no audio URL for a video post: the
    # scraper's answer is incomplete, the post itself is a supported video.
    raise InstagramIngestionError(
        MediaFailureCode.PROVIDER_RESULT_INVALID,
        details="no_transcript_or_audio_url",
        instagram_content_type=resolved_content_type,
    )


async def process_message(message: Dict[str, Any]) -> None:
    body: Dict[str, Any] = {}

    try:
        body = json.loads(message.get("Body", "{}"))
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "worker.invalid_message",
            "Invalid JSON in Instagram ingestion message",
            queue=INSTAGRAM_INGESTION_QUEUE,
            exc_info=exc,
        )
        return

    context_token = bind_log_context(
        job_id=body.get("job_id"),
        media_item_id=body.get("job_id"),
        queue=INSTAGRAM_INGESTION_QUEUE,
        resolver_key="instagram.default",
        source_platform="instagram",
        provider="apify",
    )

    last_delivery = is_last_delivery(message)

    try:
        await process_instagram_message(body)
    except InstagramIngestionError as exc:
        should_retry = exc.retryable and not last_delivery
        if should_retry:
            raise

        await _mark_job_failed(
            job_id=body.get("job_id"),
            normalized_url=(body.get("normalized_url") or "").strip(),
            error=exc,
        )
        await _publish_failure_event(
            job_id=body.get("job_id"),
            media_key=body.get("media_key"),
            reason=exc.reason,
        )
        log_event(
            logger,
            logging.ERROR,
            "transcription.failed",
            "Instagram ingestion failed",
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            error_code=exc.code.value,
            detail=exc.details,
            # The cause carries the provider's own wording, which no longer
            # travels in `details`: this is where it stays readable.
            exc_info=exc,
        )
    except Exception as exc:
        if not last_delivery:
            raise

        final_error = InstagramIngestionError(
            MediaFailureCode.UNEXPECTED_ERROR,
            details="unexpected_exception",
            exception_type=type(exc).__name__,
        )
        await _mark_job_failed(
            job_id=body.get("job_id"),
            normalized_url=(body.get("normalized_url") or "").strip(),
            error=final_error,
        )
        await _publish_failure_event(
            job_id=body.get("job_id"),
            media_key=body.get("media_key"),
            reason=final_error.reason,
        )
        log_event(
            logger,
            logging.ERROR,
            "transcription.failed",
            "Instagram ingestion failed after retries",
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            error_code=final_error.code.value,
            exc_info=exc,
        )
    finally:
        reset_log_context(context_token)
