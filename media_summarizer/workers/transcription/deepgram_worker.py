"""
Deepgram transcription worker.

Active transcription path:
- Consumes messages from DEEPGRAM_TRANSCRIPTION_QUEUE
- Reads audio_url from message payload
- Sends Deepgram a pre-recorded URL payload
- Uploads transcript to S3
- Publishes episode completion status events

Beta budget (task-549, rules 5 and 6 of the task-547 decision): every request sent
to Deepgram is one try of the import's ``transcription`` step. The first claims the
attempt the producer's gate held (``audio_quota_gate``); a retry after a transient
answer and the push-mode fallback after a pull the CDN refused each reserve their
own try, from the duration the gate measured, and are bounded by
``DEEPGRAM_API_RETRIES`` per delivery and the queue's own redeliveries. A
transcript stored on its job settles the try on the duration Deepgram reports,
to the second. Anything else releases it: at zero when Deepgram answered an error
without processing anything, at the duration it billed when the transcript was
unusable, at the bound when the request may have been processed but no answer came
back (a timeout).
"""

from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import time
from datetime import timedelta
from io import BytesIO
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple
from urllib.parse import urlsplit

import httpx

from media_summarizer.core.media_ingestion.conversation import (
    format_conversation,
    format_text_message,
    format_voice_message,
)
from media_summarizer.core.models.beta_budget import Component, MeasuredCost
from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.ingestion_failures import (
    IngestionFailure,
    PermanentIngestionFailure,
    TransientIngestionFailure,
)
from media_summarizer.core.models.processing_job import JobStatus
from media_summarizer.core.services import beta_budget, budget_guard
from media_summarizer.core.services.budget_guard import (
    BudgetBusyError,
    BudgetCall,
    BudgetRefusedError,
)
from media_summarizer.core.services.transcript_formatting import (
    count_paragraphs,
    deepgram_transcript_text,
)
from media_summarizer.utils import s3, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)

logger = logging.getLogger(__name__)


class NonRetryableDeepgramError(PermanentIngestionFailure):
    """A transcription another delivery would not change: the job fails now (task-573)."""


class DeepgramRefusedError(NonRetryableDeepgramError):
    """Deepgram answered an error status, or the request never left: nothing was
    processed, so nothing was billed (the try is released at zero)."""


class RemoteContentError(DeepgramRefusedError):
    """Raised when Deepgram cannot fetch audio from a remote URL (e.g. CDN 403).

    This is a subclass of NonRetryableDeepgramError so existing handlers still
    catch it, but the process_deepgram_message function intercepts it to attempt
    a push-mode fallback (download audio locally, then POST bytes to Deepgram).
    """


class DeepgramCreditExhaustedError(DeepgramRefusedError):
    """Deepgram answered 402: the project has no credit left for a transcription.

    Its own error, apart from the generic refusal (TASK-566): never retried, and the
    first one suspends new transcriptions until the balance is topped up (its code
    is what ``provider_failure`` reads). Deepgram documents the 402 with
    ``err_code`` ``ASR_PAYMENT_REQUIRED``
    (https://developers.deepgram.com/docs/errors); the status alone decides, so a
    renamed code still classifies.
    """

    def __init__(self, **context: Any) -> None:
        super().__init__(
            MediaFailureCode.PROVIDER_CREDITS_DEPLETED, details="deepgram_credit_exhausted", **context
        )


class RetryableDeepgramError(TransientIngestionFailure):
    """Raised for a transient Deepgram answer (429, 5xx): nothing was processed.

    A 429 is Deepgram pacing the project's concurrency, not an incident: its code
    makes ``provider_failure`` read it as a rate limit, a 5xx as transient.
    """

    def __init__(self, *, status: int, **context: Any) -> None:
        if status == 429:
            super().__init__(MediaFailureCode.PROVIDER_RATE_LIMITED, details="deepgram_rate_limited", status=status, **context)
        else:
            super().__init__(MediaFailureCode.PROVIDER_UNAVAILABLE, details="deepgram_server_error", status=status, **context)


class DeepgramAccountRefusedError(DeepgramRefusedError):
    """Deepgram answered 401: the key is refused. Suspends Deepgram until it changes."""

    def __init__(self, *, details: str, **context: Any) -> None:
        super().__init__(MediaFailureCode.PROVIDER_AUTH_FAILED, details=details, **context)


def _raise_for_account(status: int, response_text: str) -> None:
    """The two answers about our Deepgram account rather than about this audio."""
    if status == 402:
        raise DeepgramCreditExhaustedError(status=status, provider_detail=response_text[:300])
    if status == 401:
        raise DeepgramAccountRefusedError(details="deepgram_key_refused", status=status, provider_detail=response_text[:300])


TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")
AUDIO_BUCKET = required_env("AUDIO_BUCKET")
EPISODE_COMPLETED_EVENTS_QUEUE = required_env("EPISODE_COMPLETED_EVENTS_QUEUE")
DEEPGRAM_TRANSCRIPTION_QUEUE = required_env("DEEPGRAM_TRANSCRIPTION_QUEUE")

# Deepgram API configuration
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
DEEPGRAM_API_URL = os.environ.get(
    "DEEPGRAM_API_URL", "https://api.deepgram.com/v1/listen"
)
DEEPGRAM_MODEL = os.environ.get("DEEPGRAM_MODEL", "nova-3")
DEEPGRAM_TIMEOUT_SECONDS = float(os.environ.get("DEEPGRAM_TIMEOUT_SECONDS", "300"))
DEEPGRAM_API_RETRIES = int(os.environ.get("DEEPGRAM_API_RETRIES", "3"))

DEEPGRAM_DETECT_LANGUAGE = os.environ.get("DEEPGRAM_DETECT_LANGUAGE", "true").lower() == "true"
DEEPGRAM_SMART_FORMAT = os.environ.get("DEEPGRAM_SMART_FORMAT", "true").lower() == "true"
DEEPGRAM_PUNCTUATE = os.environ.get("DEEPGRAM_PUNCTUATE", "true").lower() == "true"
DEEPGRAM_PARAGRAPHS = os.environ.get("DEEPGRAM_PARAGRAPHS", "true").lower() == "true"
DEEPGRAM_UTTERANCES = os.environ.get("DEEPGRAM_UTTERANCES", "true").lower() == "true"
# Speaker diarization is a paid Deepgram add-on ($0.0020/min, i.e. +41.7% over the
# Nova-3 promotional rate), so it stays OFF by default (task-231 benchmark, owner
# decision "option B"). The transcript rendering path already handles the in-band
# "Speaker N:" labels, so enabling this flag is the only change required to ship
# speaker attribution.
DEEPGRAM_DIARIZE = os.environ.get("DEEPGRAM_DIARIZE", "false").lower() == "true"
# `diarize=true` is deprecated by Deepgram in favour of `diarize_model`, and
# sending both is rejected. Never send `diarize`.
DEEPGRAM_DIARIZE_MODEL = os.environ.get("DEEPGRAM_DIARIZE_MODEL", "v2")

