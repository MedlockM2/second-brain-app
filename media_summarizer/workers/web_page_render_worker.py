"""
Web page render worker: a page read in a browser, with the videos it embeds.

The API (`ArticleResolver`) and the RSS article worker hand a page here when its
served HTML is not enough (`core/web_page.inspect_static_html`): the text is drawn
by JavaScript, or the page embeds videos whose words belong to it.

Pipeline:
- Consumes messages from WEB_PAGE_RENDER_QUEUE
- Renders the page in headless Chromium (`infrastructure/web_render/chromium_renderer`)
- Extracts the text from the rendered DOM with trafilatura, the same extractor as
  a static article, so both paths agree on what a page's text is
- Finds the videos in the rendered DOM, its frames and the JSON its scripts loaded
- Downloads each video's audio with yt-dlp into AUDIO_BUCKET
- No video kept: stores the text as an article transcript and completes the job
- Videos kept: writes a plan to TRANSCRIPT_BUCKET, admits their transcription on
  the beta budget, and hands the job to the Deepgram worker, which transcribes
  each video under its own budget part and assembles page + videos into one
  sectioned Markdown transcript (`deepgram_worker._process_web_page`)

The browser lives in this worker's own image (lambda-web-render.Dockerfile); the
shared worker image carries none.
"""

from __future__ import annotations

import html as html_lib
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List

from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.ingestion_failures import (
    PermanentIngestionFailure,
    TransientIngestionFailure,
)
from media_summarizer.core.ports.article_content import ArticleFetchError
from media_summarizer.core.services import audio_quota_gate, budget_guard
from media_summarizer.core.services.budget_guard import BudgetRefusedError
from media_summarizer.core.services.transcript_formatting import count_paragraphs
from media_summarizer.core.web_page import (
    EmbeddedVideo,
    dedupe_videos,
    video_from_url,
    videos_in_html,
    videos_in_json,
)
from media_summarizer.infrastructure.resolvers.trafilatura_article_resolver import (
    extract_clean_text,
    extract_page_metadata,
)
from media_summarizer.infrastructure.web_render.chromium_renderer import (
    PageRenderError,
    render_page,
)
from media_summarizer.infrastructure.web_render.video_audio import (
    VideoAudioUnavailable,
    fetch_video_audio,
)
from media_summarizer.utils import database_async, s3, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)
from media_summarizer.workers.ingestion_failures import apify_failure_code

logger = logging.getLogger(__name__)

WEB_PAGE_RENDER_QUEUE = required_env("WEB_PAGE_RENDER_QUEUE")
TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")
AUDIO_BUCKET = required_env("AUDIO_BUCKET")
DEEPGRAM_TRANSCRIPTION_QUEUE = required_env("DEEPGRAM_TRANSCRIPTION_QUEUE")
EPISODE_COMPLETED_EVENTS_QUEUE = required_env("EPISODE_COMPLETED_EVENTS_QUEUE")

#: At most this many videos are transcribed per page, in page order, and no more
#: than this much audio in all: a page is read for what it says, and its budget
#: admission has to stay one a reader would expect for one saved link.
MAX_VIDEOS_PER_PAGE = int(os.environ.get("WEB_PAGE_MAX_VIDEOS", "5"))
MAX_TOTAL_VIDEO_SECONDS = int(os.environ.get("WEB_PAGE_MAX_TOTAL_VIDEO_SECONDS", "3600"))

_STEP = "web_page_render"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def collect_videos(*, html: str, frame_urls: List[str], media_urls: List[str], json_payloads: List[Any]) -> List[EmbeddedVideo]:
    """Every video the rendered page carries, first seen first, deduplicated."""
    found: List[EmbeddedVideo] = list(videos_in_html(html))
    for url in [*frame_urls, *media_urls]:
        video = video_from_url(url)
        if video:
            found.append(video)
    for payload in json_payloads:
        found.extend(videos_in_json(payload))
    videos = dedupe_videos(found)
    # In the order a reader meets them: a video found in the page's data rather
    # than its DOM is placed where its title is drawn, when it is drawn at all.
    # `sorted` is stable, so the rest keep the order they were found in.
    page_text = html_lib.unescape(html)

    def position(video: EmbeddedVideo) -> int:
        at = page_text.find(video.title) if video.title else -1
        return at if at >= 0 else len(page_text)

    return sorted(videos, key=position)


def _render_failure(exc: PageRenderError) -> Exception:
    if exc.retryable:
        return TransientIngestionFailure(
            MediaFailureCode.PROVIDER_UNAVAILABLE, details=f"render_{exc.details}", http_status=exc.status
        )
    if exc.status in (401, 403):
        code = MediaFailureCode.SOURCE_ACCESS_BLOCKED
    elif exc.status:
        code = MediaFailureCode.MEDIA_UNAVAILABLE
    else:
        code = MediaFailureCode.ARTICLE_TEXT_NOT_FOUND
    return PermanentIngestionFailure(code, details=f"render_{exc.details}", http_status=exc.status)


