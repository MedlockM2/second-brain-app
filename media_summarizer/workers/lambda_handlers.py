"""
AWS Lambda handler entrypoints for all SQS-triggered workers.

Each handler receives an SQS event from Lambda event source mapping, iterates
over the Records, and delegates to the existing per-message processing logic.
The handler reports batch item failures so Lambda only retries failed messages;
``sqs_delivery`` decides which ones, and when a job is failed instead (task-573).

Module-level initialization loads secrets from Secrets Manager (once per cold
start) so all os.getenv() calls throughout the codebase resolve correctly.
"""

import asyncio
import json
import logging
import os
from typing import Any

import boto3

from media_summarizer.utils.logging_config import setup_logging

# ---------------------------------------------------------------------------
# Cold-start initialization: load secrets into environment
# ---------------------------------------------------------------------------

_secret_name = os.environ.get("RUNTIME_SECRET_NAME", "")
if _secret_name:
    _client = boto3.client("secretsmanager")
    _resp = _client.get_secret_value(SecretId=_secret_name)
    _secrets = json.loads(_resp["SecretString"])
    for _key, _value in _secrets.items():
        os.environ.setdefault(_key, str(_value))

setup_logging("lambda-worker")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Generic handler factory
# ---------------------------------------------------------------------------


def _build_handler(
    worker_module_path: str,
    process_func_name: str = "process_message",
    *,
    fails_job: bool = False,
):
    """
    Build a Lambda handler that processes SQS records using the given worker's
    process_message function.

    The handler returns a partial batch response: a message listed in
    batchItemFailures comes back after its visibility timeout, any other one is
    deleted. Which messages are listed, and when the job fails, is decided by
    ``sqs_delivery.settle_failure`` from the exception the worker raised.
    ``fails_job`` is set for the workers whose message carries an ingestion job.
    """
    worker_name = worker_module_path.removeprefix("media_summarizer.workers.")

    async def deliver(process_fn: Any, message: dict[str, Any]) -> bool:
        from media_summarizer.workers import sqs_delivery

        try:
            await process_fn(message)
        except Exception as exc:
            return await sqs_delivery.settle_failure(
                message, exc, worker=worker_name, fails_job=fails_job
            )
        return False

    def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
        import importlib

        module = importlib.import_module(worker_module_path)
        process_fn = getattr(module, process_func_name)

        records = event.get("Records", [])
        failures: list[dict[str, str]] = []

        for record in records:
            message_id = record.get("messageId", "unknown")
            # Construct a message dict that matches what the existing
            # process_message functions expect (Body + ReceiptHandle + Attributes)
            message = {
                "Body": record.get("body", "{}"),
                "ReceiptHandle": record.get("receiptHandle", ""),
                "MessageId": message_id,
                "Attributes": record.get("attributes", {}),
            }

            # Workers use async processing
            if asyncio.run(deliver(process_fn, message)):
                failures.append({"itemIdentifier": message_id})
        return {"batchItemFailures": failures}

    return handler


# ---------------------------------------------------------------------------
# Worker handlers (one per Lambda function)
# ---------------------------------------------------------------------------

podcastindex_resolution_handler = _build_handler(
    "media_summarizer.workers.podcastindex_resolution_worker", fails_job=True
)

article_extraction_handler = _build_handler(
    "media_summarizer.workers.article_extraction_worker", fails_job=True
)

x_ingestion_handler = _build_handler(
    "media_summarizer.workers.x_ingestion_worker", fails_job=True
)

youtube_ingestion_handler = _build_handler(
    "media_summarizer.workers.youtube_ingestion_worker", fails_job=True
)

tiktok_ingestion_handler = _build_handler(
    "media_summarizer.workers.tiktok_ingestion_worker", fails_job=True
)

instagram_ingestion_handler = _build_handler(
    "media_summarizer.workers.instagram_ingestion_worker", fails_job=True
)

deepgram_transcription_handler = _build_handler(
    "media_summarizer.workers.transcription.deepgram_worker", fails_job=True
)

artifact_generator_handler = _build_handler(
    "media_summarizer.workers.artifact_generator.worker"
)


document_parsing_handler = _build_handler(
    "media_summarizer.workers.document_parsing.worker", fails_job=True
)

search_indexing_handler = _build_handler(
    "media_summarizer.workers.search_indexing_worker",
    process_func_name="process_indexing_message",
)

rss_feed_poll_handler = _build_handler(
    "media_summarizer.workers.rss_feed_poll_worker"
)

media_completed_events_handler = _build_handler(
    "media_summarizer.workers.events.media_completed_worker",
    process_func_name="process_event",
)

transcript_translation_handler = _build_handler(
    "media_summarizer.workers.transcript_translation_worker"
)

# The chat's own worker (task-463): its queue, its concurrency, its retry policy.
chat_handler = _build_handler(
    "media_summarizer.workers.chat_worker",
)

push_notification_handler = _build_handler(
    "media_summarizer.workers.push_notification_worker"
)


# ---------------------------------------------------------------------------
# Non-SQS handlers
# ---------------------------------------------------------------------------


def media_lifecycle_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """user_media purge cascade (DynamoDB stream) and daily reconciliation (task-243).

    Not built by ``_build_handler``: the events are a DynamoDB stream batch and a
    scheduled tick, not SQS messages, and the module routes on the event shape
    itself. It lives here anyway so it inherits the cold-start secret load above —
    the cascade deletes search records and needs the Algolia credentials.
    """
    import importlib

    module = importlib.import_module("media_summarizer.workers.cleanup.media_lifecycle")
    return module.handle_event(event)


def digest_scheduler_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Digest notification sweep and stale push-token purge (task-369).

    Two EventBridge schedules point here and the module routes on the event's
    ``source``: the frequent sweep that decides whose local 18:30 or Monday 09:30
    just passed, and a daily purge of tokens no device has claimed in ninety days.
    Not an SQS handler — it is the *producer* of the push notification queue.
    """
    import importlib

    module = importlib.import_module("media_summarizer.workers.digest.scheduler")
    return module.handle_event(event)


def ecb_rate_refresh_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Daily refresh of the EUR/USD rate of the beta budget (task-559).

    Called by one EventBridge schedule on working days. Its Lambda carries the
    shared resource names but no runtime secret (``RUNTIME_SECRET_NAME`` is left
    out, so the cold start above loads nothing) and an IAM role scoped to the
    ``eur_usd_rate`` row of ``pricing_config``: ``lambda_ecb_rate.tf``.
    """
    import importlib

    module = importlib.import_module("media_summarizer.workers.ecb_rate_refresh")
    return module.handle_event(event)


def budget_audit_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Scheduled read-only audit; own role, no runtime secret or provider access."""
    import importlib

    module = importlib.import_module("media_summarizer.workers.budget_audit")
    return module.handle_event(event)