# Heartbeat/visibility settings
HEARTBEAT_INTERVAL = float(os.environ.get("HEARTBEAT_INTERVAL", "60"))
DEEPGRAM_VISIBILITY_TIMEOUT = int(
    os.environ.get("DEEPGRAM_VISIBILITY_TIMEOUT", "1800")
)

# Valid deepgram_mode values declared by producer workers in the message body.
# "pull" = Deepgram fetches the URL (fail loudly on 403 -- producer misrouted)
# "push" = Lambda downloads audio and POSTs bytes to Deepgram (for CDNs that block Deepgram)
# "pull_with_push_fallback" = Try pull first, fall back to push on RemoteContentError
VALID_DEEPGRAM_MODES = ("pull", "push", "pull_with_push_fallback")

# Testing flag: when set to "1", forces the push-mode fallback path on
# pull_with_push_fallback messages by simulating a RemoteContentError on pull-mode.
# Used by E2E tests to deterministically exercise the push-mode fallback
# without depending on external CDN IP-blocking behavior.
FORCE_DEEPGRAM_PUSH_MODE = os.environ.get("FORCE_DEEPGRAM_PUSH_MODE", "").strip() == "1"


def _build_deepgram_query_params() -> Dict[str, str]:
    params = {
        "model": DEEPGRAM_MODEL,
        "detect_language": str(DEEPGRAM_DETECT_LANGUAGE).lower(),
        "smart_format": str(DEEPGRAM_SMART_FORMAT).lower(),
        "punctuate": str(DEEPGRAM_PUNCTUATE).lower(),
        "paragraphs": str(DEEPGRAM_PARAGRAPHS).lower(),
        "utterances": str(DEEPGRAM_UTTERANCES).lower(),
    }
    if DEEPGRAM_DIARIZE:
        params["diarize_model"] = DEEPGRAM_DIARIZE_MODEL
    return params


def _is_valid_http_url(value: str) -> bool:
    v = (value or "").strip().lower()
    return v.startswith("http://") or v.startswith("https://")


def _looks_like_feed_url(value: str) -> bool:
    raw = (value or "").strip().lower()
    if not raw:
        return False
    try:
        path = (urlsplit(raw).path or "").lower()
    except ValueError:
        path = raw
    return path.endswith(".rss") or path.endswith(".xml")


async def upload_transcription(transcript_s3_key: str, transcription_text: str) -> None:
    transcript_file = BytesIO(transcription_text.encode("utf-8"))
    await s3.upload_file_object(
        bucket=TRANSCRIPT_BUCKET,
        key=transcript_s3_key,
        file_obj=transcript_file,
        content_type="text/plain",
        metadata={
            "content-type": "text/plain",
            "job-type": "podcast-transcription",
            "provider": "deepgram",
            "model": DEEPGRAM_MODEL,
        },
    )
    log_event(
        logger,
        logging.DEBUG,
        "external_call.succeeded",
        "Uploaded Deepgram transcription",
        provider="s3",
        transcript_source="deepgram",
    )


async def call_deepgram_api(
    *, audio_url: str, job_id: str, log_audio_url: Optional[str] = None
) -> Dict[str, Any]:
    """Pull mode: Deepgram fetches ``audio_url`` itself.

    ``log_audio_url`` replaces ``audio_url`` in the log line and in any provider
    text carried by an error, for a URL that must not be written down -- a
    presigned S3 GET, which grants read access to the object until it expires.
    """
    if not DEEPGRAM_API_KEY:
        raise DeepgramAccountRefusedError(details="deepgram_api_key_missing")

    if not _is_valid_http_url(audio_url):
        raise DeepgramRefusedError(MediaFailureCode.INVALID_JOB_MESSAGE, details="invalid_audio_url")
    if _looks_like_feed_url(audio_url):
        # A feed, not an enclosure: the producer should have resolved it first.
        raise DeepgramRefusedError(MediaFailureCode.INVALID_JOB_MESSAGE, details="audio_url_is_feed")

    query_params = _build_deepgram_query_params()
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "application/json",
    }

    started = time.time()
    async with httpx.AsyncClient(timeout=DEEPGRAM_TIMEOUT_SECONDS) as client:
        response = await client.post(
            DEEPGRAM_API_URL,
            params=query_params,
            headers=headers,
            json={"url": audio_url},
        )

    latency_seconds = time.time() - started
    status = response.status_code
    provider_text = response.text
    if log_audio_url:
        provider_text = provider_text.replace(audio_url, log_audio_url)

    _raise_for_account(status, provider_text)
    if status in (401, 403, 400, 404, 415, 422):
        # Detect REMOTE_CONTENT_ERROR: Deepgram could not fetch the audio URL
        # (e.g. source CDN blocks cloud SaaS IPs with HTTP 403).
        # Raise RemoteContentError so callers can fall back to push-mode.
        response_text = provider_text[:500]
        if "REMOTE_CONTENT_ERROR" in response_text or (
            status == 400 and "403" in response_text
        ):
            raise RemoteContentError(
                MediaFailureCode.MEDIA_UNAVAILABLE,
                details="deepgram_remote_content_blocked",
                status=status,
                provider_detail=response_text[:300],
            )
        raise DeepgramRefusedError(
            MediaFailureCode.NO_TRANSCRIPT_AVAILABLE,
            details="deepgram_request_refused",
            status=status,
            provider_detail=response_text[:300],
        )
    if status == 429 or status >= 500:
        raise RetryableDeepgramError(status=status, provider_detail=provider_text[:300])
    if status >= 300:
        raise DeepgramRefusedError(
            MediaFailureCode.NO_TRANSCRIPT_AVAILABLE,
            details="deepgram_unexpected_status",
            status=status,
            provider_detail=provider_text[:300],
        )

    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        # Permanent: Deepgram answered 2xx, so the audio may be billed already.
        raise NonRetryableDeepgramError(
            MediaFailureCode.PROVIDER_RESULT_INVALID, details="deepgram_invalid_json"
        ) from exc

    request_id = (payload.get("metadata") or {}).get("request_id")
    log_event(
        logger,
        logging.INFO,
        "external_call.succeeded",
        "Deepgram request succeeded",
        provider="deepgram",
        transcript_source="deepgram",
        job_id=job_id,
        status=status,
        duration_ms=int(latency_seconds * 1000),
        provider_request_id=request_id,
        audio_url=log_audio_url or audio_url,
    )
    return payload


