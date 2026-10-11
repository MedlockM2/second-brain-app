"""Conversations of the chat: open, list, read, delete (task-461); send a turn,
stop it, and refund a turn that never answered (task-462); seal a lost turn
(task-470).

Owner decision: docs/research/task-430-chatbot-architecture/README.md, Owner
Validation. Point 1: a multi-turn chat over **one media or one folder**, with a
history the user can find again; the library scope is out. Point 5: these
operations live on the existing HTTP API under ``/api/chat``; only the SSE
stream has its own door. Point 7: the corpus is frozen when the conversation is
opened, versioned, in a stable order, each source with a citable reference.

Everything here goes through ``utils/chat_db.py``, whose keys carry the account:
a conversation read with another account's id simply does not exist.

The scope is resolved exactly as an artifact's is -- ``resolve_scope_sources``
then ``enforce_scope_ceilings`` -- so a folder covers its descendants like the
Sources tab, the corpus ceilings are the artifacts' own (Decision point 8 keeps
them), and the refusals are the ones the app already words.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

from media_summarizer.core.models.chat import (
    ChatAssistantMessage,
    ChatAttempt,
    ChatConversation,
    ChatConversationSummary,
    ChatScope,
    ChatSource,
    ChatSourceSnapshot,
    ChatTurnStatus,
    is_attempt_lost,
    new_conversation_id,
    scope_activity_prefix,
)
from media_summarizer.core.models.media_artifact import ArtifactSource
from media_summarizer.core.services import chat_prompt, quota_enforcer
from media_summarizer.core.services.artifact_service import (
    enforce_scope_ceilings,
    resolve_scope_sources,
)
from media_summarizer.core.services.quota_enforcer import QuotaCheckResult
from media_summarizer.utils import chat_db, sqs
from media_summarizer.utils.chat_db import ChatMessage, TurnNotAcceptedError
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

CHAT_QUEUE = required_env("CHAT_QUEUE")

#: The ``error_code`` of a turn whose message could not be sent to the chat queue.
DISPATCH_FAILED = "dispatch_failed"


class ChatServiceError(Exception):
    """A refusal with a stable code. The figures travel in ``params``, never a sentence."""

    error_code = "chat_error"

    def __init__(self, **params: object) -> None:
        super().__init__(self.error_code)
        self.params = params


class ChatScopeNotFoundError(ChatServiceError):
    """The media or folder does not exist in this account."""

    error_code = "scope_not_found"


class ChatScopePreparingError(ChatServiceError):
    """Some sources are still being transcribed.

    An artifact waits for them (task-360); a conversation cannot: its snapshot is
    frozen at opening and a source that becomes readable later would never enter
    it. Refusing says "come back in a moment" instead of opening a conversation
    that silently leaves part of the folder out.
    """

    error_code = "scope_preparing"


class ChatConversationNotFoundError(ChatServiceError):
    error_code = "conversation_not_found"


class ChatQuestionTooLongError(ChatServiceError):
    error_code = "question_too_long"


class ChatConversationFullError(ChatServiceError):
    error_code = "conversation_full"


class ChatTurnInFlightError(ChatServiceError):
    """A turn of this account -- in this conversation or another -- is still running."""

    error_code = "turn_in_flight"


class ChatTurnCountChangedError(ChatServiceError):
    """Another turn was accepted on this conversation in between: re-read it."""

    error_code = "turn_count_changed"


class ChatContextBudgetExceededError(ChatServiceError):
    error_code = "context_budget_exceeded"


class ChatGenerationStaleError(ChatServiceError):
    """A stop aimed at a generation that is no longer the live one."""

    error_code = "generation_stale"


class ChatQuotaRefusedError(Exception):
    """The minute allowance refused the turn: the existing refusal, as is."""

    def __init__(self, result: QuotaCheckResult) -> None:
        super().__init__(result.error_code)
        self.result = result


@dataclass(frozen=True)
class ActiveGeneration:
    """The generation in flight: what the app resumes the stream from.

    ``last_seq`` is the highest fragment sequence persisted for this attempt,
    ``None`` when none is written yet.
    """

    turn_id: str
    turn_index: int
    attempt_id: str
    last_seq: Optional[int]


@dataclass(frozen=True)
class ConversationView:
    conversation: ChatConversation
    messages: List[ChatMessage]
    active_generation: Optional[ActiveGeneration]


async def _assert_scope_owned(*, user_id: str, scope: ChatScope, scope_id: str) -> str:
    """Refuse a scope that is not this account's; return its content scope id.

    The content scope id is what the artifacts key their prompt cache on: the
    ``media_key`` of a media, the folder id itself for a folder.
    """
    from media_summarizer.utils import database_async
    from media_summarizer.utils import user_media as user_media_store

    if scope == ChatScope.MEDIA:
        record = await user_media_store.get_user_media(user_id, scope_id)
        if record is None:
            raise ChatScopeNotFoundError(scope=scope.value)
        return str(record.media_key)
    folder = await database_async.get_folder_by_id(scope_id)
    if folder is None or folder.user_id != user_id:
        raise ChatScopeNotFoundError(scope=scope.value)
    return scope_id


async def open_conversation(
    *,
    user_id: str,
    scope: ChatScope,
    scope_id: str,
    reading_language: Optional[str],
) -> ChatConversation:
    """Create a conversation over the scope as it reads right now.

    Raises ``ArtifactScopeEmptyError`` / ``ArtifactScopeTooLargeError`` from the
    shared ceilings, :class:`ChatScopeNotFoundError` and
    :class:`ChatScopePreparingError`.

    The snapshot lists the readable sources first, in resolution order, then the
    excluded ones: the readable sources are what the corpus is built from, so
    their ``[S1]…[Sk]`` refs are exactly the tags ``llm_corpus.build_corpus_block``
    gives them, and an excluded source stays on record without shifting a tag.
    """
    content_scope_id = await _assert_scope_owned(user_id=user_id, scope=scope, scope_id=scope_id)
    resolution = await resolve_scope_sources(
        user_id=user_id,
        scope=scope,
        scope_id=scope_id,
        reading_language=reading_language,
    )
    enforce_scope_ceilings(resolution)
    if resolution.pending:
        raise ChatScopePreparingError(pending_count=len(resolution.pending))

    readable: List[ArtifactSource] = [
        ChatSource(
            **source.snapshot().model_dump(exclude={"preparation"}),
            byte_length=source.byte_length,
            published=source.published,
            captured=source.captured,
        )
        for source in resolution.sources
    ]
    snapshot = ChatSourceSnapshot.freeze(readable + resolution.excluded)
    conversation = ChatConversation(
        user_id=user_id,
        conversation_id=new_conversation_id(),
        scope=scope,
        scope_id=scope_id,
        content_scope_id=content_scope_id,
        language=resolution.output_language,
        source_snapshot=snapshot,
    )
    return await chat_db.create_conversation(conversation)


def _encode_cursor(last_key: Optional[dict]) -> Optional[str]:
    if not last_key:
        return None
    material = json.dumps(
        {"sk": last_key["sk"], "a": last_key["scope_activity_key"]},
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(material.encode()).decode().rstrip("=")


def _decode_cursor(
    cursor: Optional[str], *, user_id: str, scope: ChatScope, scope_id: str
) -> Optional[dict]:
    """Rebuild the index key from an opaque cursor, the account from the token.

    The account never comes from the client, and a cursor from another scope is
    refused rather than followed.
    """
    if not cursor:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        material = json.loads(base64.urlsafe_b64decode(padded.encode()))
        sort_key = str(material["sk"])
        activity_key = str(material["a"])
    except (binascii.Error, ValueError, KeyError, TypeError) as exc:
        raise InvalidCursorError() from exc
    if not activity_key.startswith(scope_activity_prefix(scope, scope_id)):
        raise InvalidCursorError()
    return {"user_id": user_id, "sk": sort_key, "scope_activity_key": activity_key}


class InvalidCursorError(ChatServiceError):
    error_code = "invalid_cursor"


async def list_conversations(
    *,
    user_id: str,
    scope: ChatScope,
    scope_id: str,
    limit: int,
    cursor: Optional[str],
) -> Tuple[List[ChatConversationSummary], Optional[str]]:
    """One page of a scope's history, latest activity first."""
    await _assert_scope_owned(user_id=user_id, scope=scope, scope_id=scope_id)
    summaries, last_key = await chat_db.list_conversations_by_scope(
        user_id=user_id,
        scope=scope,
        scope_id=scope_id,
        limit=limit,
        cursor=_decode_cursor(cursor, user_id=user_id, scope=scope, scope_id=scope_id),
    )
    return summaries, _encode_cursor(last_key)


