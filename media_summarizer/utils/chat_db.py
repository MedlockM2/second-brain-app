"""
DynamoDB operations for the ``chat`` table (task-457).

Schema, states and write conditions: ``docs/CHAT_DATA_MODEL.md``. Models:
``core/models/chat.py``.

Every state-changing write of the chat goes through this module, so the API and
the worker share one set of conditions instead of each writing its own. Three
guarantees of the owner's Decision (task-430, points 3 and 6) live here:

- **an ended generation can never be written to again.** Each write made on
  behalf of an attempt is conditional on that attempt still being live, so a
  worker that comes back after its turn was sealed is fenced out;
- **the terminal state is persisted before anyone is told.** :func:`seal_turn`
  writes the final text and the terminal status atomically and returns only once
  DynamoDB has committed them; the stream and the app read the sealed message,
  never a worker's own idea of having finished;
- **a turn is accepted whole or not at all** (:func:`accept_turn`). The API then
  sends it to the chat queue itself; a turn whose send or generation is lost is
  sealed by :func:`seal_lost_attempt` and never relaunched (owner amendment of
  2026-10-11 under Decision point 4).

Refusals follow ``utils/media_artifacts.py``: a write refused because the state
moved on returns ``False`` (the caller lost a race and acknowledges), anything
else raises.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer
from botocore.exceptions import ClientError
from pydantic import TypeAdapter

from media_summarizer.core.models.chat import (
    TERMINAL_TURN_STATUSES,
    TITLE_MAX_CHARS,
    TURN_IN_FLIGHT_GUARD,
    TURN_IN_FLIGHT_SK,
    ChatAssistantMessage,
    ChatAttempt,
    ChatAttemptStatus,
    ChatConversation,
    ChatConversationSummary,
    ChatFragment,
    ChatInterruptionCause,
    ChatRole,
    ChatScope,
    ChatTurnStatus,
    ChatUserMessage,
    attempt_sk,
    attempts_prefix,
    conversation_children_prefix,
    conversation_sk,
    fragment_sk,
    fragments_prefix,
    lost_cutoffs,
    message_sk,
    messages_prefix,
    new_attempt_id,
    new_turn_id,
    scope_activity_key,
    scope_activity_prefix,
)
from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.utils.database_async import (
    _dynamodb_client_kwargs,
    _log_dynamodb_error,
    get_session,
)
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)

CHAT_TABLE = required_env("CHAT_TABLE")
SCOPE_ACTIVITY_INDEX = "scope-activity-index"

_serializer = TypeSerializer()
_DATETIME: TypeAdapter[datetime] = TypeAdapter(datetime)
_deserializer = TypeDeserializer()

ChatMessage = Union[ChatUserMessage, ChatAssistantMessage]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _key(user_id: str, sk: str) -> Dict[str, str]:
    return {"user_id": user_id, "sk": sk}


def _serialize(value: Dict[str, Any]) -> Dict[str, Any]:
    return {name: _serializer.serialize(item) for name, item in value.items()}


def _deserialize(value: Dict[str, Any]) -> Dict[str, Any]:
    return {name: _deserializer.deserialize(item) for name, item in value.items()}


def _is_conditional_failure(exc: ClientError) -> bool:
    return exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def _cancellation_codes(exc: ClientError) -> Optional[List[str]]:
    """Per-item codes of a cancelled transaction, or ``None`` if it was not one."""
    if exc.response.get("Error", {}).get("Code") != "TransactionCanceledException":
        return None
    return [reason.get("Code", "None") for reason in exc.response.get("CancellationReasons", [])]


def _refused_by_condition(exc: ClientError) -> bool:
    """A cancelled transaction where every failing item failed its condition.

    Anything else — a throttle, a conflict with a concurrent transaction, a
    validation error — is not "the state moved on" and must reach the caller.
    """
    codes = _cancellation_codes(exc)
    if not codes:
        return False
    failing = [code for code in codes if code not in ("None", "")]
    return bool(failing) and all(code == "ConditionalCheckFailed" for code in failing)


class _Transaction:
    """Builder of one ``TransactWriteItems`` call on the chat table."""

    def __init__(self) -> None:
        self.items: List[Dict[str, Any]] = []

    def put(
        self,
        item: Dict[str, Any],
        *,
        condition: str = "attribute_not_exists(sk)",
        values: Optional[Dict[str, Any]] = None,
    ) -> None:
        operation: Dict[str, Any] = {
            "TableName": CHAT_TABLE,
            "Item": _serialize(item),
            "ConditionExpression": condition,
        }
        if values:
            operation["ExpressionAttributeValues"] = _serialize(values)
        self.items.append({"Put": operation})

    def update(
        self,
        key: Dict[str, str],
        *,
        update: str,
        condition: str,
        names: Optional[Dict[str, str]] = None,
        values: Optional[Dict[str, Any]] = None,
        return_old_on_failure: bool = False,
    ) -> None:
        operation: Dict[str, Any] = {
            "TableName": CHAT_TABLE,
            "Key": _serialize(key),
            "UpdateExpression": update,
            "ConditionExpression": condition,
        }
        if names:
            operation["ExpressionAttributeNames"] = names
        if values:
            operation["ExpressionAttributeValues"] = _serialize(values)
        if return_old_on_failure:
            operation["ReturnValuesOnConditionCheckFailure"] = "ALL_OLD"
        self.items.append({"Update": operation})

    def check(
        self,
        key: Dict[str, str],
        *,
        condition: str,
        names: Optional[Dict[str, str]] = None,
        values: Optional[Dict[str, Any]] = None,
    ) -> None:
        operation: Dict[str, Any] = {
            "TableName": CHAT_TABLE,
            "Key": _serialize(key),
            "ConditionExpression": condition,
        }
        if names:
            operation["ExpressionAttributeNames"] = names
        if values:
            operation["ExpressionAttributeValues"] = _serialize(values)
        self.items.append({"ConditionCheck": operation})

    async def commit(self, operation: str, *, user_id: str, token: Optional[str] = None) -> None:
        kwargs: Dict[str, Any] = {"TransactItems": self.items}
        if token:
            # DynamoDB treats a repeat with the same token within ten minutes as
            # the same call: it succeeds without applying the writes twice.
            kwargs["ClientRequestToken"] = token
        try:
            session = get_session()
            async with session.client("dynamodb", **_dynamodb_client_kwargs()) as client:
                await client.transact_write_items(**kwargs)
        except ClientError as exc:
            if not _refused_by_condition(exc):
                _log_dynamodb_error(operation, exc, table=CHAT_TABLE, user_id=user_id)
            raise


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


class ConversationAlreadyExistsError(Exception):
    """A conversation with this id already exists in the account."""


async def create_conversation(conversation: ChatConversation) -> ChatConversation:
    """Write a new conversation with its frozen source snapshot.

    The only write that sets ``source_snapshot``: every later update names the
    attributes it changes, and none of them names that one.
    """
    session = get_session()
    try:
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(CHAT_TABLE)
            await table.put_item(
                Item=conversation.to_dynamodb_item(),
                ConditionExpression="attribute_not_exists(sk)",
            )
            return conversation
    except ClientError as exc:
        if _is_conditional_failure(exc):
            raise ConversationAlreadyExistsError(conversation.conversation_id) from exc
        _log_dynamodb_error("chat.create_conversation", exc, table=CHAT_TABLE, user_id=conversation.user_id)
        raise


async def _get_item(user_id: str, sk: str) -> Optional[Dict[str, Any]]:
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        response = await table.get_item(Key=_key(user_id, sk), ConsistentRead=True)
        return response.get("Item")


async def _query_range(
    user_id: str,
    prefix: str,
    *,
    projection: Optional[Sequence[str]] = None,
) -> List[Dict[str, Any]]:
    """Every item of one sort-key prefix, strongly consistent, fully paginated."""
    session = get_session()
    items: List[Dict[str, Any]] = []
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        kwargs: Dict[str, Any] = {
            "KeyConditionExpression": Key("user_id").eq(user_id) & Key("sk").begins_with(prefix),
            "ConsistentRead": True,
        }
        if projection:
            names = {f"#p{index}": name for index, name in enumerate(projection)}
            kwargs["ProjectionExpression"] = ", ".join(names)
            kwargs["ExpressionAttributeNames"] = names
        while True:
            response = await table.query(**kwargs)
            items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                return items
            kwargs["ExclusiveStartKey"] = last_key


async def get_conversation(user_id: str, conversation_id: str) -> Optional[ChatConversation]:
    """The conversation, only if it belongs to ``user_id``: the key carries the account."""
    item = await _get_item(user_id, conversation_sk(conversation_id))
    return ChatConversation.from_dynamodb_item(item) if item else None


async def list_conversations_by_scope(
    *,
    user_id: str,
    scope: ChatScope,
    scope_id: str,
    limit: int = 20,
    cursor: Optional[Dict[str, Any]] = None,
) -> Tuple[List[ChatConversationSummary], Optional[Dict[str, Any]]]:
    """The account's conversations on one media or folder, latest activity first.

    One query on the LSI, which projects what a history row draws. Returns the
    page and the ``LastEvaluatedKey`` to pass back as ``cursor``, ``None`` on the
    last page.
    """
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        kwargs: Dict[str, Any] = {
            "IndexName": SCOPE_ACTIVITY_INDEX,
            "KeyConditionExpression": Key("user_id").eq(user_id)
            & Key("scope_activity_key").begins_with(scope_activity_prefix(scope, scope_id)),
            "ScanIndexForward": False,
            "Limit": limit,
        }
        if cursor:
            kwargs["ExclusiveStartKey"] = cursor
        response = await table.query(**kwargs)
    summaries = [ChatConversationSummary.model_validate(item) for item in response.get("Items", [])]
    return summaries, response.get("LastEvaluatedKey")


async def list_messages(user_id: str, conversation_id: str) -> List[ChatMessage]:
    """The conversation's messages in order: each question, then its answer."""
    messages: List[ChatMessage] = []
    for item in await _query_range(user_id, messages_prefix(conversation_id)):
        if item["kind"] == ChatUserMessage.KIND:
            messages.append(ChatUserMessage.from_dynamodb_item(item))
        else:
            messages.append(ChatAssistantMessage.from_dynamodb_item(item))
    return messages