#: Validity of the presigned GET handed to Deepgram for an audio stored in our
#: bucket. Deepgram fetches the file while the prerecorded request is open, which
#: is bounded by ``DEEPGRAM_TIMEOUT_SECONDS`` (300 s by default); an hour covers
#: that with a wide margin for its own queueing, and is still short enough that a
#: URL leaking from Deepgram's side stops working the same day.
S3_AUDIO_PULL_URL_EXPIRATION = 3600


async def call_deepgram_api_on_s3_audio(*, s3_key: str, job_id: str) -> Dict[str, Any]:
    """Transcribe an audio stored in ``AUDIO_BUCKET`` in pull mode (TASK-620).

    Deepgram fetches the object over a presigned GET instead of receiving its
    bytes, so the file never sits in this Lambda's memory: an upload may be up to
    250 MB (``MAX_AUDIO_UPLOAD_SIZE_BYTES``) and the function has 512 MB. The
    bucket has no policy restricting where a GET comes from and is SSE-S3
    encrypted, so a presigned URL is enough for Deepgram to read it. The URL is
    never logged: ``s3://bucket/key`` stands in for it.
    """
    presigned_url = await s3.generate_presigned_url(
        AUDIO_BUCKET, s3_key, expiration=S3_AUDIO_PULL_URL_EXPIRATION, http_method="GET"
    )
    return await call_deepgram_api(
        audio_url=presigned_url,
        job_id=job_id,
        log_audio_url=f"s3://{AUDIO_BUCKET}/{s3_key}",
    )


# Maximum audio file size for push-mode fallback (250 MB).
# Larger files should not be held in Lambda memory.
_PUSH_MODE_MAX_BYTES = 250 * 1024 * 1024

# Timeout for downloading audio from source CDN (seconds).
_AUDIO_DOWNLOAD_TIMEOUT = 120


async def _download_audio_for_push_fallback(
    audio_url: str,
    job_id: str,
) -> tuple[bytes, str]:
    """Download audio from a URL for push-mode Deepgram fallback.

    This is invoked when Deepgram's pull-mode fails because the source CDN
    blocks cloud SaaS IP ranges. Lambda downloads the audio itself, then we
    POST the bytes directly to Deepgram.

    Returns:
        Tuple of (audio_bytes, content_type).

    Raises:
        NonRetryableDeepgramError: If the source refuses the audio (blocked,
            expired, empty, too large).
        TransientIngestionFailure: If the source did not answer in time.

    Cost note: This adds Lambda execution time for the download (~1-30s depending
    on file size and network) plus memory usage to hold the full audio in RAM.
    For typical social media audio (<50 MB) this is well within Lambda 512 MB limits.
    """
    log_event(
        logger,
        logging.INFO,
        "transcription.push_fallback.download_start",
        "Downloading audio for push-mode fallback (source CDN blocked Deepgram)",
        provider="deepgram",
        job_id=job_id,
        audio_url=audio_url,
    )

    try:
        async with httpx.AsyncClient(
            timeout=_AUDIO_DOWNLOAD_TIMEOUT,
            follow_redirects=True,
        ) as client:
            response = await client.get(audio_url)

        if response.status_code == 403:
            # The source CDN blocks Lambda too.
            raise NonRetryableDeepgramError(
                MediaFailureCode.MEDIA_UNAVAILABLE, details="audio_download_blocked", status=403
            )
        if response.status_code == 404:
            raise NonRetryableDeepgramError(
                MediaFailureCode.MEDIA_UNAVAILABLE, details="audio_download_not_found", status=404
            )
        if response.status_code >= 400:
            raise NonRetryableDeepgramError(
                MediaFailureCode.MEDIA_UNAVAILABLE,
                details="audio_download_failed",
                status=response.status_code,
            )

        audio_bytes = response.content
        if not audio_bytes:
            raise NonRetryableDeepgramError(
                MediaFailureCode.NO_TRANSCRIBABLE_MEDIA, details="audio_download_empty"
            )
        if len(audio_bytes) > _PUSH_MODE_MAX_BYTES:
            raise NonRetryableDeepgramError(
                MediaFailureCode.ITEM_TOO_LARGE,
                details="audio_too_large_for_push",
                audio_size_bytes=len(audio_bytes),
                limit_bytes=_PUSH_MODE_MAX_BYTES,
            )

        # Determine content type from response headers or URL
        raw_ct = response.headers.get("content-type") or ""
        content_type = raw_ct.split(";")[0].strip()
        if not content_type or content_type == "application/octet-stream":
            # Try to guess from URL path
            guessed, _ = mimetypes.guess_type(audio_url.split("?")[0])
            content_type = guessed or "audio/mpeg"

        log_event(
            logger,
            logging.INFO,
            "transcription.push_fallback.download_complete",
            "Audio downloaded for push-mode fallback",
            provider="deepgram",
            job_id=job_id,
            audio_size_bytes=len(audio_bytes),
            content_type=content_type,
        )
        return audio_bytes, content_type

    # Nothing is billed yet: a source that did not answer is worth another delivery.
    except httpx.TimeoutException as exc:
        raise TransientIngestionFailure(
            MediaFailureCode.PROVIDER_TIMED_OUT,
            details="audio_download_timeout",
            timeout_seconds=_AUDIO_DOWNLOAD_TIMEOUT,
        ) from exc
    except httpx.TransportError as exc:
        raise TransientIngestionFailure(
            MediaFailureCode.PROVIDER_UNAVAILABLE,
            details="audio_download_transport_error",
            exception_type=type(exc).__name__,
        ) from exc


