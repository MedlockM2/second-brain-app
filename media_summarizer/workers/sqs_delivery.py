"""What an exception raised by a worker does to its SQS message and its job (task-573).

Every SQS-triggered Lambda goes through ``lambda_handlers._build_handler``, which
hands any exception its worker lets escape to :func:`settle_failure`. The event
source mapping reports batch item failures (``ReportBatchItemFailures`` in
``lambda_workers.tf``), so a message listed in ``batchItemFailures`` really comes
back after its visibility timeout, and one left out is deleted.

- **Permanent** (`IngestionFailure` with ``retryable=False``): the job fails at
  once with the failure's code and the message is acknowledged.
- **Transient** (``retryable=True``) or **unknown** (any other exception): the
  message goes back to SQS. On the queue's last delivery the job fails first,
  with the failure's code or ``UNEXPECTED_ERROR``, and SQS moves the message to
  the DLQ for analysis.

Failing a job follows the path of the failures workers already handle (the
unreadable article in ``orchestrators.py``): ``mark_failed``, then
``update_processing_job`` (which mirrors ``user_media``, what the app reads),
then a ``failure`` completion event, which closes the ``media_idempotence``
reservation, the import budget and the artifact waits. A job already in a
terminal state is never touched: the worker that put it there owns its outcome.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from media_summarizer.core.models.failure_codes import MediaFailureCode
from media_summarizer.core.models.ingestion_failures import (
    IngestionFailure,
    PermanentIngestionFailure,
)
from media_summarizer.utils import database_async, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)


def receive_count(message: Dict[str, Any]) -> int:
    """How many times SQS has delivered this message, this delivery included."""
    raw = (message.get("Attributes") or {}).get("ApproximateReceiveCount", "1")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 1


def is_last_delivery(message: Dict[str, Any]) -> bool:
    """True when SQS sends the message to the DLQ instead of delivering it again.

    ``SQS_MAX_RECEIVE_COUNT`` is the ``maxReceiveCount`` of every worker queue's
    redrive policy, injected by Terraform from the same local
    (``worker_max_receive_count``), so the two cannot drift.
    """
    return receive_count(message) >= int(required_env("SQS_MAX_RECEIVE_COUNT"))


def _message_body(message: Dict[str, Any]) -> Dict[str, Any]:
    try:
        body = json.loads(message.get("Body") or "{}")
    except (TypeError, ValueError):
        return {}
    return body if isinstance(body, dict) else {}


async def settle_failure(
    message: Dict[str, Any],
    exc: Exception,
    *,
    worker: str,
    fails_job: bool,
) -> bool:
    """Decide the fate of a message whose processing raised; True sends it back to SQS.

    ``fails_job`` is set for the workers whose message carries an ingestion job
    (``job_id``); the others (artifacts, chat, indexing, events...) own no job,
    so their messages are only retried, then dead-lettered.
    """
    retry = not (isinstance(exc, IngestionFailure) and not exc.retryable)
    attempt = receive_count(message)
    last = is_last_delivery(message)
    log_event(
        logger,
        logging.ERROR if not retry or last else logging.WARNING,
        "worker.failed" if not retry or last else "worker.retry_scheduled",
        "Worker message failed" if not retry or last else "Worker message failed and goes back to SQS",
        worker=worker,
        attempt=attempt,
        retryable=retry,
        error_type=type(exc).__name__,
        error_code=exc.code.value if isinstance(exc, IngestionFailure) else None,
        exc_info=exc,
    )
    if not fails_job or (retry and not last):
        return retry

    failure = (
        exc
        if isinstance(exc, IngestionFailure)
        else PermanentIngestionFailure(
            MediaFailureCode.UNEXPECTED_ERROR,
            details="unhandled_worker_exception",
            exception_type=type(exc).__name__,
        )
    )
    body = _message_body(message)
    try:
        await fail_job(
            job_id=body.get("job_id"),
            media_key=body.get("media_key"),
            failure=failure,
            step=worker,
            attempt=attempt,
        )
    except Exception as fail_exc:  # noqa: BLE001 - the redelivery is the retry
        # The job could not be failed: keep the message, so the next delivery
        # (or the DLQ, on the last one) still holds the work to be closed.
        log_event(
            logger,
            logging.ERROR,
            "worker.fail_job_failed",
            "Could not mark the job failed; the message goes back to SQS",
            worker=worker,
            job_id=body.get("job_id"),
            error_type=type(fail_exc).__name__,
            exc_info=fail_exc,
        )
        return True
    return retry


async def fail_job(
    *,
    job_id: Optional[str],
    media_key: Optional[str],
    failure: IngestionFailure,
    step: str,
    attempt: int,
) -> None:
    """Fail a job not yet terminal and publish the failure event that closes it."""
    if not job_id:
        return
    job = await database_async.get_processing_job_by_id(job_id)
    if job is None or job.is_terminal_state():
        return
    error_metadata = failure.error_metadata(step=step)
    error_metadata["attempt"] = attempt
    job.mark_failed(error_code=failure.code, error_step=step, error_metadata=error_metadata)
    await database_async.update_processing_job(job)
    await sqs.send_message(
        queue_name=required_env("EPISODE_COMPLETED_EVENTS_QUEUE"),
        message_body={
            "event_type": "episode_completion_status",
            "status": "failure",
            "media_key": media_key or job.media_key,
            "canonical_job_id": job.id,
            "reason": failure.reason,
        },
    )