async def get_assistant_message(user_id: str, conversation_id: str, turn_index: int) -> Optional[ChatAssistantMessage]:
    item = await _get_item(user_id, message_sk(conversation_id, turn_index, ChatRole.ASSISTANT))
    return ChatAssistantMessage.from_dynamodb_item(item) if item else None


# ---------------------------------------------------------------------------
# Accepting a turn
# ---------------------------------------------------------------------------


class TurnNotAcceptedError(Exception):
    """The conversation refused a new turn. ``reason`` says why.

    - ``conversation_not_found``: no such conversation in this account;
    - ``turn_in_progress``: a turn of this conversation is still running;
    - ``account_turn_in_flight``: a turn of another conversation of the account
      is still running (the per-account marker, task-462);
    - ``turn_count_changed``: another turn was accepted since the caller read
      the conversation — re-read before deciding anything.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class AcceptedTurn:
    question: ChatUserMessage
    answer: ChatAssistantMessage
    attempt: ChatAttempt


async def accept_turn(
    *,
    user_id: str,
    conversation_id: str,
    expected_turn_count: int,
    question_text: str,
    turn_id: Optional[str] = None,
    idempotency_token: Optional[str] = None,
) -> AcceptedTurn:
    """Record a turn and its attempt in one transaction.

    Four writes, all or none: the conversation takes the turn and marks it as the
    live generation, the question and the empty answer are written, and the
    attempt is queued. Nothing is sent to SQS from here: the caller sends the
    message once this has committed (``chat_service.send_turn``).

    ``expected_turn_count`` is the ``turn_count`` the caller read: the condition
    on it makes two concurrent submissions on one conversation one turn.
    ``idempotency_token`` is passed to DynamoDB as ``ClientRequestToken``, so a
    retried request inside ten minutes does not write the turn twice.

    A fifth item takes the account's turn-in-flight marker (task-462): one turn
    in flight per account, all conversations together. The put is conditional on
    no live marker -- absent, or past its :data:`TURN_IN_FLIGHT_GUARD` -- so two
    submissions on two conversations cannot both win. ``seal_turn`` and
    ``delete_conversation`` release it.

    Raises :class:`TurnNotAcceptedError` when the conversation refuses.
    """
    # Read for the scope, which the history index key is built from. The
    # decision itself is the transaction's condition, not this read.
    conversation = await get_conversation(user_id, conversation_id)
    if conversation is None:
        raise TurnNotAcceptedError("conversation_not_found")
    now = _now()
    turn_index = expected_turn_count + 1
    turn_id = turn_id or new_turn_id()
    attempt_id = new_attempt_id()
    question = ChatUserMessage(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_id=turn_id,
        turn_index=turn_index,
        text=question_text,
        created_at=now,
    )
    answer = ChatAssistantMessage(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_id=turn_id,
        turn_index=turn_index,
        attempt_id=attempt_id,
        created_at=now,
    )
    attempt = ChatAttempt(
        user_id=user_id,
        conversation_id=conversation_id,
        turn_id=turn_id,
        turn_index=turn_index,
        attempt_id=attempt_id,
        created_at=now,
    )
    conversation_key = _key(user_id, conversation_sk(conversation_id))
    transaction = _Transaction()
    transaction.update(
        conversation_key,
        update=(
            "SET turn_count = :next, active_turn_id = :turn, active_turn_index = :index, "
            "active_attempt_id = :attempt, last_turn_status = :accepted, "
            "updated_at = :now, last_activity_at = :now, "
            "scope_activity_key = :activity, title = if_not_exists(title, :title)"
        ),
        condition=("attribute_exists(sk) AND attribute_not_exists(active_attempt_id) AND turn_count = :expected"),
        values={
            ":next": turn_index,
            ":expected": expected_turn_count,
            ":turn": turn_id,
            ":index": turn_index,
            ":attempt": attempt_id,
            ":accepted": ChatTurnStatus.ACCEPTED.value,
            ":now": now.isoformat(),
            ":activity": scope_activity_key(conversation.scope, conversation.scope_id, now),
            ":title": question_text.strip()[:TITLE_MAX_CHARS],
        },
        return_old_on_failure=True,
    )
    transaction.put(question.to_dynamodb_item())
    transaction.put(answer.to_dynamodb_item())
    transaction.put(attempt.to_dynamodb_item())
    transaction.put(
        {
            "user_id": user_id,
            "sk": TURN_IN_FLIGHT_SK,
            "kind": "turn_in_flight",
            "conversation_id": conversation_id,
            "turn_id": turn_id,
            "turn_index": turn_index,
            "in_flight_until": (now + TURN_IN_FLIGHT_GUARD).isoformat(),
        },
        condition="attribute_not_exists(sk) OR in_flight_until < :now",
        values={":now": now.isoformat()},
    )

    try:
        await transaction.commit("chat.accept_turn", user_id=user_id, token=idempotency_token)
    except ClientError as exc:
        if not _refused_by_condition(exc):
            raise
        raise TurnNotAcceptedError(_turn_refusal_reason(exc, expected_turn_count)) from exc
    return AcceptedTurn(question=question, answer=answer, attempt=attempt)


def _turn_refusal_reason(exc: ClientError, expected_turn_count: int) -> str:
    reasons = exc.response.get("CancellationReasons", [])
    first = reasons[0] if reasons else {}
    if first.get("Code") != "ConditionalCheckFailed":
        marker = reasons[4] if len(reasons) > 4 else {}
        if marker.get("Code") == "ConditionalCheckFailed":
            # Another conversation of the account holds a live turn.
            return "account_turn_in_flight"
        # The conversation passed and a message key already existed: the turn
        # index was taken, which is a turn count that moved under the caller.
        return "turn_count_changed"
    old = first.get("Item")
    if not old:
        return "conversation_not_found"
    conversation = _deserialize(old)
    if conversation.get("active_attempt_id"):
        return "turn_in_progress"
    if int(conversation.get("turn_count", 0)) != expected_turn_count:
        return "turn_count_changed"
    return "conversation_not_found"


# ---------------------------------------------------------------------------
# Attempts: claim, lease, cancellation
# ---------------------------------------------------------------------------


async def get_attempt(user_id: str, conversation_id: str, turn_index: int, attempt_id: str) -> Optional[ChatAttempt]:
    item = await _get_item(user_id, attempt_sk(conversation_id, turn_index, attempt_id))
    return ChatAttempt.from_dynamodb_item(item) if item else None


async def list_attempts(user_id: str, conversation_id: str, turn_index: Optional[int] = None) -> List[ChatAttempt]:
    return [ChatAttempt.from_dynamodb_item(item) for item in await _query_range(user_id, attempts_prefix(conversation_id, turn_index))]


async def claim_attempt(
    *,
    user_id: str,
    conversation_id: str,
    turn_index: int,
    attempt_id: str,
    lease_expires_at: datetime,
) -> bool:
    """Start generating an attempt under a lease, or refuse.

    Only a ``queued`` attempt that is still the turn's current one can be
    claimed. ``False`` means the delivery is a duplicate, or the attempt already
    ended: the worker acknowledges without calling the provider. An attempt whose
    lease expired is *not* claimable again: a redelivery never relaunches a
    generation, and the lost turn is sealed instead (:func:`seal_lost_attempt`).

    The worker re-reads the attempt afterwards: a stop requested before the
    claim is already on it.
    """
    now = _now().isoformat()
    transaction = _Transaction()
    transaction.update(
        _key(user_id, attempt_sk(conversation_id, turn_index, attempt_id)),
        update="SET #st = :generating, lease_expires_at = :lease, started_at = :now",
        condition="attribute_exists(sk) AND #st = :queued",
        names={"#st": "status"},
        values={
            ":generating": ChatAttemptStatus.GENERATING.value,
            ":queued": ChatAttemptStatus.QUEUED.value,
            ":lease": lease_expires_at.isoformat(),
            ":now": now,
        },
    )
    transaction.update(
        _key(user_id, message_sk(conversation_id, turn_index, ChatRole.ASSISTANT)),
        update="SET #st = :generating, started_at = if_not_exists(started_at, :now)",
        condition="attempt_id = :attempt AND #st IN (:accepted, :generating)",
        names={"#st": "status"},
        values={
            ":generating": ChatTurnStatus.GENERATING.value,
            ":accepted": ChatTurnStatus.ACCEPTED.value,
            ":attempt": attempt_id,
            ":now": now,
        },
    )
    transaction.update(
        _key(user_id, conversation_sk(conversation_id)),
        update="SET last_turn_status = :generating, updated_at = :now",
        condition="active_attempt_id = :attempt",
        values={
            ":generating": ChatTurnStatus.GENERATING.value,
            ":attempt": attempt_id,
            ":now": now,
        },
    )
    try:
        await transaction.commit("chat.claim_attempt", user_id=user_id)
        return True
    except ClientError as exc:
        if _refused_by_condition(exc):
            return False
        raise


async def renew_attempt_lease(
    *,
    user_id: str,
    conversation_id: str,
    turn_index: int,
    attempt_id: str,
    lease_expires_at: datetime,
) -> bool:
    """Extend a generating attempt's lease. ``False``: it is no longer live — stop."""
    session = get_session()
    try:
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(CHAT_TABLE)
            await table.update_item(
                Key=_key(user_id, attempt_sk(conversation_id, turn_index, attempt_id)),
                UpdateExpression="SET lease_expires_at = :lease",
                ConditionExpression="attribute_exists(sk) AND #st = :generating",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={
                    ":lease": lease_expires_at.isoformat(),
                    ":generating": ChatAttemptStatus.GENERATING.value,
                },
            )
            return True
    except ClientError as exc:
        if _is_conditional_failure(exc):
            return False
        _log_dynamodb_error("chat.renew_attempt_lease", exc, table=CHAT_TABLE, user_id=user_id)
        raise