async def call_deepgram_api_from_bytes(
    *,
    audio_bytes: bytes,
    content_type: str,
    job_id: str,
) -> Dict[str, Any]:
    if not DEEPGRAM_API_KEY:
        raise DeepgramAccountRefusedError(details="deepgram_api_key_missing")
    if not audio_bytes:
        raise DeepgramRefusedError(MediaFailureCode.NO_TRANSCRIBABLE_MEDIA, details="audio_bytes_empty")

    query_params = _build_deepgram_query_params()
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": content_type,
    }

    started = time.time()
    async with httpx.AsyncClient(timeout=DEEPGRAM_TIMEOUT_SECONDS) as client:
        response = await client.post(
            DEEPGRAM_API_URL,
            params=query_params,
            headers=headers,
            content=audio_bytes,
        )

    latency_seconds = time.time() - started
    status = response.status_code

    _raise_for_account(status, response.text)
    if status in (401, 403, 400, 404, 415, 422):
        raise DeepgramRefusedError(
            MediaFailureCode.NO_TRANSCRIPT_AVAILABLE,
            details="deepgram_request_refused",
            status=status,
            provider_detail=response.text[:300],
        )
    if status == 429 or status >= 500:
        raise RetryableDeepgramError(status=status, provider_detail=response.text[:300])
    if status >= 300:
        raise DeepgramRefusedError(
            MediaFailureCode.NO_TRANSCRIPT_AVAILABLE,
            details="deepgram_unexpected_status",
            status=status,
            provider_detail=response.text[:300],
        )

    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        # Permanent: Deepgram answered 2xx, so the audio may be billed already.
        raise NonRetryableDeepgramError(
            MediaFailureCode.PROVIDER_RESULT_INVALID, details="deepgram_invalid_json"
        ) from exc

    request_id = (payload.get("metadata") or {}).get("request_id")
    log_event(
        logger,
        logging.INFO,
        "external_call.succeeded",
        "Deepgram file-bytes request succeeded",
        provider="deepgram",
        transcript_source="deepgram",
        job_id=job_id,
        status=status,
        duration_ms=int(latency_seconds * 1000),
        provider_request_id=request_id,
        content_type=content_type,
        audio_size_bytes=len(audio_bytes),
    )
    return payload


