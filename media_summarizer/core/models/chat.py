"""
Durable state of the conversational chat (task-457).

Owner decision: ``docs/research/task-430-chatbot-architecture/README.md``,
Owner Validation, point 3. The full item schema, the states, their transitions
and the write conditions are in ``docs/CHAT_DATA_MODEL.md``; this module is its
code side.

One table, ``chat``, partitioned by account (``user_id``) with a string sort key
``sk``. Every item of a conversation lives under the ``CONV#<conversation_id>``
prefix, so one conversation is one key range and an account is one partition —
which is what makes deleting a conversation and erasing an account a query and a
loop of deletes. Five kinds of item, deliberately distinct:

- the **conversation** (scope, frozen source snapshot, turn count, the live
  generation if there is one);
- the **messages**: per turn, the user's question and the assistant's answer.
  The assistant message also carries the turn's state, because the answer *is*
  what a turn produces;
- the **attempts**: one per generation run of a turn. An attempt is the identity
  every conditional write is fenced on;
- the **fragments**: the streamed text of one attempt, one item per flush, the
  only items with a TTL;
- the **dispatch intent**: what the outbox relay sends to the chat queue.

Turns are not stored inside the conversation item: complement C1.8 of the
benchmark shows an ``UpdateItem`` is billed on the size of the whole item, so a
growing conversation item would make every write more expensive than the last.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, ClassVar, Dict, List, Optional, Sequence

from pydantic import BaseModel, Field

from media_summarizer.core.models.media_artifact import (
    ArtifactLlmUsage,
    ArtifactScope,
    ArtifactSource,
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


#: A conversation covers what an artifact covers: one media or one folder. The
#: vocabulary is the artifacts' own, so the corpus resolution can be shared.
ChatScope = ArtifactScope

#: How long a fragment outlives its write. Fragments are a transport buffer: the
#: final text is persisted on the assistant message when the turn is sealed, so
#: past the resume window of a stream nothing reads them. One day covers a phone
#: left in the background overnight with a margin; DynamoDB deletes expired items
#: within a few days, at no write cost.
FRAGMENT_TTL = timedelta(days=1)

#: The only TTL attribute of the table, written on fragments and nowhere else.
#: DynamoDB ignores an item without a numeric value in it, which is how
#: conversations and messages are kept forever on a table that has a TTL.
FRAGMENT_TTL_ATTRIBUTE = "fragment_expires_at"

#: Length of the conversation title derived from the first question.
TITLE_MAX_CHARS = 120


class ChatTurnStatus(str, Enum):
    """State of a turn, carried by its assistant message."""

    ACCEPTED = "accepted"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    #: The answer stopped before its end and what was produced is kept. Always
    #: paired with a :class:`ChatInterruptionCause`, so the app can say why.
    INTERRUPTED = "interrupted"


TERMINAL_TURN_STATUSES = frozenset({ChatTurnStatus.COMPLETED, ChatTurnStatus.FAILED, ChatTurnStatus.INTERRUPTED})


class ChatInterruptionCause(str, Enum):
    #: The user asked to stop (Decision point 6).
    CANCELLED = "cancelled"
    #: The provider ended on ``finish_reason == "length"``.
    OUTPUT_LIMIT = "output_limit"
    #: The provider failed after some text had already been streamed: text the
    #: user has seen is not taken back (complement C1.11), so it is a partial
    #: answer, not a failure.
    PROVIDER_ERROR = "provider_error"


class ChatAttemptStatus(str, Enum):
    QUEUED = "queued"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    INTERRUPTED = "interrupted"
    #: Replaced by a newer attempt of the same turn. Terminal: from here the
    #: attempt can write nothing, which is what fences a worker that comes back
    #: after its lease was given up.
    SUPERSEDED = "superseded"


LIVE_ATTEMPT_STATUSES = frozenset({ChatAttemptStatus.QUEUED, ChatAttemptStatus.GENERATING})


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatDispatchStatus(str, Enum):
    PENDING = "pending"
    DISPATCHED = "dispatched"


# ---------------------------------------------------------------------------
# Identities and keys
# ---------------------------------------------------------------------------


def new_conversation_id() -> str:
    return f"cv_{uuid.uuid4().hex}"


def new_turn_id() -> str:
    return f"tn_{uuid.uuid4().hex}"


def new_attempt_id() -> str:
    return f"at_{uuid.uuid4().hex}"


CONVERSATION_PREFIX = "CONV#"

# The role segment of a message key sorts the question before its answer.
_ROLE_ORDER = {ChatRole.USER: "0", ChatRole.ASSISTANT: "1"}


def conversation_sk(conversation_id: str) -> str:
    return f"{CONVERSATION_PREFIX}{conversation_id}"


def conversation_children_prefix(conversation_id: str) -> str:
    """Prefix of every item of a conversation except the conversation itself."""
    return f"{conversation_sk(conversation_id)}#"


def messages_prefix(conversation_id: str) -> str:
    return f"{conversation_children_prefix(conversation_id)}MSG#"


def message_sk(conversation_id: str, turn_index: int, role: ChatRole) -> str:
    return f"{messages_prefix(conversation_id)}{turn_index:04d}#{_ROLE_ORDER[role]}"


def attempts_prefix(conversation_id: str, turn_index: Optional[int] = None) -> str:
    prefix = f"{conversation_children_prefix(conversation_id)}ATT#"
    return prefix if turn_index is None else f"{prefix}{turn_index:04d}#"


def attempt_sk(conversation_id: str, turn_index: int, attempt_id: str) -> str:
    return f"{attempts_prefix(conversation_id, turn_index)}{attempt_id}"


def fragments_prefix(conversation_id: str, attempt_id: str) -> str:
    """Fragments are keyed per attempt: two attempts can never share a range."""
    return f"{conversation_children_prefix(conversation_id)}FRAG#{attempt_id}#"


def fragment_sk(conversation_id: str, attempt_id: str, seq: int) -> str:
    return f"{fragments_prefix(conversation_id, attempt_id)}{seq:08d}"


def dispatch_intent_sk(conversation_id: str, attempt_id: str) -> str:
    return f"{conversation_children_prefix(conversation_id)}OUT#{attempt_id}"


#: Sort key of the account's "turn in flight" marker (task-462): one item per
#: account, outside every ``CONV#`` range, written in the transaction that accepts
#: a turn and removed once that turn is sealed. It is what makes "one turn in
#: flight per account, all conversations together" a condition DynamoDB checks,
#: rather than a query racing a concurrent submission.
TURN_IN_FLIGHT_SK = "INFLIGHT"

#: How long a marker holds the account if its turn is never sealed (a worker that
#: died and a recovery that has not run yet). Past it, a new turn may take the
#: marker over: a stuck turn must not lock an account out of the chat. Above the
#: longest a Lambda generation can live (15 minutes).
TURN_IN_FLIGHT_GUARD = timedelta(minutes=15)


def scope_activity_prefix(scope: ChatScope, scope_id: str) -> str:
    return f"{scope.value}#{scope_id}#"


def scope_activity_key(scope: ChatScope, scope_id: str, last_activity_at: datetime) -> str:
    """Range key of the ``scope-activity-index`` LSI, set on conversations only.

    ``<scope>#<scope_id>#<last activity, ISO-8601 UTC>``: one scope's history is a
    ``begins_with`` query, newest first with ``ScanIndexForward=False``. The
    attribute exists on conversation items alone, so the index stays sparse.
    """
    return f"{scope_activity_prefix(scope, scope_id)}{last_activity_at.isoformat()}"


def fragment_expiry(created_at: datetime) -> int:
    """Epoch seconds, the only format DynamoDB TTL reads."""
    return int((created_at + FRAGMENT_TTL).timestamp())


# ---------------------------------------------------------------------------
# Item serialization
# ---------------------------------------------------------------------------


def _to_dynamodb_value(value: Any) -> Any:
    # DynamoDB rejects binary floats. Through str so the stored decimal matches
    # the rounded amount, like ``MediaArtifactRecord.to_dynamodb_item``.
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_dynamodb_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_dynamodb_value(item) for item in value]
    return value


class _ChatItem(BaseModel):
    """Common shape of every item of the table.

    ``kind`` names the item type on the stored row, so a query over a whole
    conversation range can be dispatched back to the right model, and ``sk`` is
    derived from the identity fields, never stored on the model.
    """

    KIND: ClassVar[str]

    user_id: str
    conversation_id: str

    def sort_key(self) -> str:
        raise NotImplementedError

    def to_dynamodb_item(self) -> Dict[str, Any]:
        item = _to_dynamodb_value(self.model_dump(mode="json", exclude_none=True))
        item["sk"] = self.sort_key()
        item["kind"] = self.KIND
        return item

    @classmethod
    def from_dynamodb_item(cls, item: Dict[str, Any]):
        return cls.model_validate(item)


class ChatSource(ArtifactSource):
    """One line of a conversation's source snapshot.

    The fields of :class:`ArtifactSource` — the transcript key the model reads,
    its language, whether the source was excluded and why — plus ``ref``, the
    tag the corpus gives this source and the one a citation names. It is the
    same ``[S1]`` … ``[Sn]`` as
    ``core/services/llm_corpus.source_label``, in snapshot
    order. ``preparation`` stays unset: a conversation opens on readable sources
    only.

    A readable line also keeps what the corpus header and the context budget
    need without re-reading the library (task-462): ``byte_length`` is the
    transcript-plus-description measure the corpus ceiling was checked on, and
    ``published`` / ``captured`` are the dates the header shows. All three are
    absent on an excluded line.
    """

    #: Set by :meth:`ChatSourceSnapshot.freeze`; a line is never stored without it.
    ref: str = ""
    byte_length: Optional[int] = None
    published: Optional[str] = None
    captured: Optional[str] = None


class ChatSourceSnapshot(BaseModel):
    """The corpus of a conversation, frozen when it is opened.

    Frozen rather than re-read at each turn (README §11.1): a corpus that changed
    at turn 12 would answer on text the eleven previous answers never read, and
    would break the prompt-cache prefix. If the folder changes, the honest answer
    is a new conversation. Nothing in the access layer writes this field after
    the conversation is created.

    ``version`` identifies the exact source set: a hash of the ordered
    ``(media_item_id, transcript_s3_key)`` pairs. Two conversations with the same
    version read the same text in the same order.
    """

    version: str
    taken_at: datetime = Field(default_factory=_now_utc)
    sources: List[ChatSource] = Field(default_factory=list)

    @classmethod
    def freeze(cls, sources: Sequence[ArtifactSource], *, taken_at: Optional[datetime] = None) -> "ChatSourceSnapshot":
        """Number the sources in the given order and fingerprint the set."""
        lines = [
            ChatSource(**source.model_dump(exclude={"preparation", "ref"}), ref=f"[S{index + 1}]")
            for index, source in enumerate(sources)
        ]
        material = json.dumps(
            [[line.media_item_id, line.transcript_s3_key] for line in lines],
            separators=(",", ":"),
        )
        return cls(
            version=f"src_v1_{hashlib.sha256(material.encode()).hexdigest()}",
            taken_at=taken_at or _now_utc(),
            sources=lines,
        )


class ChatConversation(_ChatItem):
    KIND: ClassVar[str] = "conversation"

    scope: ChatScope
    #: The library row id for a media scope, the folder id for a folder scope —
    #: what the app navigates by, like an artifact's ``scope_id``.
    scope_id: str
    #: What the artifacts key their prompt cache on: the ``media_key`` for a media
    #: scope, the folder id for a folder (``artifact_service`` calls it the
    #: content scope id). The chat's ``prompt_cache_key`` is built on the same
    #: material, so a conversation reads the corpus prefix an artifact generation
    #: already cached (README §11.3) without sharing any row.
    content_scope_id: Optional[str] = None
    #: The language answers are written in: the reader's language when the
    #: conversation was opened, frozen with the snapshot so the instructions --
    #: and the cached prefix -- do not move between turns.
    language: Optional[str] = None
    #: The first question, cut to :data:`TITLE_MAX_CHARS`; set by the first turn.
    title: Optional[str] = None
    source_snapshot: ChatSourceSnapshot
    turn_count: int = 0
    #: The generation in flight, if any: the turn and the attempt currently
    #: allowed to produce its answer. Both absent when no turn is running, and
    #: at most one turn runs per conversation.
    active_turn_id: Optional[str] = None
    active_turn_index: Optional[int] = None
    active_attempt_id: Optional[str] = None
    last_turn_status: Optional[ChatTurnStatus] = None
    created_at: datetime = Field(default_factory=_now_utc)
    updated_at: datetime = Field(default_factory=_now_utc)
    last_activity_at: datetime = Field(default_factory=_now_utc)

    def sort_key(self) -> str:
        return conversation_sk(self.conversation_id)

    def to_dynamodb_item(self) -> Dict[str, Any]:
        item = super().to_dynamodb_item()
        item["scope_activity_key"] = scope_activity_key(self.scope, self.scope_id, self.last_activity_at)
        return item


class ChatConversationSummary(BaseModel):
    """A conversation as the ``scope-activity-index`` projects it.

    What a history row draws, without the source snapshot: the index leaves it
    out, so a page of history costs one query on the index alone.
    """

    conversation_id: str
    scope: ChatScope
    scope_id: str
    title: Optional[str] = None
    turn_count: int = 0
    active_turn_id: Optional[str] = None
    last_turn_status: Optional[ChatTurnStatus] = None
    created_at: datetime
    last_activity_at: datetime


#: Attributes projected by the ``scope-activity-index`` (besides the table and
#: index keys, which DynamoDB always projects). Must match the Terraform
#: ``non_key_attributes`` of that index.
SUMMARY_PROJECTED_ATTRIBUTES = (
    "conversation_id",
    "scope",
    "scope_id",
    "title",
    "turn_count",
    "active_turn_id",
    "last_turn_status",
    "created_at",
    "last_activity_at",
)


class ChatUserMessage(_ChatItem):
    KIND: ClassVar[str] = "user_message"

    turn_id: str
    #: 1-based position of the turn in the conversation.
    turn_index: int
    role: ChatRole = ChatRole.USER
    text: str
    created_at: datetime = Field(default_factory=_now_utc)

    def sort_key(self) -> str:
        return message_sk(self.conversation_id, self.turn_index, ChatRole.USER)


class ChatAssistantMessage(_ChatItem):
    """The answer of a turn, and the state of that turn.

    Exists from the moment the turn is accepted, with no ``text``. ``attempt_id``
    is the attempt allowed to produce it: the one a seal must come from, and the
    one whose answer ``text`` holds once sealed. A newer attempt replaces it and
    starts from nothing — its answer is never appended to another's partial.
    """

    KIND: ClassVar[str] = "assistant_message"

    turn_id: str
    turn_index: int
    role: ChatRole = ChatRole.ASSISTANT
    status: ChatTurnStatus = ChatTurnStatus.ACCEPTED
    attempt_id: str
    attempt_count: int = 1
    text: Optional[str] = None
    interruption_cause: Optional[ChatInterruptionCause] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    llm_usage: Optional[ArtifactLlmUsage] = None
    #: The debit of this turn, written once it was applied (task-462): the period
    #: row it landed on, the minutes and their cost. A refund reads them back so
    #: it credits exactly what was charged, on the period it was charged to --
    #: absent when no debit was applied, and then nothing is refunded.
    quota_period_key: Optional[str] = None
    quota_minutes_debited: Optional[int] = None
    quota_cost_eur: Optional[float] = None
    created_at: datetime = Field(default_factory=_now_utc)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def sort_key(self) -> str:
        return message_sk(self.conversation_id, self.turn_index, ChatRole.ASSISTANT)


class ChatAttempt(_ChatItem):
    """One generation run of a turn: the generation identity is (turn, attempt)."""

    KIND: ClassVar[str] = "attempt"

    turn_id: str
    turn_index: int
    attempt_id: str
    #: 1 for the first run of the turn, then +1 per replacement.
    attempt_number: int = 1
    status: ChatAttemptStatus = ChatAttemptStatus.QUEUED
    #: The worker's lease while ``generating``. Past it, the attempt may be
    #: superseded by a new one; it is never re-claimed in place, because its
    #: fragments are already out and a second run would repeat them.
    lease_expires_at: Optional[datetime] = None
    #: Set by the stop route; the worker reads it while streaming. Closing the
    #: stream on the phone does not set it (Decision point 6).
    cancel_requested_at: Optional[datetime] = None
    error_code: Optional[str] = None
    created_at: datetime = Field(default_factory=_now_utc)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    def sort_key(self) -> str:
        return attempt_sk(self.conversation_id, self.turn_index, self.attempt_id)


class ChatFragment(_ChatItem):
    """A flush of streamed text. ``seq`` starts at 0 and grows by 1 per attempt."""

    KIND: ClassVar[str] = "fragment"

    turn_id: str
    #: Carried so the write can check the attempt it belongs to, whose key
    #: includes the turn index.
    turn_index: int
    attempt_id: str
    seq: int
    text: str
    created_at: datetime = Field(default_factory=_now_utc)

    def sort_key(self) -> str:
        return fragment_sk(self.conversation_id, self.attempt_id, self.seq)

    def to_dynamodb_item(self) -> Dict[str, Any]:
        item = super().to_dynamodb_item()
        item[FRAGMENT_TTL_ATTRIBUTE] = fragment_expiry(self.created_at)
        return item


class ChatDispatchIntent(_ChatItem):
    """What the outbox relay sends to the chat queue for one attempt.

    Written in the same transaction as the attempt it launches (Decision point
    4). It carries only what any relay needs — whichever mechanism task-458
    selects — : the identities the worker re-reads everything from, the dispatch
    state and its timestamps.
    """

    KIND: ClassVar[str] = "dispatch_intent"

    turn_id: str
    turn_index: int
    attempt_id: str
    dispatch_status: ChatDispatchStatus = ChatDispatchStatus.PENDING
    created_at: datetime = Field(default_factory=_now_utc)
    dispatched_at: Optional[datetime] = None

    def sort_key(self) -> str:
        return dispatch_intent_sk(self.conversation_id, self.attempt_id)


_ITEM_MODELS: Dict[str, Any] = {
    model.KIND: model
    for model in (
        ChatConversation,
        ChatUserMessage,
        ChatAssistantMessage,
        ChatAttempt,
        ChatFragment,
        ChatDispatchIntent,
    )
}


def chat_item_from_dynamodb(item: Dict[str, Any]) -> _ChatItem:
    """Rebuild any item of the table from its ``kind``."""
    return _ITEM_MODELS[item["kind"]].from_dynamodb_item(item)