async def get_conversation_view(*, user_id: str, conversation_id: str) -> ConversationView:
    """The conversation, its messages in order, and the generation to resume.

    The read the app falls back on -- back in the foreground, at the end or the
    break of a stream, every 2 s while polling -- is also where a lost turn is
    found and sealed (:func:`seal_if_lost`), so the app sees it failed with its
    retry button instead of waiting on it.
    """
    conversation = await chat_db.get_conversation(user_id, conversation_id)
    if conversation is None:
        raise ChatConversationNotFoundError()
    if await _seal_active_if_lost(conversation):
        conversation = await chat_db.get_conversation(user_id, conversation_id)
        if conversation is None:
            raise ChatConversationNotFoundError()
    messages = await chat_db.list_messages(user_id, conversation_id)

    active: Optional[ActiveGeneration] = None
    if (
        conversation.active_attempt_id
        and conversation.active_turn_id
        and conversation.active_turn_index is not None
    ):
        active = ActiveGeneration(
            turn_id=conversation.active_turn_id,
            turn_index=conversation.active_turn_index,
            attempt_id=conversation.active_attempt_id,
            last_seq=await chat_db.get_last_fragment_seq(
                user_id=user_id,
                conversation_id=conversation_id,
                attempt_id=conversation.active_attempt_id,
            ),
        )
    return ConversationView(conversation=conversation, messages=messages, active_generation=active)