def extract_transcript(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the readable transcript text from a Deepgram response.

    Deepgram already returns paragraph structure for free (we ask for
    ``paragraphs=true`` and ``utterances=true``, both included in Smart
    Formatting), so the shared normalizer picks the richest available shape
    instead of the flat ``alternatives[0].transcript`` string. The result is
    paragraph-delimited plain text, which is what every consumer of the S3
    transcript object expects (task-231 option B).
    """
    results = payload.get("results") or {}
    channels = results.get("channels") or []
    alternatives = (channels[0].get("alternatives") if channels else None) or []
    alt = alternatives[0] if alternatives else {}

    utterances = results.get("utterances") or []
    transcript_text = deepgram_transcript_text(alt, utterances)
    if not transcript_text:
        raise NonRetryableDeepgramError(
            MediaFailureCode.NO_TRANSCRIPT_AVAILABLE, details="deepgram_transcript_empty"
        )

    metadata = payload.get("metadata") or {}

    language = (
        alt.get("detected_language")
        or metadata.get("language")
        or "unknown"
    )

    # `metadata.duration` is the length of audio Deepgram actually processed and
    # billed. It is the authoritative figure for the audio-minutes quota: every
    # other duration in this pipeline is either a producer hint or wall-clock
    # latency (task-250 Layer 2).
    try:
        audio_duration_seconds = float(metadata.get("duration") or 0.0)
    except (TypeError, ValueError):
        audio_duration_seconds = 0.0

    return {
        "text": transcript_text,
        "language": language,
        # Paragraph count, not utterance/word count: every producer now reports the
        # same unit so the value is comparable across sources (task-231 s13.1).
        "segments_count": count_paragraphs(transcript_text),
        "request_id": metadata.get("request_id"),
        "audio_duration_seconds": audio_duration_seconds,
    }


#: How long a live delivery may hold the right to send one request: the HTTP
#: timeout, plus the time to read the answer and close the attempt. A ``sending``
#: try older than this was left by a delivery that died mid-call.
_CLAIM_LEASE = timedelta(seconds=DEEPGRAM_TIMEOUT_SECONDS + 120)


class TranscriptionBudget:
    """The import a transcription is charged to, and how each request is reserved.

    The operation is the one the producer's gate admitted the import under
    (``budget_guard.import_operation_id``); the duration is the figure it measured,
    which bounds every further try (rule 3: the ceiling when it is unknown).
    """

    def __init__(
        self,
        *,
        message_body: Dict[str, Any],
        job: Any,
        job_id: str,
        part: str = "",
        duration_seconds: Any = None,
    ) -> None:
        """``part`` and ``duration_seconds`` name one voice note of a shared
        conversation: its own step of the import, bounded by its own duration."""
        self.user_id = str(message_body.get("user_id") or getattr(job, "user_id", None) or "")
        self.operation_id = budget_guard.import_operation_id(job) or job_id
        self.media_key = message_body.get("media_key") or getattr(job, "media_key", None)
        self.part = part
        try:
            measured = float(
                (message_body.get("audio_duration_seconds") if duration_seconds is None else duration_seconds)
                or 0
            )
        except (TypeError, ValueError):
            measured = 0.0
        self.duration_seconds: Optional[float] = measured if measured > 0 else None

    async def start(self) -> BudgetCall:
        """The right to send one Deepgram request (raises ``BudgetRefusedError``)."""
        return await budget_guard.start(
            self.user_id,
            operation_id=self.operation_id,
            component=Component.TRANSCRIPTION,
            part=self.part,
            line=lambda ctx: beta_budget.transcription_line(
                ctx, duration_seconds=self.duration_seconds, part=self.part
            ),
            lease=_CLAIM_LEASE,
            content_media_key=self.media_key,
        )

    async def send(self, request: Callable[[], Awaitable[Dict[str, Any]]], *, job_id: str) -> Tuple[Dict[str, Any], BudgetCall]:
        """Send one Deepgram request, each try under its own reservation (rule 6).

        A transient answer (429, 5xx) or a lost connection is retried, at most
        ``DEEPGRAM_API_RETRIES`` tries per delivery. An error status means Deepgram
        processed nothing: the try is released at zero. A timeout, or an answer
        that cannot be read, may have been billed: released at its bound. The
        returned call is still open, for the caller to settle once the transcript
        is stored.
        """
        for try_index in range(1, DEEPGRAM_API_RETRIES + 1):
            call = await self.start()
            try:
                return await request(), call
            except (DeepgramRefusedError, RetryableDeepgramError, httpx.ConnectError) as exc:
                # A credit refusal is a DeepgramRefusedError: raised at once, never
                # retried, and it suspends Deepgram for every account (TASK-566).
                await call.release_for(exc, operator_cost=budget_guard.no_cost())
                if isinstance(exc, DeepgramRefusedError) or try_index == DEEPGRAM_API_RETRIES:
                    raise
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                await call.release_for(exc)
                if try_index == DEEPGRAM_API_RETRIES:
                    # Permanent (task-573): the request left, so Deepgram may have
                    # processed and billed it; a redelivery would pay for it again.
                    raise NonRetryableDeepgramError(
                        MediaFailureCode.PROVIDER_TIMED_OUT
                        if isinstance(exc, httpx.TimeoutException)
                        else MediaFailureCode.PROVIDER_UNAVAILABLE,
                        details="deepgram_request_lost",
                        exception_type=type(exc).__name__,
                    ) from exc
            except BaseException as exc:
                await call.release_for(exc)
                raise
            log_event(
                logger,
                logging.WARNING,
                "transcription.retry",
                "Transient Deepgram failure; retrying under a new reservation",
                provider="deepgram",
                job_id=job_id,
                try_index=try_index,
            )
            await asyncio.sleep(min(10, 2 ** (try_index - 1)))
        raise AssertionError("unreachable")

    async def billed(self, payload: Dict[str, Any]) -> MeasuredCost:
        """What a delivered or unusable answer cost: the duration Deepgram reports."""
        try:
            seconds = float((payload.get("metadata") or {}).get("duration") or 0.0)
        except (TypeError, ValueError):
            seconds = 0.0
        ctx = await beta_budget.load_pricing_context()
        return beta_budget.transcription_cost(ctx, billed_seconds=seconds, model=DEEPGRAM_MODEL)


async def publish_failure_event(
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


async def process_deepgram_message(message_body: Dict[str, Any]) -> None:
    job_id = message_body.get("job_id")
    audio_url = message_body.get("audio_url")
    audio_s3_key = message_body.get("audio_s3_key")

    if not job_id:
        raise NonRetryableDeepgramError(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_job_id")
    if not isinstance(job_id, str):
        raise NonRetryableDeepgramError(MediaFailureCode.INVALID_JOB_MESSAGE, details="invalid_job_id")

    # Read explicit deepgram_mode declared by the producer worker.
    # Default to "pull" for backward compatibility with messages already in-flight.
    requested_mode = message_body.get("deepgram_mode")
    if requested_mode is None:
        log_event(
            logger,
            logging.WARNING,
            "transcription.missing_deepgram_mode",
            "Received Deepgram message with no deepgram_mode field; "
            "defaulting to 'pull'. Update the producer to set deepgram_mode explicitly.",
            provider="deepgram",
            job_id=job_id,
            source_platform=message_body.get("source_platform"),
        )
        requested_mode = "pull"
    elif requested_mode not in VALID_DEEPGRAM_MODES:
        raise NonRetryableDeepgramError(
            MediaFailureCode.INVALID_JOB_MESSAGE,
            details="invalid_deepgram_mode",
            deepgram_mode=str(requested_mode),
        )

    from media_summarizer.utils import database_async

    job = await database_async.get_processing_job_by_id(job_id)
    if job:
        job.mark_transcribing()
        await database_async.update_processing_job(job)

    web_page_plan_s3_key = message_body.get("web_page_plan_s3_key")
    if web_page_plan_s3_key:
        await _process_web_page(
            message_body=message_body, job=job, job_id=job_id, plan_s3_key=str(web_page_plan_s3_key)
        )
        return

    plan_s3_key = message_body.get("conversation_plan_s3_key")
    if plan_s3_key:
        await _process_conversation(
            message_body=message_body, job=job, job_id=job_id, plan_s3_key=str(plan_s3_key)
        )
        return

    if not audio_url and job:
        audio_url = getattr(job, "media_url", None)
    if not audio_s3_key and job:
        audio_s3_key = getattr(job, "audio_s3_key", None)

    budget = TranscriptionBudget(message_body=message_body, job=job, job_id=job_id)
    deepgram_payload: Dict[str, Any]
    call: BudgetCall
    deepgram_mode_used: str = requested_mode
    started = time.time()

    if isinstance(audio_s3_key, str) and audio_s3_key.strip():
        # Our own bucket: pull mode over a presigned GET, never the bytes in memory.
        s3_key = audio_s3_key.strip()
        deepgram_payload, call = await budget.send(
            lambda: call_deepgram_api_on_s3_audio(s3_key=s3_key, job_id=job_id),
            job_id=job_id,
        )
        deepgram_mode_used = "pull"
    elif isinstance(audio_url, str) and audio_url.strip():
        source_url = audio_url.strip()
        if requested_mode == "push":
            # Producer declared push-mode: skip pull entirely, download and push bytes.
            audio_bytes, content_type = await _download_audio_for_push_fallback(
                audio_url=source_url,
                job_id=job_id,
            )
            deepgram_payload, call = await budget.send(
                lambda: call_deepgram_api_from_bytes(
                    audio_bytes=audio_bytes,
                    content_type=content_type,
                    job_id=job_id,
                ),
                job_id=job_id,
            )
            deepgram_mode_used = "push"
        elif requested_mode == "pull":
            # Producer declared pull-mode: fail loudly on RemoteContentError.
            try:
                deepgram_payload, call = await budget.send(
                    lambda: call_deepgram_api(audio_url=source_url, job_id=job_id),
                    job_id=job_id,
                )
            except RemoteContentError as remote_err:
                # The producer declared pull-mode, but the source CDN blocks
                # Deepgram: the producer should send 'push' for this source.
                raise NonRetryableDeepgramError(
                    MediaFailureCode.MEDIA_UNAVAILABLE,
                    details="deepgram_remote_content_blocked_pull_mode",
                    source_platform=message_body.get("source_platform"),
                ) from remote_err
            deepgram_mode_used = "pull"
        else:
            # "pull_with_push_fallback": try pull, fall back to push on CDN block.
            # The push request is a try of its own, reserved after the pull one
            # was released at zero (rule 6).
            try:
                if FORCE_DEEPGRAM_PUSH_MODE:
                    raise RemoteContentError(
                        MediaFailureCode.MEDIA_UNAVAILABLE, details="forced_push_mode"
                    )
                deepgram_payload, call = await budget.send(
                    lambda: call_deepgram_api(audio_url=source_url, job_id=job_id),
                    job_id=job_id,
                )
                deepgram_mode_used = "pull"
            except RemoteContentError as remote_err:
                log_event(
                    logger,
                    logging.WARNING,
                    "transcription.push_fallback.triggered",
                    "Deepgram pull-mode failed with REMOTE_CONTENT_ERROR; "
                    "attempting push-mode fallback (mode=pull_with_push_fallback)",
                    provider="deepgram",
                    job_id=job_id,
                    audio_url=source_url,
                    original_error=remote_err.reason,
                )
                audio_bytes, content_type = await _download_audio_for_push_fallback(
                    audio_url=source_url,
                    job_id=job_id,
                )
                deepgram_payload, call = await budget.send(
                    lambda: call_deepgram_api_from_bytes(
                        audio_bytes=audio_bytes,
                        content_type=content_type,
                        job_id=job_id,
                    ),
                    job_id=job_id,
                )
                deepgram_mode_used = "push"
                log_event(
                    logger,
                    logging.INFO,
                    "transcription.push_fallback.succeeded",
                    "Push-mode fallback transcription succeeded",
                    provider="deepgram",
                    job_id=job_id,
                    audio_size_bytes=len(audio_bytes),
                )
    else:
        raise NonRetryableDeepgramError(MediaFailureCode.INVALID_JOB_MESSAGE, details="missing_audio_source")
    transcription_duration = time.time() - started

    # Deepgram has answered and billed what it processed. From here the try is
    # settled only once the transcript is stored on its job (rule 5); any failure
    # before that releases it, the billed duration going to the operator's spend.
    try:
        billed_cost: Optional[MeasuredCost] = await budget.billed(deepgram_payload)
    except Exception:  # noqa: BLE001 - the bound stands in for an unreadable barème
        billed_cost = None
    try:
        delivered = await _store_transcript(
            job=job,
            job_id=job_id,
            message_body=message_body,
            deepgram_payload=deepgram_payload,
            deepgram_mode_used=deepgram_mode_used,
            audio_url=audio_url,
            audio_s3_key=audio_s3_key,
            transcription_duration=transcription_duration,
        )
    except IngestionFailure:
        await call.release(operator_cost=billed_cost)
        raise
    except Exception as exc:
        await call.release(operator_cost=billed_cost)
        # Permanent (task-573): Deepgram has billed the audio, and a redelivery
        # would send and pay for the same transcription again.
        raise NonRetryableDeepgramError(
            MediaFailureCode.UNEXPECTED_ERROR,
            details="transcript_store_failed",
            exception_type=type(exc).__name__,
        ) from exc
    except BaseException:
        await call.release(operator_cost=billed_cost)
        raise
    if billed_cost is not None:
        await call.settle(billed_cost, metric_source="deepgram_metadata_duration")
    else:
        # No barème to price the answer with: the try stays open and the ledger's
        # backstop releases it, the bound recorded as the operator's spend.
        log_event(
            logger,
            logging.ERROR,
            "budget.transcription_unpriced",
            "Transcript delivered but its cost could not be priced",
            job_id=job_id,
            attempt_id=call.attempt_id,
        )

    # Exactly one event, and published once the job holds its final state: the
    # consumer closes the content ledger, prepares saved media, indexes and sends
    # the "ready" notification from it, so a second message repeats all four --
    # a second push included. Algolia indexing is enqueued by that consumer.
    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": message_body.get("media_key"),
            "canonical_job_id": job_id,
            "transcription_s3_key": delivered["transcript_s3_key"],
            "transcription_metadata": delivered["transcription_metadata"],
        },
    )

    log_event(
        logger,
        logging.INFO,
        "transcription.completed",
        "Deepgram transcription completed",
        provider="deepgram",
        transcript_source="deepgram",
        job_id=job_id,
        media_item_id=job_id,
    )


async def _store_transcript(
    *,
    job: Any,
    job_id: str,
    message_body: Dict[str, Any],
    deepgram_payload: Dict[str, Any],
    deepgram_mode_used: str,
    audio_url: Any,
    audio_s3_key: Any,
    transcription_duration: float,
) -> Dict[str, Any]:
    """Read the transcript out of Deepgram's answer and store it on its job."""
    from media_summarizer.utils import database_async

    transcript = extract_transcript(deepgram_payload)
    transcript_text = transcript["text"]
    billed_audio_seconds = float(transcript.get("audio_duration_seconds") or 0.0)

    transcript_s3_key = f"{job_id}.txt"
    await upload_transcription(transcript_s3_key, transcript_text)

    transcription_metadata = {
        "provider": "deepgram",
        "deepgram_mode": deepgram_mode_used,
        "request_id": transcript.get("request_id"),
        "model_used": DEEPGRAM_MODEL,
        "language": transcript.get("language"),
        "segments_count": transcript.get("segments_count", 0),
        # Length of the audio itself, as billed by Deepgram: the media duration the
        # app displays. How long the call took is a processing figure and lives on
        # `job.transcription_duration`, never in this metadata.
        "audio_duration_seconds": billed_audio_seconds,
        "audio_url": audio_url.strip() if isinstance(audio_url, str) and audio_url.strip() else None,
        "audio_s3_key": audio_s3_key.strip()
        if isinstance(audio_s3_key, str) and audio_s3_key.strip()
        else None,
        "content_mime_type": message_body.get("content_mime_type"),
        "transcribed_at": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
        ),
    }

    if job:
        job.set_transcription_location(transcript_s3_key)
        job.set_transcription_metadata(transcription_metadata)
        job.set_processing_duration("transcription", int(transcription_duration))
        await database_async.update_processing_job(job)

    # Mark the canonical job as completed now that transcription is done.
    if job:
        job.mark_completed()
        await database_async.update_processing_job(job)

    return {
        "transcript_s3_key": transcript_s3_key,
        "transcription_metadata": transcription_metadata,
    }


