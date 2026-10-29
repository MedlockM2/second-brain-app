"""Chat worker: generate one turn's answer, streamed into DynamoDB (task-463).

Owner decision: docs/research/task-430-chatbot-architecture/README.md, Owner
Validation, points 2 to 8. Its own queue and Lambda, independent of the artifact
worker; the LLM call, the corpus and the usage come from the layers shared with it
(``core/services/llm_client.py``, ``llm_corpus.py``) and the prompt and its budget
from ``core/services/chat_prompt.py``, the module the API accepted the turn with.

**Message.** What the API sends once it has accepted a turn
(``chat_service.send_turn``):
``{"user_id", "conversation_id", "turn_id", "turn_index", "attempt_id"}``.
Everything else is re-read from the chat table.

**One message, one attempt, one generation.** The attempt is claimed under a lease;
a duplicate delivery, or an attempt already ended, is acknowledged without calling
the provider. A generation is never relaunched (owner amendment of 2026-10-11 under Decision point
4): a message whose attempt is already lost (``core/models/chat.is_attempt_lost``)
is sealed instead of answered late, and a redelivery that finds its attempt
``generating`` under an expired lease -- the previous invocation crashed -- seals
the lost turn and acknowledges.

**Stream.** Deltas are grouped and flushed as numbered fragments every
:data:`FLUSH_INTERVAL_SECONDS`, each write fenced on the attempt still being live.
The lease is renewed by a heartbeat for the whole generation, retries and the
model's reasoning before its first token included, so a live worker is never taken
for a lost one. While streaming the worker re-reads the stop request; a stop closes
the provider stream and the partial answer is sealed ``interrupted``.

**Endings** (``chat_db.seal_turn`` commits the final text and state before anything
announces the end, Decision point 3):

- the provider finished: ``completed``;
- ``finish_reason == "length"``: ``interrupted`` / ``output_limit`` with the text
  received, or ``failed`` / ``output_limit`` if nothing was shown -- never retried,
  a new attempt would hit the same ceiling;
- a stop: ``interrupted`` / ``cancelled``;
- a provider failure **before** the first text: retried here, a few times, briefly
  (Decision point 2), each wait at least the provider's ``Retry-After`` plus a
  little jitter; a permanent refusal is not retried, nor a ``Retry-After`` longer
  than :data:`MAX_RETRY_WAIT_SECONDS`. Exhausted, permanent or told to wait too
  long: ``failed`` (``provider_refused_rate_limit`` for the last one);
- a provider failure **after** text: ``interrupted`` / ``provider_error`` with the
  partial text -- shown text is never taken back (complement C1.11).

**Beta budget** (task-549). The turn was admitted when it was accepted
(``chat_service.send_turn``, operation ``chat:<turn_id>``). Every provider call
is sent under an attempt of that operation: the first claims the admission, each
retry before any text reserves its own, bounded by the request about to leave
(rule 6). A turn sealed with visible text — completed, or interrupted after part
of its answer was read — settles its call on the provider's usage, estimated when
the stream lost its usage chunk; a turn sealed with nothing shown releases it, the
tokens billed going to the operator's spend (rule 5). This replaces the minute
refund of 2026-10-10. A retry the budget refuses fails the turn with the refusal's
code.

**Redelivery.** The SQS visibility of this queue is set for an interactive turn, not
the artifacts' 30 minutes. A worker that dies mid-turn leaves its lease to expire;
the next reader -- the app's read of the conversation, the next send, or the
redelivery itself -- seals the turn, and the user asks again.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from media_summarizer.core.models.beta_budget import Component
from media_summarizer.core.models.chat import (
    ChatAttempt,
    ChatAttemptStatus,
    ChatConversation,
    ChatFragment,
    ChatInterruptionCause,
    ChatTurnStatus,
    ChatUserMessage,
    is_attempt_lost,
)
from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.core.services import (
    budget_guard,
    chat_prompt,
    chat_service,
    llm_client,
    llm_corpus,
)
from media_summarizer.core.services.budget_guard import BudgetCall, BudgetRefusedError
from media_summarizer.core.services.llm_client import LlmStreamInterruptedError
from media_summarizer.utils import chat_db
from media_summarizer.utils.llm_failure import (
    LLMFailureKind,
    LlmProviderRefusedError,
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
#: (and ``core/models/chat.LEASE_GRACE``) the turn is lost and sealed by whoever
#: reads it next: a dead worker costs the user this long, not a queue visibility.
LEASE_SECONDS = int(os.environ.get("CHAT_LEASE_SECONDS", "30"))
#: Renewed well before it runs out, by :class:`_LeaseHeartbeat`.
LEASE_RENEW_SECONDS = LEASE_SECONDS / 3
#: Deltas are grouped into one fragment write at most this often (complement C1.8).
FLUSH_INTERVAL_SECONDS = 0.2
#: How often the stop request is re-read while streaming.
CANCEL_CHECK_SECONDS = 1.0
#: Calls to the provider for one attempt when it fails before any text: the first
#: one and two short retries (Decision point 2). Longer outages are not the
#: worker's to ride out -- the turn fails, and its budget is handed back.
MAX_PROVIDER_CALLS = 3
RETRY_BACKOFF_SECONDS = (1.0, 3.0)
#: The longest the worker waits before one retry, ``Retry-After`` included. Past
#: it the provider is asking for more than an interactive turn can hold (the user
#: watches a spinner), so the turn fails at once instead, its budget handed back. Also well
#: under the 30-second lease, which the heartbeat renews during the wait anyway.
#: With :data:`MAX_PROVIDER_CALLS`, a turn spends at most two such waits retrying.
MAX_RETRY_WAIT_SECONDS = 10.0
#: Random spread added to every wait, so concurrent turns refused together do not
#: come back together (OpenAI's rate-limit guide: exponential backoff with jitter).
RETRY_JITTER_SECONDS = 0.5


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
        self.last_cancel_check = now
        #: Set when the fence refused a write: the attempt is not ours any more.
        self.fenced_out = False
        self.cancel_requested = False
        #: The budget operation of the turn, and the call in flight or the last
        #: one that answered: closed by :func:`_seal`.
        self.budget_operation = budget_guard.chat_turn_operation_id(attempt.turn_id)
        self.budget_call: Optional[BudgetCall] = None

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
        """The stream callback: buffer, flush, watch for a stop or a lost lease."""
        if self.fenced_out:
            return False
        self.buffer.append(text)
        now = time.monotonic()
        if now - self.last_flush >= FLUSH_INTERVAL_SECONDS and not await self.flush():
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


class _LeaseHeartbeat:
    """Renews the attempt's lease every :data:`LEASE_RENEW_SECONDS` while it runs.

    Independent of the stream: a reasoning model can think for a minute before its
    first token, and a retry waits between calls, and neither produces a delta. A
    refused renewal means the turn is no longer this worker's (sealed by a stop or
    a reader); the stream state is marked fenced out and stops at its next delta.
    """

    def __init__(self, state: _StreamState) -> None:
        self.state = state
        self.task: Optional[asyncio.Task[None]] = None

    async def _run(self) -> None:
        attempt = self.state.attempt
        while True:
            await asyncio.sleep(LEASE_RENEW_SECONDS)
            try:
                renewed = await chat_db.renew_attempt_lease(
                    user_id=self.state.user_id,
                    conversation_id=self.state.conversation_id,
                    turn_index=attempt.turn_index,
                    attempt_id=attempt.attempt_id,
                    lease_expires_at=_now() + timedelta(seconds=LEASE_SECONDS),
                )
            except Exception as exc:  # noqa: BLE001 - the next beat tries again
                log_event(logger, logging.WARNING, "chat.lease_renew_failed", "Lease renewal failed", exc_info=exc)
                continue
            if not renewed:
                self.state.fenced_out = True
                return

    async def __aenter__(self) -> "_LeaseHeartbeat":
        self.task = asyncio.create_task(self._run())
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        if self.task is not None:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass


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
    state: _StreamState,
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
    await _close_budget(state, delivered=sealed and bool((text or "").strip()), usage=usage)


async def _close_budget(state: _StreamState, *, delivered: bool, usage: Optional[ArtifactLlmUsage]) -> None:
    """Settle the turn's call when text was shown, release it otherwise (rule 5)."""
    call = state.budget_call
    if call is None:
        # No request left for this turn: its admission goes back as never sent.
        await budget_guard.release_held(state.user_id, state.budget_operation, Component.CHAT_TURN)
        return
    cost = None
    if usage is not None:
        try:
            cost = await budget_guard.llm_cost(usage)
        except Exception:  # noqa: BLE001 - the bound stands in for an unpriced usage
            cost = None
    if delivered and cost is not None and usage is not None:
        await call.settle(cost, metric_source=budget_guard.llm_metric_source(usage))
    elif not delivered:
        await call.release(operator_cost=cost)


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
        # Each call is a try of its own on the budget (rule 6): the first claims
        # the turn's admission, a retry reserves its own bound. The chat claim is
        # the exclusive lease, so the budget's is zero.
        state.budget_call = await budget_guard.start(
            state.user_id,
            operation_id=state.budget_operation,
            component=Component.CHAT_TURN,
            line=lambda ctx: budget_guard.llm_call_line(
                ctx, component=Component.CHAT_TURN, messages=messages
            ),
            lease=timedelta(0),
        )
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
            # Nothing was shown: this try goes back, at zero when the provider
            # answered an error, at its bound when the outcome is unknown.
            await state.budget_call.release_for(
                exc, operator_cost=budget_guard.no_cost() if isinstance(exc, LlmProviderRefusedError) else None
            )
            state.budget_call = None
            transient = getattr(exc, "failure_kind", LLMFailureKind.TRANSIENT) == LLMFailureKind.TRANSIENT
            if not transient or call == MAX_PROVIDER_CALLS - 1:
                raise
            retry_after = getattr(exc, "retry_after_seconds", None)
            if retry_after is not None and retry_after > MAX_RETRY_WAIT_SECONDS:
                # Asked to wait longer than a turn can: fail now.
                log_event(
                    logger,
                    logging.WARNING,
                    "chat.provider_retry_abandoned",
                    "Provider asks to wait longer than a chat turn can; not retrying",
                    call=call + 1,
                    retry_after_seconds=retry_after,
                    refusal_reason=getattr(exc, "refusal_reason", None),
                )
                raise
            backoff = RETRY_BACKOFF_SECONDS[min(call, len(RETRY_BACKOFF_SECONDS) - 1)]
            wait = max(backoff, retry_after or 0.0) + random.uniform(0.0, RETRY_JITTER_SECONDS)
            log_event(
                logger,
                logging.WARNING,
                "chat.provider_retry",
                "Provider failed before any text; retrying",
                call=call + 1,
                error_type=type(exc).__name__,
                refusal_reason=getattr(exc, "refusal_reason", None),
                retry_after_seconds=retry_after,
                wait_seconds=round(wait, 2),
            )
            await asyncio.sleep(wait)
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