# ---------------------------------------------------------------------------
# Lost turns (task-470)
# ---------------------------------------------------------------------------


async def seal_if_lost(attempt: ChatAttempt) -> bool:
    """Seal the attempt's turn if the lost-turn rule says it is lost.

    The rule is ``core/models/chat.is_attempt_lost``; the conditional write is
    ``chat_db.seal_lost_attempt``. A turn sealed ``failed`` is refunded here, like
    every unanswered turn. ``True`` when this call sealed it.
    """
    if not is_attempt_lost(attempt):
        return False
    status = await chat_db.seal_lost_attempt(attempt)
    if status is None:
        return False
    log_event(
        logger,
        logging.WARNING,
        "chat.turn.lost_sealed",
        "Lost chat generation sealed; the user may ask again",
        user_id=attempt.user_id,
        conversation_id=attempt.conversation_id,
        turn_id=attempt.turn_id,
        attempt_id=attempt.attempt_id,
        attempt_status=attempt.status.value,
        status=status.value,
    )
    if status == ChatTurnStatus.FAILED:
        message = await chat_db.get_assistant_message(
            attempt.user_id, attempt.conversation_id, attempt.turn_index
        )
        if message is not None:
            await refund_unanswered_turn(user_id=attempt.user_id, message=message)
    return True


async def _seal_turn_if_lost(*, user_id: str, conversation_id: str, turn_index: int, attempt_id: str) -> bool:
    attempt = await chat_db.get_attempt(user_id, conversation_id, turn_index, attempt_id)
    return attempt is not None and await seal_if_lost(attempt)


async def _seal_active_if_lost(conversation: ChatConversation) -> bool:
    """Seal the conversation's live generation if it is lost."""
    if not conversation.active_attempt_id or conversation.active_turn_index is None:
        return False
    return await _seal_turn_if_lost(
        user_id=conversation.user_id,
        conversation_id=conversation.conversation_id,
        turn_index=conversation.active_turn_index,
        attempt_id=conversation.active_attempt_id,
    )


async def _seal_in_flight_if_lost(user_id: str) -> bool:
    """Seal the turn the account's in-flight marker names, if it is lost.

    Without this, a lost turn in another conversation would hold the whole account
    off the chat until the marker's guard expires.
    """
    marker = await chat_db.get_turn_in_flight(user_id)
    if not marker:
        return False
    conversation_id = str(marker.get("conversation_id") or "")
    turn_index = int(marker.get("turn_index") or 0)
    if not conversation_id or turn_index <= 0:
        return False
    message = await chat_db.get_assistant_message(user_id, conversation_id, turn_index)
    if message is None:
        return False
    return await _seal_turn_if_lost(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_index=turn_index,
        attempt_id=message.attempt_id,
    )


async def delete_conversation(*, user_id: str, conversation_id: str) -> int:
    """Delete the conversation and every item under it.

    Checked first so a conversation that is not this account's answers 404, not a
    silent success: ``chat_db.delete_conversation`` is idempotent by design.
    """
    if await chat_db.get_conversation(user_id, conversation_id) is None:
        raise ChatConversationNotFoundError()
    return await chat_db.delete_conversation(user_id, conversation_id)