async def _transcribe_voice_note(
    *, message_body: Dict[str, Any], job: Any, job_id: str, voice: Dict[str, Any]
) -> Tuple[str, float, Optional[str], Optional[BudgetCall], Optional[Dict[str, Any]]]:
    """One voice note of a conversation: ``(text, seconds, language, call, payload)``.

    A voice note Deepgram cannot make words of -- an answer with no transcript, a
    file it refuses -- leaves an empty text and the conversation carries on: the
    selection stays readable, that message keeps its place. What is about our
    account (key refused, no credit left) is not about this file and fails the job.
    """
    probed = float(voice.get("duration_seconds") or 0)
    voice_key = str(voice["audio_s3_key"])
    budget = TranscriptionBudget(
        message_body=message_body,
        job=job,
        job_id=job_id,
        part=str(voice.get("part") or ""),
        duration_seconds=probed,
    )
    try:
        # Pull mode, like a single uploaded audio: a voice note is small by nature,
        # but nothing bounds it below the 250 MB audio ceiling, and the same path
        # keeps every audio of our bucket out of this function's memory.
        payload, call = await budget.send(
            lambda: call_deepgram_api_on_s3_audio(s3_key=voice_key, job_id=job_id),
            job_id=job_id,
        )
    except (DeepgramAccountRefusedError, DeepgramCreditExhaustedError):
        raise
    except DeepgramRefusedError as refused:
        log_event(
            logger,
            logging.WARNING,
            "transcription.conversation_voice_refused",
            "Deepgram refused a voice note of a shared conversation; kept untranscribed",
            provider="deepgram",
            job_id=job_id,
            details=refused.details,
        )
        return "", probed, None, None, None
    try:
        transcript = extract_transcript(payload)
    except NonRetryableDeepgramError:
        billed = float((payload.get("metadata") or {}).get("duration") or 0.0)
        return "", billed or probed, None, call, payload
    seconds = float(transcript.get("audio_duration_seconds") or 0.0) or probed
    language = transcript.get("language")
    return transcript["text"], seconds, language if language != "unknown" else None, call, payload