async def request_cancellation(
    *,
    user_id: str,
    conversation_id: str,
    turn_index: int,
    attempt_id: str,
) -> bool:
    """Record a stop request on a live attempt (Decision point 6).

    Conditional on the attempt named by the caller still being live, so a stop
    aimed at a generation that has ended is refused. Asking twice is harmless: the first request time is
    kept. The worker observes the request; this write stops nothing by itself.
    """
    session = get_session()
    try:
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(CHAT_TABLE)
            await table.update_item(
                Key=_key(user_id, attempt_sk(conversation_id, turn_index, attempt_id)),
                UpdateExpression=("SET cancel_requested_at = if_not_exists(cancel_requested_at, :now)"),
                ConditionExpression="attribute_exists(sk) AND #st IN (:queued, :generating)",
                ExpressionAttributeNames={"#st": "status"},
                ExpressionAttributeValues={
                    ":now": _now().isoformat(),
                    ":queued": ChatAttemptStatus.QUEUED.value,
                    ":generating": ChatAttemptStatus.GENERATING.value,
                },
            )
            return True
    except ClientError as exc:
        if _is_conditional_failure(exc):
            return False
        _log_dynamodb_error("chat.request_cancellation", exc, table=CHAT_TABLE, user_id=user_id)
        raise


# ---------------------------------------------------------------------------
# Fragments
# ---------------------------------------------------------------------------