# ---------------------------------------------------------------------------
# Turns (task-462)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AcceptedChatTurn:
    turn_id: str
    turn_index: int
    attempt_id: str
    status: ChatTurnStatus
    #: Minutes this request debited: 0 when the turn was already charged (a
    #: replay) or the debit failed. Kept when the send then failed: the refund
    #: credited them back.
    minutes_debited: int
    #: ``True`` when the request was a retry of a turn already accepted.
    replayed: bool


def turn_id_for_request(*, user_id: str, conversation_id: str, client_request_id: str) -> str:
    """The turn id a client request maps to, the same on every retry of it.

    A phone that lost the answer to its request sends it again with the same
    ``client_request_id``. Deriving the turn id from it is what lets the retry be
    recognised as the turn it already created -- and answered with it, without a
    second turn or a second debit -- instead of being taken for a new question.
    """
    material = f"{user_id}|{conversation_id}|{client_request_id}"
    return f"tn_{hashlib.sha256(material.encode('utf-8')).hexdigest()[:32]}"


def _readable_source_count(conversation: ChatConversation) -> int:
    return sum(1 for source in conversation.source_snapshot.sources if not source.excluded)


async def _replayed_turn(
    *, user_id: str, conversation: ChatConversation, turn_id: str
) -> Optional[ChatAssistantMessage]:
    """The turn this request already created, if it is the conversation's latest."""
    if conversation.turn_count <= 0:
        return None
    latest = await chat_db.get_assistant_message(
        user_id, conversation.conversation_id, conversation.turn_count
    )
    return latest if latest is not None and latest.turn_id == turn_id else None


async def _debit_turn(
    *,
    user_id: str,
    conversation: ChatConversation,
    turn_id: str,
    turn_index: int,
) -> int:
    """Debit the turn under its own token and record the debit on it.

    Idempotent: called again for a replayed request, it finds the token applied
    and writes nothing -- which also charges a turn whose first request died
    between its write and its debit.
    """
    debit = await quota_enforcer.record_chat_turn(
        user_id, source_count=_readable_source_count(conversation), turn_id=turn_id
    )
    if debit.minutes <= 0:
        return 0
    try:
        await chat_db.record_turn_debit(
            user_id=user_id,
            conversation_id=conversation.conversation_id,
            turn_index=turn_index,
            period_key=debit.period_key,
            minutes=debit.minutes,
            cost_eur=debit.cost_eur,
        )
    except Exception as exc:  # noqa: BLE001 - the turn is accepted and charged
        # Only the refund needs this record: losing it means a turn that later
        # fails without text is not refunded, never that it is charged twice.
        log_event(
            logger,
            logging.ERROR,
            "chat.turn_debit_record_failed",
            "Could not record the debit on the turn; a refund would not find it",
            user_id=user_id,
            conversation_id=conversation.conversation_id,
            turn_id=turn_id,
            minutes=debit.minutes,
            exc_info=exc,
        )
    return debit.minutes


async def _answer_replay(
    *, user_id: str, conversation: ChatConversation, replay: ChatAssistantMessage
) -> AcceptedChatTurn:
    return AcceptedChatTurn(
        turn_id=replay.turn_id,
        turn_index=replay.turn_index,
        attempt_id=replay.attempt_id,
        status=replay.status,
        minutes_debited=await _debit_turn(
            user_id=user_id,
            conversation=conversation,
            turn_id=replay.turn_id,
            turn_index=replay.turn_index,
        ),
        replayed=True,
    )


