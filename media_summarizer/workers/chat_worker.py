"""Chat worker: generate one turn's answer, streamed into DynamoDB (task-463).

Owner decision: docs/research/task-430-chatbot-architecture/README.md, Owner
Validation, points 2 to 8. Its own queue and Lambda, independent of the artifact
worker; the LLM call, the corpus and the usage come from the layers shared with it
(``core/services/llm_client.py``, ``llm_corpus.py``) and the prompt and its budget
from ``core/services/chat_prompt.py``, the module the API accepted the turn with.

**Message.** What the outbox relay sends for one dispatch intent (task-458/465):
``{"user_id", "conversation_id", "turn_id", "turn_index", "attempt_id"}``.
Everything else is re-read from the chat table.

**One message, one attempt.** The attempt is claimed under a lease; a duplicate
delivery, or an attempt already replaced or ended, is acknowledged without calling
the provider (Decision point 4). The turn was debited when it was accepted: nothing
here debits. A crash after the provider call can still lead to a second call --
by a replacement attempt with its own identity, never an append to this one.

**Stream.** Deltas are grouped and flushed as numbered fragments every
:data:`FLUSH_INTERVAL_SECONDS`, each write fenced on the attempt still being live.
While streaming, the worker renews its lease and re-reads the stop request; a stop
closes the provider stream and the partial answer is sealed ``interrupted``.

**Endings** (``chat_db.seal_turn`` commits the final text and state before anything
announces the end, Decision point 3):

- the provider finished: ``completed``;
- ``finish_reason == "length"``: ``interrupted`` / ``output_limit`` with the text
  received, or ``failed`` / ``output_limit`` if nothing was shown -- never retried,
  a new attempt would hit the same ceiling;
- a stop: ``interrupted`` / ``cancelled``;
- a provider failure **before** the first text: retried here, a few times, briefly
  (Decision point 2); a permanent refusal is not retried. Exhausted or permanent:
  ``failed``;
- a provider failure **after** text: ``interrupted`` / ``provider_error`` with the
  partial text -- shown text is never taken back (complement C1.11).

A turn sealed ``failed`` with no visible text is refunded
(``chat_service.refund_unanswered_turn``, owner decision of 2026-10-10).

**Redelivery.** The SQS visibility of this queue is set for an interactive turn, not
the artifacts' 30 minutes; a worker that dies mid-turn is recovered from its lease
(task-465), and the late redelivery finds the attempt replaced and stands down.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from media_summarizer.core.models.chat import (
    ChatAttempt,
    ChatConversation,
    ChatFragment,
    ChatInterruptionCause,
    ChatTurnStatus,
    ChatUserMessage,
)
from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.core.services import chat_prompt, chat_service, llm_client, llm_corpus
from media_summarizer.core.services.llm_client import LlmStreamInterruptedError
from media_summarizer.utils import chat_db
from media_summarizer.utils.llm_failure import (
    LLMFailureKind,
    log_llm_generation_failure,
)
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)

logger = logging.getLogger(__name__)

WORKER_NAME = "chat"

#: How long a claim holds the attempt without a renewal. Short, because past it
#: the recovery replaces the attempt (task-465): a dead worker costs the user this
#: long plus the recovery's cadence, not a queue visibility.
LEASE_SECONDS = int(os.environ.get("CHAT_LEASE_SECONDS", "30"))
#: Renewed well before it runs out.
LEASE_RENEW_SECONDS = LEASE_SECONDS / 3
#: Deltas are grouped into one fragment write at most this often (complement C1.8).
FLUSH_INTERVAL_SECONDS = 0.2
#: How often the stop request is re-read while streaming.
CANCEL_CHECK_SECONDS = 1.0
#: Calls to the provider for one attempt when it fails before any text: the first
#: one and two short retries (Decision point 2). Longer outages are not the
#: worker's to ride out -- the turn fails, and is refunded.
MAX_PROVIDER_CALLS = 3
RETRY_BACKOFF_SECONDS = (1.0, 3.0)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class _StreamState:
    """What one attempt's stream has produced, and why it stopped reading."""

    def __init__(self, *, attempt: ChatAttempt, conversation_id: str, user_id: str) -> None:
        self.attempt = attempt
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.buffer: List[str] = []
        self.next_seq = 0
        now = time.monotonic()
        self.last_flush = now
        self.last_renew = now
        self.last_cancel_check = now
        #: Set when the fence refused a write: the attempt is not ours any more.
        self.fenced_out = False
        self.cancel_requested = False

    async def flush(self) -> bool:
        """Write the buffered text as the next fragment. ``False``: fenced out."""
        self.last_flush = time.monotonic()
        if not self.buffer:
            return True
        text = "".join(self.buffer)
        self.buffer = []
        written = await chat_db.append_fragment(
            ChatFragment(
                user_id=self.user_id,
                conversation_id=self.conversation_id,
                turn_id=self.attempt.turn_id,
                turn_index=self.attempt.turn_index,
                attempt_id=self.attempt.attempt_id,
                seq=self.next_seq,
                text=text,
            )
        )
        if not written:
            self.fenced_out = True
            return False
        self.next_seq += 1
        return True

    async def on_delta(self, text: str) -> Optional[bool]:
        """The stream callback: buffer, flush, renew, watch for a stop."""
        self.buffer.append(text)
        now = time.monotonic()
        if now - self.last_flush >= FLUSH_INTERVAL_SECONDS and not await self.flush():
            return False
        if now - self.last_renew >= LEASE_RENEW_SECONDS:
            self.last_renew = now
            if not await chat_db.renew_attempt_lease(
                user_id=self.user_id,
                conversation_id=self.conversation_id,
                turn_index=self.attempt.turn_index,
                attempt_id=self.attempt.attempt_id,
                lease_expires_at=_now() + timedelta(seconds=LEASE_SECONDS),
            ):
                self.fenced_out = True
                return False
        if now - self.last_cancel_check >= CANCEL_CHECK_SECONDS:
            self.last_cancel_check = now
            current = await chat_db.get_attempt(
                self.user_id,
                self.conversation_id,
                self.attempt.turn_index,
                self.attempt.attempt_id,
            )
            if current is not None and current.cancel_requested_at is not None:
                self.cancel_requested = True
                return False
        return None