async def _seal_lost(attempt: ChatAttempt) -> bool:
    """Seal a lost attempt instead of generating it; ``True`` if it was lost."""
    if not is_attempt_lost(attempt):
        return False
    sealed = await chat_service.seal_if_lost(attempt)
    log_event(
        logger,
        logging.WARNING,
        "chat.lost_on_delivery",
        "Delivered attempt is already lost; not generating it",
        attempt_status=attempt.status.value,
        sealed=sealed,
    )
    return True


async def _process_attempt(
    *, user_id: str, conversation_id: str, turn_index: int, attempt_id: str
) -> None:
    queued = await chat_db.get_attempt(user_id, conversation_id, turn_index, attempt_id)
    if queued is None:
        # Deleted with its conversation: nothing left to answer.
        return
    if queued.status == ChatAttemptStatus.QUEUED and await _seal_lost(queued):
        # Delivered too late: the user has been told it failed, or will be at the
        # next read. A late answer would land on a turn the app shows as failed.
        return
    claimed = await chat_db.claim_attempt(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_index=turn_index,
        attempt_id=attempt_id,
        lease_expires_at=_now() + timedelta(seconds=LEASE_SECONDS),
    )
    if not claimed:
        # A duplicate delivery, an ended attempt, or a redelivery after a crash:
        # never generated again. The crashed one's turn is lost once its lease and
        # grace run out; seal it if that is already the case.
        current = await chat_db.get_attempt(user_id, conversation_id, turn_index, attempt_id)
        if current is not None and await _seal_lost(current):
            return
        log_event(
            logger,
            logging.INFO,
            "chat.claim_declined",
            "Attempt already claimed or ended; standing down",
        )
        return

    attempt = await chat_db.get_attempt(user_id, conversation_id, turn_index, attempt_id)
    conversation = await chat_db.get_conversation(user_id, conversation_id)
    if attempt is None or conversation is None:
        # Deleted between the claim and now: nothing left to answer.
        return

    state = _StreamState(attempt=attempt, conversation_id=conversation_id, user_id=user_id)
    async with _LeaseHeartbeat(state):
        await _answer(attempt=attempt, conversation=conversation, state=state)


async def _answer(*, attempt: ChatAttempt, conversation: ChatConversation, state: _StreamState) -> None:
    """Generate and seal the answer of a claimed attempt, under its lease heartbeat."""
    user_id = state.user_id
    conversation_id = state.conversation_id
    turn_index = attempt.turn_index
    seal_kwargs: Dict[str, Any] = {
        "attempt": attempt,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "state": state,
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
        # failing the message would only leave the turn hanging until it is lost.
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

    try:
        result = await _stream_with_retries(
            messages,
            state=state,
            prompt_cache_key=chat_prompt.prompt_cache_key(conversation),
        )
    except BudgetRefusedError as refusal:
        # A retry the month no longer covers, or a counter that cannot be read:
        # nothing was sent under it, and the turn fails with the refusal's code.
        if state.fenced_out:
            return
        await _seal(
            **seal_kwargs,
            status=ChatTurnStatus.FAILED,
            error_code=refusal.error_code,
        )
        return
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
        # Sealed by someone else while streaming: their state wins.
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