async def _fetch_videos(
    *, job_id: str, videos: List[EmbeddedVideo], referer: str
) -> List[Dict[str, Any]]:
    """Download each video's audio to AUDIO_BUCKET; the plan entries of those kept."""
    kept: List[Dict[str, Any]] = []
    total_seconds = 0.0
    for video in videos:
        if len(kept) >= MAX_VIDEOS_PER_PAGE:
            break
        try:
            if video.provider == "youtube":
                # YouTube asks every Lambda address to sign in (task-309): yt-dlp
                # cannot fetch it from here, and trying costs seconds per video.
                raise VideoAudioUnavailable("youtube_blocked_from_lambda")
            audio = await fetch_video_audio(video, referer=referer)
        except VideoAudioUnavailable as exc:
            log_event(
                logger,
                logging.WARNING,
                "web_page.video_skipped",
                "Embedded video left out of the page",
                job_id=job_id,
                video_provider=video.provider,
                video_id=video.video_id,
                reason=exc.reason,
            )
            continue
        try:
            seconds = audio.duration_seconds or 0.0
            if total_seconds + seconds > MAX_TOTAL_VIDEO_SECONDS:
                log_event(
                    logger,
                    logging.WARNING,
                    "web_page.video_skipped",
                    "Embedded video left out: the page's audio ceiling is reached",
                    job_id=job_id,
                    video_provider=video.provider,
                    video_id=video.video_id,
                    reason="total_duration_ceiling",
                )
                continue
            part = f"video-{len(kept) + 1}"
            ext = os.path.splitext(audio.file_path)[1] or ".bin"
            key = f"{job_id}.{part}{ext}"
            await s3.upload_file(
                bucket=AUDIO_BUCKET,
                key=key,
                file_path=audio.file_path,
                content_type=audio.content_type,
            )
            total_seconds += seconds
            kept.append(
                {
                    "part": part,
                    "audio_s3_key": key,
                    "content_mime_type": audio.content_type,
                    "duration_seconds": int(round(seconds)) if seconds else None,
                    "title": audio.title or video.title,
                    "provider": video.provider,
                    "url": video.url,
                    "thumbnail_url": audio.thumbnail_url,
                }
            )
        finally:
            shutil.rmtree(os.path.dirname(audio.file_path), ignore_errors=True)
    return kept


async def _complete_text_only(
    *, job: Any, body: Dict[str, Any], text: str, source_url: str, render_meta: Dict[str, Any]
) -> None:
    """A page without a video: stored as an article, its text admitted on the budget."""
    try:
        await budget_guard.admit_import(
            job.user_id or "",
            operation_id=budget_guard.import_operation_id(job),
            text=budget_guard.TextEstimate(text_bytes=len(text.encode("utf-8"))),
            media_item_id=job.media_item_id,
        )
    except BudgetRefusedError as refusal:
        raise PermanentIngestionFailure(
            apify_failure_code(refusal.refusal.value), details="budget_refused"
        ) from refusal

    transcript_s3_key = f"{job.id}.txt"
    await s3.upload_file_object(
        bucket=TRANSCRIPT_BUCKET,
        key=transcript_s3_key,
        file_obj=BytesIO(text.encode("utf-8")),
        content_type="text/plain",
        metadata={"content-type": "text/plain", "job-type": "article-transcription", "provider": "web-page-render"},
    )
    transcription_metadata = {
        "provider": "article_extractor",
        "model_used": "chromium+trafilatura",
        "language": None,
        "segments_count": count_paragraphs(text),
        "source_url": source_url,
        "transcribed_at": _now_iso(),
    }
    job.set_transcription_location(transcript_s3_key)
    job.set_transcription_metadata(transcription_metadata)
    job.extraction_metadata = render_meta
    job.mark_completed()
    await database_async.update_processing_job(job)
    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": body.get("media_key") or job.media_key,
            "canonical_job_id": job.id,
            "transcription_s3_key": transcript_s3_key,
            "transcription_metadata": transcription_metadata,
        },
    )