def _corpus_sources(conversation: ChatConversation) -> List[Dict[str, Any]]:
    """The snapshot's readable sources, in snapshot order, as the corpus reads them."""
    return [
        {
            "media_item_id": source.media_item_id,
            "title": source.title,
            "language": source.language,
            "transcript_s3_key": source.transcript_s3_key,
            "published": source.published,
            "captured": source.captured,
        }
        for source in conversation.source_snapshot.sources
        if not source.excluded
    ]


async def _seal(
    *,
    attempt: ChatAttempt,
    user_id: str,
    conversation_id: str,
    status: ChatTurnStatus,
    text: Optional[str] = None,
    cause: Optional[ChatInterruptionCause] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    usage: Optional[ArtifactLlmUsage] = None,
) -> None:
    sealed = await chat_db.seal_turn(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_index=attempt.turn_index,
        attempt_id=attempt.attempt_id,
        status=status,
        text=text or None,
        interruption_cause=cause,
        error_code=error_code,
        error_message=error_message,
        llm_usage=usage,
    )
    log_event(
        logger,
        logging.INFO if sealed else logging.WARNING,
        "chat.turn.sealed" if sealed else "chat.turn.seal_declined",
        "Chat turn sealed" if sealed else "Attempt no longer live; seal declined",
        status=status.value,
        interruption_cause=cause.value if cause else None,
        error_code=error_code,
        text_chars=len(text or ""),
        prompt_tokens=usage.prompt_tokens if usage else None,
        cached_tokens=usage.cached_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        usage_estimated=usage.usage_estimated if usage else None,
    )
    if usage is not None:
        await llm_client.record_observed_cost(
            user_id,
            usage,
            idempotency_token=f"chat_cost:{attempt.turn_id}:{attempt.attempt_id}",
        )
    if not sealed or status != ChatTurnStatus.FAILED:
        return
    message = await chat_db.get_assistant_message(user_id, conversation_id, attempt.turn_index)
    if message is not None:
        await chat_service.refund_unanswered_turn(user_id=user_id, message=message)