async def send_turn(
    *,
    user_id: str,
    conversation_id: str,
    question: str,
    client_request_id: str,
) -> AcceptedChatTurn:
    """Accept a turn, in the order the checks must run, and debit it once.

    1. The ceilings, as typed refusals: question length, turns per conversation,
       one turn in flight per account.
    2. The context budget of this turn (``chat_prompt``): refused, never cut.
    3. The minute allowance, checked before any write; a refusal debits nothing.
    4. One transaction writes the turn, its question, its attempt and the
       account's in-flight marker.
    5. The debit, after the write and under the logical turn's token, so a failed
       write leaves no debit and a retry or a network resume never debits again.
       It is best-effort like every debit: if it fails, the turn still runs and the
       account is simply not charged for it. When it is applied, its period and
       amount are written on the turn for a possible refund.
    6. The message to the chat queue (:func:`_dispatch_turn`). If the send fails,
       the turn is sealed ``failed`` / ``dispatch_failed`` and refunded, and the
       route still answers with it: the app reads it back failed and offers a retry
       under a new ``client_request_id``. An error response would make the app
       replay the same id, which only finds the same failed turn.

    Before the ceilings, a lost turn that would hold the conversation or the
    account (``core/models/chat.is_attempt_lost``) is sealed, so it does not lock
    either until a guard expires.

    A request repeated with the same ``client_request_id`` is answered with the turn
    it already created (``replayed=True``), and sends nothing.
    """
    text = question.strip()
    if len(text) > chat_prompt.MAX_QUESTION_CHARS:
        raise ChatQuestionTooLongError(length=len(text), max_chars=chat_prompt.MAX_QUESTION_CHARS)

    conversation = await chat_db.get_conversation(user_id, conversation_id)
    if conversation is None:
        raise ChatConversationNotFoundError()

    turn_id = turn_id_for_request(
        user_id=user_id, conversation_id=conversation_id, client_request_id=client_request_id
    )
    replay = await _replayed_turn(user_id=user_id, conversation=conversation, turn_id=turn_id)
    if replay is not None:
        return await _answer_replay(user_id=user_id, conversation=conversation, replay=replay)

    if await _seal_active_if_lost(conversation):
        conversation = await chat_db.get_conversation(user_id, conversation_id)
        if conversation is None:
            raise ChatConversationNotFoundError()
    await _seal_in_flight_if_lost(user_id)

    if conversation.turn_count >= chat_prompt.MAX_TURNS_PER_CONVERSATION:
        raise ChatConversationFullError(
            turn_count=conversation.turn_count,
            max_turns=chat_prompt.MAX_TURNS_PER_CONVERSATION,
        )
    # Read before deciding anything costly; the transaction re-checks both.
    if conversation.active_attempt_id or await chat_db.get_turn_in_flight(user_id):
        raise ChatTurnInFlightError()

    history = chat_prompt.history_turns(await chat_db.list_messages(user_id, conversation_id))
    estimated_tokens = chat_prompt.estimate_turn_input_tokens(
        conversation=conversation, history=history, question=text
    )
    if not chat_prompt.fits_context_budget(estimated_tokens):
        raise ChatContextBudgetExceededError(
            estimated_tokens=estimated_tokens,
            max_tokens=chat_prompt.CONTEXT_BUDGET_TOKENS,
        )

    quota = await quota_enforcer.check_submission_allowed(
        user_id,
        minutes_needed=await quota_enforcer.minutes_for_chat_turn(
            _readable_source_count(conversation)
        ),
    )
    if not quota.allowed:
        raise ChatQuotaRefusedError(quota)

    try:
        accepted = await chat_db.accept_turn(
            user_id=user_id,
            conversation_id=conversation_id,
            expected_turn_count=conversation.turn_count,
            question_text=text,
            turn_id=turn_id,
        )
    except TurnNotAcceptedError as exc:
        if exc.reason == "conversation_not_found":
            raise ChatConversationNotFoundError() from exc
        if exc.reason in ("turn_in_progress", "account_turn_in_flight"):
            raise ChatTurnInFlightError() from exc
        # The turn count moved: either a concurrent request, or this very request
        # retried while its first copy was being written.
        refreshed = await chat_db.get_conversation(user_id, conversation_id)
        replay = (
            await _replayed_turn(user_id=user_id, conversation=refreshed, turn_id=turn_id)
            if refreshed is not None
            else None
        )
        if replay is not None and refreshed is not None:
            return await _answer_replay(user_id=user_id, conversation=refreshed, replay=replay)
        raise ChatTurnCountChangedError() from exc

    minutes = await _debit_turn(
        user_id=user_id,
        conversation=conversation,
        turn_id=turn_id,
        turn_index=accepted.answer.turn_index,
    )
    status = await _dispatch_turn(accepted.attempt)
    return AcceptedChatTurn(
        turn_id=accepted.answer.turn_id,
        turn_index=accepted.answer.turn_index,
        attempt_id=accepted.attempt.attempt_id,
        status=status,
        minutes_debited=minutes,
        replayed=False,
    )