async def _process_conversation(
    *, message_body: Dict[str, Any], job: Any, job_id: str, plan_s3_key: str
) -> None:
    """Transcribe the voice notes of a shared conversation and assemble its text.

    The plan the orchestrator stored lists the messages in selection order. Each
    voice note is its own request under its own budget part; every call stays open
    until the assembled text is stored on the job (rule 5), then each is settled
    on what Deepgram billed for it. Once the event is out, the voice notes are
    deleted: the conversation keeps their words, never their audio.
    """
    from media_summarizer.utils import database_async

    if job is not None and job.status == JobStatus.COMPLETED and job.transcription_s3_key:
        log_event(
            logger,
            logging.INFO,
            "transcription.conversation_already_done",
            "Shared conversation already transcribed; redelivery acknowledged",
            job_id=job_id,
        )
        return

    raw_plan = await s3.download_file_to_memory(TRANSCRIPT_BUCKET, plan_s3_key)
    messages = json.loads(raw_plan.decode("utf-8")).get("messages") or []

    started = time.time()
    lines = []
    open_calls: list = []
    billed_seconds = 0.0
    languages = []
    voice_keys = []
    try:
        for message in messages:
            if message.get("kind") != "voice":
                lines.append(format_text_message(str(message.get("text") or "")))
                continue
            voice_keys.append(str(message["audio_s3_key"]))
            text, seconds, language, call, payload = await _transcribe_voice_note(
                message_body=message_body, job=job, job_id=job_id, voice=message
            )
            if call is not None and payload is not None:
                open_calls.append((call, payload))
            billed_seconds += seconds
            if language:
                languages.append(language)
            lines.append(format_voice_message(text, seconds))

        transcript_text = format_conversation(lines)
        transcript_s3_key = f"{job_id}.txt"
        await upload_transcription(transcript_s3_key, transcript_text)
        transcription_metadata = {
            "provider": "deepgram",
            "transcript_source": "shared_conversation",
            "deepgram_mode": "push",
            "model_used": DEEPGRAM_MODEL,
            "language": languages[0] if languages else "unknown",
            "segments_count": count_paragraphs(transcript_text),
            "audio_duration_seconds": billed_seconds,
            "message_count": len(messages),
            "voice_note_count": len(voice_keys),
            "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        if job:
            job.set_transcription_location(transcript_s3_key)
            job.set_transcription_metadata(transcription_metadata)
            job.set_processing_duration("transcription", int(time.time() - started))
            job.mark_completed()
            await database_async.update_processing_job(job)
    except BaseException as exc:
        for call, payload in open_calls:
            try:
                cost: Optional[MeasuredCost] = await TranscriptionBudget(
                    message_body=message_body, job=job, job_id=job_id
                ).billed(payload)
            except Exception:  # noqa: BLE001 - the bound stands in for an unreadable barème
                cost = None
            await call.release(operator_cost=cost)
        if isinstance(exc, Exception) and not isinstance(exc, IngestionFailure):
            raise NonRetryableDeepgramError(
                MediaFailureCode.UNEXPECTED_ERROR,
                details="conversation_store_failed",
                exception_type=type(exc).__name__,
            ) from exc
        raise

    for call, payload in open_calls:
        try:
            cost = await TranscriptionBudget(
                message_body=message_body, job=job, job_id=job_id
            ).billed(payload)
        except Exception:  # noqa: BLE001 - the ledger's backstop releases it at its bound
            log_event(
                logger,
                logging.ERROR,
                "budget.transcription_unpriced",
                "Transcript delivered but its cost could not be priced",
                job_id=job_id,
                attempt_id=call.attempt_id,
            )
            continue
        await call.settle(cost, metric_source="deepgram_metadata_duration")

    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": message_body.get("media_key"),
            "canonical_job_id": job_id,
            "transcription_s3_key": transcript_s3_key,
            "transcription_metadata": transcription_metadata,
        },
    )

    for key in voice_keys:
        try:
            await s3.delete_object(AUDIO_BUCKET, key)
        except Exception as exc:  # noqa: BLE001 - the account sweep still covers it
            log_event(
                logger,
                logging.WARNING,
                "transcription.conversation_voice_not_deleted",
                "Voice note of a transcribed conversation could not be deleted",
                job_id=job_id,
                exc_info=exc,
            )

    log_event(
        logger,
        logging.INFO,
        "transcription.completed",
        "Shared conversation transcription completed",
        provider="deepgram",
        transcript_source="shared_conversation",
        job_id=job_id,
        media_item_id=job_id,
        message_count=len(messages),
        voice_note_count=len(voice_keys),
    )