async def _stream_with_retries(
    messages: List[llm_client.LlmMessage],
    *,
    state: _StreamState,
    prompt_cache_key: str,
) -> llm_client.LlmStreamResult:
    """Stream the answer, retrying briefly a transient failure before any text.

    Raises the last error when the calls are exhausted or the failure is permanent,
    and :class:`LlmStreamInterruptedError` as is once text was delivered.
    """
    for call in range(MAX_PROVIDER_CALLS):
        try:
            return await llm_client.stream(
                messages,
                on_delta=state.on_delta,
                prompt_cache_key=prompt_cache_key,
                call=WORKER_NAME,
            )
        except LlmStreamInterruptedError:
            raise
        except Exception as exc:
            transient = getattr(exc, "failure_kind", LLMFailureKind.TRANSIENT) == LLMFailureKind.TRANSIENT
            if not transient or call == MAX_PROVIDER_CALLS - 1:
                raise
            log_event(
                logger,
                logging.WARNING,
                "chat.provider_retry",
                "Provider failed before any text; retrying",
                call=call + 1,
                error_type=type(exc).__name__,
                refusal_reason=getattr(exc, "refusal_reason", None),
            )
            await asyncio.sleep(RETRY_BACKOFF_SECONDS[min(call, len(RETRY_BACKOFF_SECONDS) - 1)])
    raise RuntimeError("unreachable")


async def process_message(message: Dict[str, Any]) -> None:
    """Generate the answer of the attempt named by one chat queue message."""
    body = json.loads(message.get("Body", "{}"))
    user_id = str(body.get("user_id") or "")
    conversation_id = str(body.get("conversation_id") or "")
    attempt_id = str(body.get("attempt_id") or "")
    turn_index = int(body.get("turn_index") or 0)
    if not (user_id and conversation_id and attempt_id and turn_index > 0):
        # Nothing in it can ever be processed: acknowledged, and logged loudly.
        log_event(logger, logging.ERROR, "chat.invalid_message", "Chat message missing identities", body=body)
        return

    context_token = bind_log_context(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_index=turn_index,
        attempt_id=attempt_id,
    )
    try:
        await _process_attempt(
            user_id=user_id,
            conversation_id=conversation_id,
            turn_index=turn_index,
            attempt_id=attempt_id,
        )
    finally:
        reset_log_context(context_token)