async def process_web_page_message(body: Dict[str, Any]) -> None:
    job_id = body.get("job_id")
    url = (body.get("normalized_url") or "").strip()
    if not isinstance(job_id, str) or not job_id.strip() or not url:
        raise PermanentIngestionFailure(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_job_or_url")

    job = await database_async.get_processing_job_by_id(job_id)
    if job is None:
        raise PermanentIngestionFailure(MediaFailureCode.INVALID_JOB_MESSAGE, details="processing_job_not_found")
    if job.is_terminal_state():
        log_event(logger, logging.INFO, "worker.redelivery_ignored", "Web page job already settled", job_id=job_id)
        return
    job.mark_extracting()
    await database_async.update_processing_job(job)

    try:
        rendered = await render_page(url)
    except PageRenderError as exc:
        raise _render_failure(exc) from exc

    try:
        text = extract_clean_text(rendered.html)
    except ArticleFetchError:
        text = ""
    title, creator_name, cover_url = extract_page_metadata(rendered.html, requested_url=rendered.final_url)
    videos = collect_videos(
        html=rendered.html,
        frame_urls=rendered.frame_urls,
        media_urls=rendered.media_urls,
        json_payloads=rendered.json_payloads,
    )
    log_event(
        logger,
        logging.INFO,
        "web_page.rendered",
        "Web page read in a browser",
        job_id=job_id,
        char_count=len(text),
        video_count=len(videos),
        video_providers=sorted({video.provider for video in videos}),
        render_reasons=body.get("render_reasons") or [],
    )

    if title:
        job.title = title
    if creator_name:
        job.creator_name = creator_name
    if cover_url and not job.media_image:
        job.media_image = cover_url
    render_meta = {
        "extractor": "chromium+trafilatura",
        "extractor_version": "v1",
        "requested_url": url,
        "final_url": rendered.final_url,
        "http_status": rendered.status,
        "fetched_at": _now_iso(),
        "char_count": len(text),
        "word_count": len(text.split()),
        "paragraph_count": count_paragraphs(text) if text else 0,
        "title": title,
        "render_reasons": body.get("render_reasons") or [],
        "videos_found": len(videos),
    }

    kept = await _fetch_videos(job_id=job_id, videos=videos, referer=rendered.final_url) if videos else []
    render_meta["videos_kept"] = len(kept)

    if not kept:
        if not text:
            raise PermanentIngestionFailure(MediaFailureCode.ARTICLE_TEXT_NOT_FOUND, details="rendered_page_empty")
        await _complete_text_only(job=job, body=body, text=text, source_url=rendered.final_url, render_meta=render_meta)
        log_event(
            logger,
            logging.INFO,
            "transcription.completed",
            "Rendered web page stored",
            job_id=job_id,
            transcript_source="article_extractor",
        )
        return

    job.extraction_metadata = render_meta
    await database_async.update_processing_job(job)

    plan_s3_key = f"{job_id}.web_page.json"
    plan = {"page": {"title": title, "text": text, "source_url": rendered.final_url}, "videos": kept}
    await s3.upload_file_object(
        bucket=TRANSCRIPT_BUCKET,
        key=plan_s3_key,
        file_obj=BytesIO(json.dumps(plan, ensure_ascii=False).encode("utf-8")),
        content_type="application/json",
        metadata={"content-type": "application/json"},
    )

    parts = [(entry["part"], int(entry["duration_seconds"] or 0)) for entry in kept]
    gate = await audio_quota_gate.gate_audio_transcription(
        job_id=job_id,
        user_id=job.user_id,
        job=job,
        media_key=body.get("media_key") or job.media_key,
        known_duration_seconds=sum(seconds for _, seconds in parts),
        error_step=_STEP,
        voice_parts=parts,
    )
    if not gate.allowed:
        # The gate failed the job and published the event; only the audio is left.
        for entry in kept:
            try:
                await s3.delete_object(AUDIO_BUCKET, entry["audio_s3_key"])
            except Exception:  # noqa: BLE001 - the account sweep still covers it
                pass
        return

    await sqs.send_message(
        queue_name=DEEPGRAM_TRANSCRIPTION_QUEUE,
        message_body={
            "job_id": job_id,
            "user_id": job.user_id,
            "user_email": body.get("user_email"),
            "media_key": body.get("media_key") or job.media_key,
            "normalized_url": url,
            "episode_title": title,
            "web_page_plan_s3_key": plan_s3_key,
            "audio_duration_seconds": gate.duration_seconds,
            "deepgram_mode": "push",
        },
    )
    log_event(
        logger,
        logging.INFO,
        "transcription.enqueued",
        "Web page videos sent to transcription",
        job_id=job_id,
        queue=DEEPGRAM_TRANSCRIPTION_QUEUE,
        transcript_source="deepgram",
        video_count=len(kept),
        audio_duration_seconds=gate.duration_seconds,
    )


async def process_message(message: Dict[str, Any]) -> None:
    """Lambda entry: failures are settled by `sqs_delivery` (retry, or fail the job)."""
    try:
        body = json.loads(message.get("Body") or "{}")
    except ValueError as exc:
        raise PermanentIngestionFailure(MediaFailureCode.INVALID_JOB_MESSAGE, details="invalid_json") from exc
    token = bind_log_context(
        job_id=body.get("job_id"),
        media_item_id=body.get("job_id"),
        queue=WEB_PAGE_RENDER_QUEUE,
        provider="chromium",
        transcript_source="article_extractor",
    )
    try:
        await process_web_page_message(body)
    finally:
        reset_log_context(token)