class FragmentAlreadyWrittenError(Exception):
    """This attempt already wrote a fragment with this sequence number."""


async def append_fragment(fragment: ChatFragment) -> bool:
    """Write one flush of streamed text, fenced on its attempt being live.

    The fragment and a condition check on its attempt (``generating``) commit
    together, so a worker whose attempt was sealed -- by itself, a stop, or a
    reader that found it lost -- can no longer add text. Returns ``False`` in that case: the worker stops. A sequence
    number written twice raises :class:`FragmentAlreadyWrittenError` — the
    worker numbers its own flushes, so that is a bug, not a race.
    """
    transaction = _Transaction()
    transaction.check(
        _key(
            fragment.user_id,
            attempt_sk(fragment.conversation_id, fragment.turn_index, fragment.attempt_id),
        ),
        condition="#st = :generating",
        names={"#st": "status"},
        values={":generating": ChatAttemptStatus.GENERATING.value},
    )
    transaction.put(fragment.to_dynamodb_item())
    try:
        await transaction.commit("chat.append_fragment", user_id=fragment.user_id)
        return True
    except ClientError as exc:
        codes = _cancellation_codes(exc) or []
        if not _refused_by_condition(exc):
            raise
        if codes and codes[0] == "ConditionalCheckFailed":
            return False
        raise FragmentAlreadyWrittenError(f"{fragment.attempt_id} seq {fragment.seq}") from exc