async def _dispatch_turn(attempt: ChatAttempt) -> ChatTurnStatus:
    """Send the accepted turn to the chat worker; seal it failed if that fails.

    The message carries identities only; the worker re-reads everything else
    from the chat table. Returns the turn's status as the route reports it.
    """
    try:
        await sqs.send_message(
            CHAT_QUEUE,
            {
                "user_id": attempt.user_id,
                "conversation_id": attempt.conversation_id,
                "turn_id": attempt.turn_id,
                "turn_index": attempt.turn_index,
                "attempt_id": attempt.attempt_id,
            },
        )
        return ChatTurnStatus.ACCEPTED
    except Exception as exc:  # noqa: BLE001 - any failure to send loses the turn
        log_event(
            logger,
            logging.ERROR,
            "chat.turn.dispatch_failed",
            "Could not send the chat turn to its queue; sealing it failed",
            user_id=attempt.user_id,
            conversation_id=attempt.conversation_id,
            turn_id=attempt.turn_id,
            attempt_id=attempt.attempt_id,
            exc_info=exc,
        )
    sealed = await chat_db.seal_turn(
        user_id=attempt.user_id,
        conversation_id=attempt.conversation_id,
        turn_index=attempt.turn_index,
        attempt_id=attempt.attempt_id,
        status=ChatTurnStatus.FAILED,
        error_code=DISPATCH_FAILED,
    )
    if not sealed:
        # Ended in between (a stop that a worker could not have seen): its state wins.
        message = await chat_db.get_assistant_message(
            attempt.user_id, attempt.conversation_id, attempt.turn_index
        )
        return message.status if message is not None else ChatTurnStatus.FAILED
    message = await chat_db.get_assistant_message(
        attempt.user_id, attempt.conversation_id, attempt.turn_index
    )
    if message is not None:
        await refund_unanswered_turn(user_id=attempt.user_id, message=message)
    return ChatTurnStatus.FAILED


async def stop_turn(
    *,
    user_id: str,
    conversation_id: str,
    turn_id: str,
    attempt_id: str,
) -> None:
    """Record a stop request on the live generation named by the caller.

    Refused as ``generation_stale`` when ``(turn_id, attempt_id)`` is not the
    conversation's live generation any more -- it ended -- so a late tap can never
    stop the wrong answer. This only records the
    request: the worker observes it, stops reading the provider's stream and seals
    the partial answer ``interrupted`` (Decision point 6). Closing the stream on the
    phone is not a stop.
    """
    conversation = await chat_db.get_conversation(user_id, conversation_id)
    if conversation is None:
        raise ChatConversationNotFoundError()
    if (
        conversation.active_turn_id != turn_id
        or conversation.active_attempt_id != attempt_id
        or conversation.active_turn_index is None
    ):
        raise ChatGenerationStaleError()
    recorded = await chat_db.request_cancellation(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_index=conversation.active_turn_index,
        attempt_id=attempt_id,
    )
    if not recorded:
        raise ChatGenerationStaleError()


def is_refundable(message: ChatAssistantMessage) -> bool:
    """**The refund rule**: a turn sealed ``failed`` with no visible text.

    A turn that showed text -- completed, interrupted, or failed after part of its
    answer was read -- consumed what it was charged for and is not refunded.
    """
    return message.status == ChatTurnStatus.FAILED and not (message.text or "").strip()


async def refund_unanswered_turn(*, user_id: str, message: ChatAssistantMessage) -> int:
    """Refund a sealed turn if the rule says so, from the debit it recorded.

    For the callers that seal a turn ``failed`` -- the chat worker (task-463), a
    failed send and a lost turn (task-470) -- right after the seal returned
    ``True``. A turn with no recorded debit (none applied, or its record was lost)
    is not refunded. Idempotent: the refund has its own token.
    """
    if not is_refundable(message):
        return 0
    if not message.quota_period_key or not message.quota_minutes_debited:
        return 0
    return await quota_enforcer.refund_chat_turn(
        user_id,
        turn_id=message.turn_id,
        period_key=message.quota_period_key,
        minutes=message.quota_minutes_debited,
        cost_eur=message.quota_cost_eur or 0.0,
    )


__all__ = [
    "AcceptedChatTurn",
    "ActiveGeneration",
    "ChatContextBudgetExceededError",
    "ChatConversationFullError",
    "ChatGenerationStaleError",
    "ChatQuestionTooLongError",
    "ChatQuotaRefusedError",
    "ChatTurnCountChangedError",
    "ChatTurnInFlightError",
    "ChatConversationNotFoundError",
    "ChatScopeNotFoundError",
    "ChatScopePreparingError",
    "ChatServiceError",
    "ConversationView",
    "InvalidCursorError",
    "delete_conversation",
    "get_conversation_view",
    "list_conversations",
    "is_refundable",
    "open_conversation",
    "refund_unanswered_turn",
    "seal_if_lost",
    "send_turn",
    "stop_turn",
    "turn_id_for_request",
]
