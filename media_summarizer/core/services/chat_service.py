"""Conversations of the chat: open, list, read, delete (task-461).

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
import json
from dataclasses import dataclass
from typing import List, Optional, Tuple

from media_summarizer.core.models.chat import (
    ChatConversation,
    ChatConversationSummary,
    ChatScope,
    ChatSourceSnapshot,
    new_conversation_id,
    scope_activity_prefix,
)
from media_summarizer.core.services.artifact_service import (
    enforce_scope_ceilings,
    resolve_scope_sources,
)
from media_summarizer.utils import chat_db
from media_summarizer.utils.chat_db import ChatMessage


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


async def _assert_scope_owned(*, user_id: str, scope: ChatScope, scope_id: str) -> None:
    from media_summarizer.utils import database_async
    from media_summarizer.utils import user_media as user_media_store

    if scope == ChatScope.MEDIA:
        if await user_media_store.get_user_media(user_id, scope_id) is None:
            raise ChatScopeNotFoundError(scope=scope.value)
        return
    folder = await database_async.get_folder_by_id(scope_id)
    if folder is None or folder.user_id != user_id:
        raise ChatScopeNotFoundError(scope=scope.value)


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
    await _assert_scope_owned(user_id=user_id, scope=scope, scope_id=scope_id)
    resolution = await resolve_scope_sources(
        user_id=user_id,
        scope=scope,
        scope_id=scope_id,
        reading_language=reading_language,
    )
    enforce_scope_ceilings(resolution)
    if resolution.pending:
        raise ChatScopePreparingError(pending_count=len(resolution.pending))

    snapshot = ChatSourceSnapshot.freeze(
        [source.snapshot() for source in resolution.sources] + resolution.excluded
    )
    conversation = ChatConversation(
        user_id=user_id,
        conversation_id=new_conversation_id(),
        scope=scope,
        scope_id=scope_id,
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
    """The conversation, its messages in order, and the generation to resume."""
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


async def delete_conversation(*, user_id: str, conversation_id: str) -> int:
    """Delete the conversation and every item under it.

    Checked first so a conversation that is not this account's answers 404, not a
    silent success: ``chat_db.delete_conversation`` is idempotent by design.
    """
    if await chat_db.get_conversation(user_id, conversation_id) is None:
        raise ChatConversationNotFoundError()
    return await chat_db.delete_conversation(user_id, conversation_id)


__all__ = [
    "ActiveGeneration",
    "ChatConversationNotFoundError",
    "ChatScopeNotFoundError",
    "ChatScopePreparingError",
    "ChatServiceError",
    "ConversationView",
    "InvalidCursorError",
    "delete_conversation",
    "get_conversation_view",
    "list_conversations",
    "open_conversation",
]