async def list_fragments(
    *,
    user_id: str,
    conversation_id: str,
    attempt_id: str,
    after_seq: int = -1,
    limit: int = 200,
) -> List[ChatFragment]:
    """Fragments of one attempt with ``seq > after_seq``, in order, strongly consistent.

    ``after_seq`` is the stream's resume cursor: the last sequence the client
    has. ``-1`` replays from the start.
    """
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        response = await table.query(
            KeyConditionExpression=Key("user_id").eq(user_id)
            & Key("sk").between(
                fragment_sk(conversation_id, attempt_id, after_seq + 1),
                fragment_sk(conversation_id, attempt_id, 99_999_999),
            ),
            ConsistentRead=True,
            Limit=limit,
        )
    return [ChatFragment.from_dynamodb_item(item) for item in response.get("Items", [])]


async def get_last_fragment_seq(*, user_id: str, conversation_id: str, attempt_id: str) -> Optional[int]:
    """The highest sequence persisted for an attempt, ``None`` before the first flush."""
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        response = await table.query(
            KeyConditionExpression=Key("user_id").eq(user_id) & Key("sk").begins_with(fragments_prefix(conversation_id, attempt_id)),
            ConsistentRead=True,
            ScanIndexForward=False,
            Limit=1,
            ProjectionExpression="seq",
        )
    items = response.get("Items", [])
    return int(items[0]["seq"]) if items else None