async def _process_attempt(
    *, user_id: str, conversation_id: str, turn_index: int, attempt_id: str
) -> None:
    claimed = await chat_db.claim_attempt(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_index=turn_index,
        attempt_id=attempt_id,
        lease_expires_at=_now() + timedelta(seconds=LEASE_SECONDS),
    )
    if not claimed:
        log_event(
            logger,
            logging.INFO,
            "chat.claim_declined",
            "Attempt already claimed, replaced or ended; standing down",
        )
        return

    attempt = await chat_db.get_attempt(user_id, conversation_id, turn_index, attempt_id)
    conversation = await chat_db.get_conversation(user_id, conversation_id)
    if attempt is None or conversation is None:
        # Deleted between the claim and now: nothing left to answer.
        return

    seal_kwargs: Dict[str, Any] = {
        "attempt": attempt,
        "user_id": user_id,
        "conversation_id": conversation_id,
    }
    if attempt.cancel_requested_at is not None:
        # Stopped before it started: nothing was generated, nothing is shown.
        await _seal(**seal_kwargs, status=ChatTurnStatus.INTERRUPTED, cause=ChatInterruptionCause.CANCELLED)
        return

    history_messages = await chat_db.list_messages(user_id, conversation_id)
    question = next(
        (
            item.text
            for item in history_messages
            if isinstance(item, ChatUserMessage) and item.turn_index == turn_index
        ),
        None,
    )
    if question is None:
        await _seal(**seal_kwargs, status=ChatTurnStatus.FAILED, error_code="question_missing")
        return
    history = chat_prompt.history_turns(
        [item for item in history_messages if item.turn_index < turn_index]
    )

    try:
        corpus_sources = await llm_corpus.download_transcripts(_corpus_sources(conversation))
    except Exception as exc:
        # A redelivery could not reclaim this attempt (it is generating now), so
        # failing the message would only leave the turn hanging until recovery.
        log_event(logger, logging.ERROR, "chat.corpus_unavailable", "Could not read the corpus", exc_info=exc)
        await _seal(
            **seal_kwargs,
            status=ChatTurnStatus.FAILED,
            error_code="corpus_unavailable",
            error_message=str(exc),
        )
        return
    messages = chat_prompt.build_messages(
        corpus_sources=corpus_sources,
        language=conversation.language,
        history=history,
        question=question,
    )
    estimated_tokens = chat_prompt.estimate_input_tokens(messages)
    if not chat_prompt.fits_context_budget(estimated_tokens):
        # The same rule the API applied; a corpus that grew since the opening can
        # still push a turn over. Refused, never truncated.
        await _seal(
            **seal_kwargs,
            status=ChatTurnStatus.FAILED,
            error_code="context_budget_exceeded",
            error_message=f"{estimated_tokens} > {chat_prompt.CONTEXT_BUDGET_TOKENS}",
        )
        return

    state = _StreamState(attempt=attempt, conversation_id=conversation_id, user_id=user_id)
    try:
        result = await _stream_with_retries(
            messages,
            state=state,
            prompt_cache_key=chat_prompt.prompt_cache_key(conversation),
        )
    except LlmStreamInterruptedError as exc:
        log_llm_generation_failure(logger, worker=WORKER_NAME, exc=exc, text_emitted=True)
        if not await state.flush() or state.fenced_out:
            return
        await _seal(
            **seal_kwargs,
            status=ChatTurnStatus.INTERRUPTED,
            text=exc.partial_content,
            cause=ChatInterruptionCause.PROVIDER_ERROR,
            error_code="provider_error",
            error_message=str(exc),
            usage=exc.usage,
        )
        return
    except Exception as exc:
        log_llm_generation_failure(logger, worker=WORKER_NAME, exc=exc, text_emitted=False)
        if state.fenced_out:
            return
        refused = getattr(exc, "refusal_reason", None)
        await _seal(
            **seal_kwargs,
            status=ChatTurnStatus.FAILED,
            error_code=f"provider_refused_{refused}" if refused else "provider_unavailable",
            error_message=str(exc),
        )
        return

    if state.fenced_out:
        # Replaced or sealed by someone else while streaming: their state wins.
        log_event(logger, logging.WARNING, "chat.fenced_out", "Attempt no longer live; stopped streaming")
        return
    if not await state.flush():
        return

    text = result.content
    if state.cancel_requested or result.stopped:
        await _seal(
            **seal_kwargs,
            status=ChatTurnStatus.INTERRUPTED,
            text=text,
            cause=ChatInterruptionCause.CANCELLED,
            usage=result.usage,
        )
        return
    if result.finish_reason == "length":
        if text.strip():
            await _seal(
                **seal_kwargs,
                status=ChatTurnStatus.INTERRUPTED,
                text=text,
                cause=ChatInterruptionCause.OUTPUT_LIMIT,
                usage=result.usage,
            )
        else:
            # The whole allowance went into reasoning: nothing to show.
            await _seal(
                **seal_kwargs,
                status=ChatTurnStatus.FAILED,
                error_code="output_limit",
                usage=result.usage,
            )
        return
    if not text.strip():
        await _seal(**seal_kwargs, status=ChatTurnStatus.FAILED, error_code="empty_answer", usage=result.usage)
        return
    await _seal(**seal_kwargs, status=ChatTurnStatus.COMPLETED, text=text, usage=result.usage)

