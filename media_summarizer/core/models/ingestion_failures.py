"""What a worker raises when it gives up, and whether its message is retried.

Each worker keeps its own exception name — `except InstagramIngestionError` has
to stay narrower than "any ingestion problem" — but the pieces of a failure are
the same everywhere, so they are defined once:

- `code`: a `MediaFailureCode`, the only failure information the app receives.
  It is written on the job and turned into a sentence on the device, in the
  reader's language. Nothing variable ever belongs in it.
- `details`: a short, stable, lower-snake reason token (`apify_result_invalid`,
  `missing_tiktok_id`). Developer-facing, in the AIP-193 sense: it lands in
  logs, in `extraction_metadata.failure_details` and in the failure-event
  reason, all of which dashboards and alarms read. Renaming one is an
  observability change.
- `retryable`: what the Lambda SQS handler does with the message
  (`workers/sqs_delivery.py`). A permanent failure fails the job at once and
  acknowledges the message; a transient one goes back to SQS and fails the job
  only on the queue's last delivery.
- `context`: the structured facts behind the token — an HTTP status, an actor id,
  an exception class name. Persisted in `ProcessingJob.error_metadata`, which the
  API does not serve.

Free-text sentences are not among them, by design (task-359).

A failure whose nature never depends on the call site raises one of the two
fixed classes below (`PermanentIngestionFailure`, `TransientIngestionFailure`);
a worker whose single error type covers both cases passes `retryable` itself.
Either way the handler reads the same attribute.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from media_summarizer.core.models.beta_budget import ProviderFailure
from media_summarizer.core.models.failure_codes import MediaFailureCode


class IngestionFailure(Exception):
    """A terminal (or retryable) ingestion failure, named by a stable code."""

    def __init__(
        self,
        code: MediaFailureCode,
        *,
        details: str,
        retryable: bool = False,
        **context: Any,
    ) -> None:
        super().__init__(f"{code.value}:{details}")
        self.code = code
        self.details = details.strip()
        self.retryable = retryable
        # A `None` in the context means "not applicable here", not "null": it is
        # dropped rather than written, since DynamoDB would keep it forever.
        self.context: Dict[str, Any] = {key: value for key, value in context.items() if value is not None}

    @property
    def provider_failure(self) -> Optional[ProviderFailure]:
        """What this failure says about the paid provider, for its circuit (TASK-566).

        Only read where the failure comes from a provider call; a source that is
        down is ``PROVIDER_UNAVAILABLE`` too, but never reaches a circuit.
        """
        if self.code == MediaFailureCode.PROVIDER_CREDITS_DEPLETED:
            return ProviderFailure.CREDIT_EXHAUSTED
        if self.code == MediaFailureCode.PROVIDER_AUTH_FAILED:
            return ProviderFailure.ACCOUNT_REFUSED
        if self.code == MediaFailureCode.PROVIDER_RATE_LIMITED:
            return ProviderFailure.RATE_LIMITED
        if self.retryable and self.code in (MediaFailureCode.PROVIDER_UNAVAILABLE, MediaFailureCode.PROVIDER_TIMED_OUT):
            return ProviderFailure.TRANSIENT
        return None

    @property
    def reason(self) -> str:
        """`CODE:reason_token` — what logs and failure events carry."""
        return f"{self.code.value}:{self.details}"

    def error_metadata(self, *, step: Optional[str] = None) -> Dict[str, Any]:
        """The structured context to persist on the job."""
        metadata: Dict[str, Any] = {"reason": self.details}
        if step:
            metadata["step"] = step
        metadata.update(self.context)
        return metadata


class PermanentIngestionFailure(IngestionFailure):
    """The same input gets the same answer: the job fails now, nothing is retried."""

    def __init__(self, code: MediaFailureCode, *, details: str, **context: Any) -> None:
        super().__init__(code, details=details, retryable=False, **context)


class TransientIngestionFailure(IngestionFailure):
    """Worth another delivery: the job fails with this code only on the last one."""

    def __init__(self, code: MediaFailureCode, *, details: str, **context: Any) -> None:
        super().__init__(code, details=details, retryable=True, **context)