# ---------------------------------------------------------------------------
# Sealing a turn
# ---------------------------------------------------------------------------


async def seal_turn(
    *,
    user_id: str,
    conversation_id: str,
    turn_index: int,
    attempt_id: str,
    status: ChatTurnStatus,
    text: Optional[str] = None,
    interruption_cause: Optional[ChatInterruptionCause] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    llm_usage: Optional[ArtifactLlmUsage] = None,
    only_if_lost_at: Optional[datetime] = None,
) -> bool:
    """Persist a turn's final answer and terminal state, from its live attempt only.

    One transaction: the attempt ends (from ``queued`` or ``generating``), the
    answer takes the text, the status and its cause — conditional on naming this
    attempt and not being terminal yet — and the conversation releases the live
    generation, conditional on it being this attempt. An attempt that already
    ended fails every one of those conditions and returns ``False``.

    Returns only after DynamoDB has committed: anything that announces the end of
    a turn (the stream's terminal event, a notification) must come after this
    call and read what it wrote (Decision point 3).

    ``queued`` is accepted as a starting point so that a turn whose attempt was
    never claimed -- its send failed, or it is lost -- can still be sealed.

    ``only_if_lost_at`` narrows the attempt's condition to the lost-turn rule
    evaluated at that instant (:func:`seal_lost_attempt`): still ``queued`` since
    before the queue cutoff, or still ``generating`` with a lease expired before
    the grace cutoff. A worker that renews its lease at the same moment wins.
    """
    if status not in TERMINAL_TURN_STATUSES:
        raise ValueError(f"{status.value} is not a terminal turn status")
    if (status is ChatTurnStatus.INTERRUPTED) != (interruption_cause is not None):
        raise ValueError("an interrupted turn needs a cause, and only an interrupted turn has one")

    now = _now().isoformat()
    answer_set = ["#st = :status", "completed_at = :now"]
    answer_names = {"#st": "status"}
    answer_values: Dict[str, Any] = {
        ":status": status.value,
        ":now": now,
        ":attempt": attempt_id,
        ":accepted": ChatTurnStatus.ACCEPTED.value,
        ":generating": ChatTurnStatus.GENERATING.value,
    }
    for attribute, value in (
        ("text", text),
        ("interruption_cause", interruption_cause.value if interruption_cause else None),
        ("error_code", error_code),
        ("error_message", error_message[:500] if error_message else None),
        ("llm_usage", _usage_item(llm_usage)),
    ):
        if value is not None:
            # `text` is reserved by DynamoDB. Alias every optional field so all
            # terminal paths (completion, stop and lost-turn recovery) can seal.
            answer_names[f"#{attribute}"] = attribute
            answer_set.append(f"#{attribute} = :{attribute}")
            answer_values[f":{attribute}"] = value

    attempt_set = ["#st = :status", "ended_at = :now"]
    attempt_values: Dict[str, Any] = {
        ":status": ChatAttemptStatus(status.value).value,
        ":now": now,
        ":queued": ChatAttemptStatus.QUEUED.value,
        ":generating": ChatAttemptStatus.GENERATING.value,
    }
    if error_code:
        attempt_set.append("error_code = :error_code")
        attempt_values[":error_code"] = error_code

    attempt_condition = "attribute_exists(sk) AND #st IN (:queued, :generating)"
    if only_if_lost_at is not None:
        queued_before, lease_before = lost_cutoffs(only_if_lost_at)
        attempt_condition = (
            "attribute_exists(sk) AND ((#st = :queued AND created_at < :queued_before) "
            "OR (#st = :generating AND lease_expires_at < :lease_before))"
        )
        attempt_values[":queued_before"] = _stored_timestamp(queued_before)
        attempt_values[":lease_before"] = lease_before.isoformat()

    transaction = _Transaction()
    transaction.update(
        _key(user_id, attempt_sk(conversation_id, turn_index, attempt_id)),
        update="SET " + ", ".join(attempt_set) + " REMOVE lease_expires_at",
        condition=attempt_condition,
        names={"#st": "status"},
        values=attempt_values,
    )
    transaction.update(
        _key(user_id, message_sk(conversation_id, turn_index, ChatRole.ASSISTANT)),
        update="SET " + ", ".join(answer_set),
        condition="attempt_id = :attempt AND #st IN (:accepted, :generating)",
        names=answer_names,
        values=answer_values,
    )
    transaction.update(
        _key(user_id, conversation_sk(conversation_id)),
        update=("SET last_turn_status = :status, updated_at = :now REMOVE active_turn_id, active_turn_index, active_attempt_id"),
        condition="active_attempt_id = :attempt",
        values={":status": status.value, ":now": now, ":attempt": attempt_id},
    )
    try:
        await transaction.commit("chat.seal_turn", user_id=user_id)
    except ClientError as exc:
        if _refused_by_condition(exc):
            return False
        raise
    # After the commit and outside it: the marker may already have been taken
    # over by a newer turn past its guard, and that must not make a seal fail.
    await release_turn_in_flight(user_id=user_id, conversation_id=conversation_id, turn_index=turn_index)
    return True