async def _process_web_page(
    *, message_body: Dict[str, Any], job: Any, job_id: str, plan_s3_key: str
) -> None:
    """Transcribe the videos of a rendered web page and store page + videos as one text.

    The render worker wrote the plan: the page's text and, in page order, each
    video kept with its audio in ``AUDIO_BUCKET``. Each video is its own request
    under its own budget part, exactly like a voice note of a shared conversation
    (`_transcribe_voice_note`); the calls stay open until the text is stored, then
    each is settled on what Deepgram billed. The text is Markdown
    (`core/web_page.compose_sections`): a ``## [page]`` section, then one
    ``## [video i/n ...]`` section per video, stored as ``{job_id}.md`` so the
    raw-content reader keeps the headings. The audio is deleted once the event is
    out: the page keeps the words, never the sound.
    """
    from media_summarizer.core.web_page import VideoSection, compose_sections
    from media_summarizer.utils import database_async

    if job is not None and job.status == JobStatus.COMPLETED and job.transcription_s3_key:
        log_event(
            logger,
            logging.INFO,
            "transcription.web_page_already_done",
            "Web page already transcribed; redelivery acknowledged",
            job_id=job_id,
        )
        return

    plan = json.loads((await s3.download_file_to_memory(TRANSCRIPT_BUCKET, plan_s3_key)).decode("utf-8"))
    page = plan.get("page") or {}
    videos = plan.get("videos") or []

    started = time.time()
    open_calls: list = []
    billed_seconds = 0.0
    languages = []
    sections = []
    try:
        for video in videos:
            text, seconds, language, call, payload = await _transcribe_voice_note(
                message_body=message_body, job=job, job_id=job_id, voice=video
            )
            if call is not None and payload is not None:
                open_calls.append((call, payload))
            billed_seconds += seconds
            if language:
                languages.append(language)
            sections.append(
                VideoSection(
                    title=video.get("title"),
                    text=text,
                    duration_seconds=seconds or video.get("duration_seconds"),
                    provider=video.get("provider"),
                    thumbnail_url=video.get("thumbnail_url"),
                )
            )

        page_text = str(page.get("text") or "")
        if not page_text.strip() and not any(section.text.strip() for section in sections):
            raise NonRetryableDeepgramError(
                MediaFailureCode.NO_TRANSCRIPT_AVAILABLE, details="web_page_nothing_transcribed"
            )
        transcript_text = compose_sections(
            page_title=page.get("title"), page_text=page_text, videos=sections
        )
        transcript_s3_key = f"{job_id}.md"
        await upload_transcription(transcript_s3_key, transcript_text)
        transcription_metadata = {
            "provider": "deepgram",
            "transcript_source": "web_page",
            "deepgram_mode": "pull",
            "model_used": DEEPGRAM_MODEL,
            "language": languages[0] if languages else "unknown",
            "segments_count": count_paragraphs(transcript_text),
            # Not `audio_duration_seconds`: that key is the media's own length
            # (`media_duration_seconds`), and a page is an article, not a 4-minute
            # media because it holds three clips.
            "videos_audio_seconds": billed_seconds,
            "video_count": len(videos),
            "videos_transcribed": sum(1 for section in sections if section.text.strip()),
            "source_url": page.get("source_url"),
            "transcribed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        if job:
            job.set_transcription_location(transcript_s3_key)
            job.set_transcription_metadata(transcription_metadata)
            job.set_processing_duration("transcription", int(time.time() - started))
            job.mark_completed()
            await database_async.update_processing_job(job)
    except BaseException as exc:
        for call, payload in open_calls:
            try:
                cost: Optional[MeasuredCost] = await TranscriptionBudget(
                    message_body=message_body, job=job, job_id=job_id
                ).billed(payload)
            except Exception:  # noqa: BLE001 - the bound stands in for an unreadable barème
                cost = None
            await call.release(operator_cost=cost)
        if isinstance(exc, Exception) and not isinstance(exc, IngestionFailure):
            raise NonRetryableDeepgramError(
                MediaFailureCode.UNEXPECTED_ERROR,
                details="web_page_store_failed",
                exception_type=type(exc).__name__,
            ) from exc
        raise

    for call, payload in open_calls:
        try:
            cost = await TranscriptionBudget(
                message_body=message_body, job=job, job_id=job_id
            ).billed(payload)
        except Exception:  # noqa: BLE001 - the ledger's backstop releases it at its bound
            log_event(
                logger,
                logging.ERROR,
                "budget.transcription_unpriced",
                "Transcript delivered but its cost could not be priced",
                job_id=job_id,
                attempt_id=call.attempt_id,
            )
            continue
        await call.settle(cost, metric_source="deepgram_metadata_duration")

    await sqs.send_message(
        queue_name=EPISODE_COMPLETED_EVENTS_QUEUE,
        message_body={
            "event_type": "episode_completion_status",
            "status": "success",
            "media_key": message_body.get("media_key"),
            "canonical_job_id": job_id,
            "transcription_s3_key": transcript_s3_key,
            "transcription_metadata": transcription_metadata,
        },
    )

    for video in videos:
        try:
            await s3.delete_object(AUDIO_BUCKET, str(video["audio_s3_key"]))
        except Exception as exc:  # noqa: BLE001 - the account sweep still covers it
            log_event(
                logger,
                logging.WARNING,
                "transcription.web_page_audio_not_deleted",
                "Audio of a transcribed web page video could not be deleted",
                job_id=job_id,
                exc_info=exc,
            )

    log_event(
        logger,
        logging.INFO,
        "transcription.completed",
        "Web page transcription completed",
        provider="deepgram",
        transcript_source="web_page",
        job_id=job_id,
        media_item_id=job_id,
        video_count=len(videos),
        audio_duration_seconds=billed_seconds,
    )


async def _fail_job_on_refusal(*, job_id: Optional[str], refusal: BudgetRefusedError) -> None:
    if not job_id:
        return
    from media_summarizer.utils import database_async

    try:
        job = await database_async.get_processing_job_by_id(job_id)
        if job:
            job.mark_failed(
                error_code=refusal.failure_code,
                error_step="budget_admission",
                error_metadata={"reason": refusal.error_code},
            )
            await database_async.update_processing_job(job)
    except Exception as exc:  # noqa: BLE001 - the failure event still closes the import
        log_event(
            logger,
            logging.WARNING,
            "budget.job_update_failed",
            "Could not mark the job failed after a budget refusal",
            job_id=job_id,
            exc_info=exc,
        )


async def process_message(message: Dict[str, Any]) -> None:
    receipt_handle = message.get("ReceiptHandle")
    heartbeat_task: Optional[asyncio.Task] = None
    body: Dict[str, Any] = {}

    async def _heartbeat_loop() -> None:
        try:
            await sqs.change_message_visibility(
                queue_name=DEEPGRAM_TRANSCRIPTION_QUEUE,
                receipt_handle=receipt_handle,
                timeout_seconds=DEEPGRAM_VISIBILITY_TIMEOUT,
            )
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                await sqs.change_message_visibility(
                    queue_name=DEEPGRAM_TRANSCRIPTION_QUEUE,
                    receipt_handle=receipt_handle,
                    timeout_seconds=DEEPGRAM_VISIBILITY_TIMEOUT,
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            log_event(
                logger,
                logging.WARNING,
                "external_call.failed",
                "Deepgram heartbeat failed",
                provider="sqs",
                queue=DEEPGRAM_TRANSCRIPTION_QUEUE,
                exc_info=e,
            )

    try:
        body = json.loads(message.get("Body", "{}"))
        context_token = bind_log_context(
            job_id=body.get("job_id"),
            media_item_id=body.get("job_id"),
            queue=DEEPGRAM_TRANSCRIPTION_QUEUE,
            provider="deepgram",
            transcript_source="deepgram",
        )
        if receipt_handle:
            heartbeat_task = asyncio.create_task(_heartbeat_loop())

        await process_deepgram_message(body)
    except BudgetBusyError:
        # A duplicate delivery while the one that claimed the request is still
        # inside its lease: that delivery owns the outcome.
        log_event(
            logger,
            logging.INFO,
            "budget.transcription_busy",
            "Another delivery is sending this transcription; acknowledged",
            job_id=body.get("job_id"),
        )
        return
    except BudgetRefusedError as refusal:
        # A further try (a retry, the push fallback) the budget does not cover, or
        # a counter that cannot be read (rule 7): nothing was sent under it.
        await _fail_job_on_refusal(job_id=body.get("job_id"), refusal=refusal)
        await publish_failure_event(
            job_id=body.get("job_id"),
            media_key=body.get("media_key"),
            reason=refusal.error_code,
        )
        return
    finally:
        if "context_token" in locals():
            reset_log_context(context_token)
        if heartbeat_task:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