def _stored_timestamp(value: datetime) -> str:
    """A datetime as ``to_dynamodb_item`` stores it, so the two compare as strings.

    Items are written through pydantic's JSON mode, which ends a UTC time with
    ``Z`` where ``isoformat`` writes ``+00:00``.
    """
    return str(_DATETIME.dump_python(value, mode="json"))


async def fragments_text(*, user_id: str, conversation_id: str, attempt_id: str) -> str:
    """Every fragment of an attempt joined in order: the text its stream showed."""
    parts: List[str] = []
    cursor = -1
    while page := await list_fragments(
        user_id=user_id, conversation_id=conversation_id, attempt_id=attempt_id, after_seq=cursor
    ):
        parts.extend(fragment.text for fragment in page)
        cursor = page[-1].seq
    return "".join(parts)


#: The ``error_code`` of a turn sealed because its generation was lost.
GENERATION_LOST = "generation_lost"


async def seal_lost_attempt(attempt: ChatAttempt, *, now: Optional[datetime] = None) -> Optional[ChatTurnStatus]:
    """Seal the turn of a lost attempt (``core/models/chat.is_attempt_lost``).

    Never relaunched (owner amendment of 2026-10-11 under Decision point 4):

    - no visible text: ``failed`` / ``generation_lost``, refundable;
    - some fragments: ``interrupted`` / ``provider_error`` with the text rebuilt
      from them, so the app shows what was read and its retry button.
      ``provider_error`` covers every technical break after text, a lost worker
      included.

    The write is conditional on this attempt and on its lost state at ``now``
    (:func:`seal_turn`, ``only_if_lost_at``), so a worker that renews its lease
    meanwhile wins. Returns the status sealed, ``None`` when refused. The caller
    refunds a ``failed`` seal (``chat_service.seal_if_lost``).
    """
    now = now or _now()
    text = await fragments_text(
        user_id=attempt.user_id, conversation_id=attempt.conversation_id, attempt_id=attempt.attempt_id
    )
    shown = bool(text.strip())
    status = ChatTurnStatus.INTERRUPTED if shown else ChatTurnStatus.FAILED
    sealed = await seal_turn(
        user_id=attempt.user_id,
        conversation_id=attempt.conversation_id,
        turn_index=attempt.turn_index,
        attempt_id=attempt.attempt_id,
        status=status,
        text=text if shown else None,
        interruption_cause=ChatInterruptionCause.PROVIDER_ERROR if shown else None,
        error_code=GENERATION_LOST,
        only_if_lost_at=now,
    )
    return status if sealed else None


async def release_turn_in_flight(*, user_id: str, conversation_id: str, turn_index: Optional[int] = None) -> bool:
    """Remove the account's turn-in-flight marker if it names this turn.

    ``turn_index=None`` releases a marker held by any turn of the conversation
    (a deletion). Best-effort: a marker that survives expires on its guard, so a
    failed release costs at most :data:`TURN_IN_FLIGHT_GUARD` of waiting.
    """
    condition = "conversation_id = :conversation"
    values: Dict[str, Any] = {":conversation": conversation_id}
    if turn_index is not None:
        condition += " AND turn_index = :turn_index"
        values[":turn_index"] = turn_index
    session = get_session()
    try:
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(CHAT_TABLE)
            await table.delete_item(
                Key=_key(user_id, TURN_IN_FLIGHT_SK),
                ConditionExpression=condition,
                ExpressionAttributeValues=values,
            )
            return True
    except ClientError as exc:
        if not _is_conditional_failure(exc):
            _log_dynamodb_error("chat.release_turn_in_flight", exc, table=CHAT_TABLE, user_id=user_id)
        return False


async def get_turn_in_flight(user_id: str) -> Optional[Dict[str, Any]]:
    """The account's marker if it is live, else ``None``."""
    item = await _get_item(user_id, TURN_IN_FLIGHT_SK)
    if not item or str(item.get("in_flight_until", "")) < _now().isoformat():
        return None
    return item


async def record_turn_debit(
    *,
    user_id: str,
    conversation_id: str,
    turn_index: int,
    period_key: str,
    minutes: int,
    cost_eur: float,
) -> None:
    """Write on the turn the debit that was applied for it (task-462).

    Read back by the refund of a turn that never answered, so it credits exactly
    what was charged on the period it was charged to.
    """
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        await table.update_item(
            Key=_key(user_id, message_sk(conversation_id, turn_index, ChatRole.ASSISTANT)),
            UpdateExpression=(
                "SET quota_period_key = :period, quota_minutes_debited = :minutes, quota_cost_eur = :cost"
            ),
            ConditionExpression="attribute_exists(sk)",
            ExpressionAttributeValues={
                ":period": period_key,
                ":minutes": minutes,
                ":cost": Decimal(str(cost_eur)),
            },
        )


def _usage_item(usage: Optional[ArtifactLlmUsage]) -> Optional[Dict[str, Any]]:
    if usage is None:
        return None
    item: Dict[str, Any] = usage.model_dump(exclude_none=True)
    # Same boundary conversion as ``MediaArtifactRecord.to_dynamodb_item``.
    item["cost_eur"] = Decimal(str(usage.cost_eur))
    return item


# ---------------------------------------------------------------------------
# Deletion
# ---------------------------------------------------------------------------


async def delete_conversation(user_id: str, conversation_id: str) -> int:
    """Delete a conversation and every item under it. Idempotent; returns the count.

    Attempts go first: deleting them fences any worker still streaming, since a
    fragment write is conditional on its attempt. The rest of the range is read
    after that, so no fragment written in between is missed, and the
    conversation item goes last — a deletion interrupted half-way leaves a
    conversation the user can still see and delete again. Account erasure does
    not use this: it empties the whole partition
    (``core/services/account_deletion_service.py``).
    """
    deleted = 0
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(CHAT_TABLE)
        for prefix in (attempts_prefix(conversation_id), conversation_children_prefix(conversation_id)):
            for item in await _query_range(user_id, prefix, projection=("sk",)):
                await table.delete_item(Key=_key(user_id, item["sk"]))
                deleted += 1
        if await _get_item(user_id, conversation_sk(conversation_id)) is not None:
            await table.delete_item(Key=_key(user_id, conversation_sk(conversation_id)))
            deleted += 1
    # A turn of this conversation still in flight would otherwise hold the
    # account until its guard expires.
    await release_turn_in_flight(user_id=user_id, conversation_id=conversation_id)
    return deleted
