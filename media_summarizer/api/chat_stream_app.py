"""The chat's streaming door: replays and follows a generation's fragments (task-464).

Owner decision, point 5 of docs/research/task-430-chatbot-architecture/README.md:
a distinct Lambda reads the persisted fragments back and sends them to the phone,
FastAPI under uvicorn behind the Lambda Web Adapter (``AWS_LWA_INVOKE_MODE=
response_stream``), behind a regional **REST** API Gateway in ``STREAM`` mode --
never a public Function URL. Everything else of the chat (open, send, stop, read,
delete) stays on the main API under ``/api/chat``.

A minimal app on purpose, not ``api/main.py``: one route, no critical-route guard,
no start-up of the whole API. It generates nothing and calls no LLM: the chat
worker (task-463) writes the fragments, this reads them.

The route takes the **generation identity** -- ``turn_id`` and ``attempt_id`` -- and
a **sequence cursor** (Decision point 6):

- ``204`` when the conversation has no generation in flight, or when the one in
  flight is lost (``core/models/chat.is_attempt_lost``): the app then reads the
  conversation from the main API, which seals a lost turn and shows the final
  answer;
- ``409 generation_stale`` when the identity named is no longer the live one, with
  the live one in the body;
- otherwise ``200 text/event-stream``: the fragments after the cursor are replayed,
  then new ones are followed by re-reading the fragment range every
  :data:`POLL_INTERVAL_SECONDS`. Each event carries its sequence number as its SSE
  ``id`` so the app de-duplicates across reconnections. The terminal ``end`` event
  is sent only once the turn's final state is **read back persisted**, then the
  stream closes. A stream that reaches :data:`MAX_STREAM_SECONDS` ends with
  ``reconnect`` and the app resumes from its cursor.

This door is read-only, so it never seals a lost generation itself (task-470): it
treats one as over and closes the stream **without** an ``end``, since no terminal
state is persisted yet. The app's next read of the conversation seals it.
"""

from __future__ import annotations

import json
import os

import boto3

# Same cold-start step as api/lambda_handler.py: the runtime secret (the JWT key
# among others) becomes environment variables before anything reads them.
_secret_name = os.environ.get("RUNTIME_SECRET_NAME", "")
if _secret_name:
    _secrets = json.loads(
        boto3.client("secretsmanager").get_secret_value(SecretId=_secret_name)["SecretString"]
    )
    for _key, _value in _secrets.items():
        os.environ.setdefault(_key, str(_value))

import asyncio  # noqa: E402
import logging  # noqa: E402
import time  # noqa: E402
from typing import AsyncIterator, Dict, Optional  # noqa: E402

from fastapi import Depends, FastAPI, Query, Response, status  # noqa: E402
from fastapi.responses import JSONResponse, StreamingResponse  # noqa: E402
from starlette.datastructures import MutableHeaders  # noqa: E402
from starlette.types import ASGIApp, Message, Receive, Scope, Send  # noqa: E402

from media_summarizer.api.dependencies.auth import get_current_user  # noqa: E402
from media_summarizer.core.models.auth import AuthUser  # noqa: E402
from media_summarizer.core.models.chat import TERMINAL_TURN_STATUSES, is_attempt_lost  # noqa: E402
from media_summarizer.utils import chat_db  # noqa: E402
from media_summarizer.utils.logging_config import log_event, setup_logging  # noqa: E402

setup_logging("chat-stream")
logger = logging.getLogger(__name__)

#: How often the fragment range is re-read while following (complement C1.8).
POLL_INTERVAL_SECONDS = 0.25
#: How often the turn's state is re-read when no new fragment came in.
STATE_CHECK_SECONDS = 1.0
#: A comment line keeps the connection alive: API Gateway closes a Regional
#: stream after 5 minutes of silence, and a reasoning model can think a while
#: before its first token.
KEEPALIVE_SECONDS = 15.0
#: The stream's own ceiling, under the REST API's 15-minute streaming limit and
#: the function's timeout (chat_stream.tf). Past it the app reconnects with its
#: cursor; nothing is lost, fragments live a day.
MAX_STREAM_SECONDS = int(os.environ.get("CHAT_STREAM_MAX_SECONDS", "840"))

#: The web app's origin (task-474, var.web_app_origin in chat_stream.tf). Its
#: requests get Access-Control-Allow-Origin back; any other origin gets nothing.
#: The preflight never reaches this app: API Gateway answers it (mock).
WEB_APP_ORIGIN = os.environ.get("WEB_APP_ORIGIN", "")

app = FastAPI(title="Chat stream", docs_url=None, redoc_url=None, openapi_url=None)


class _WebOriginCors:
    """Name the web app's origin on every answer to it, the 401 of the auth
    dependency and the event stream included. Pure ASGI, so the stream is not
    buffered on its way through."""

    def __init__(self, inner: ASGIApp) -> None:
        self.inner = inner

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        origin = dict(scope.get("headers") or []).get(b"origin", b"").decode("latin-1")
        if scope["type"] != "http" or not WEB_APP_ORIGIN or origin != WEB_APP_ORIGIN:
            await self.inner(scope, receive, send)
            return

        async def send_with_origin(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Access-Control-Allow-Origin"] = WEB_APP_ORIGIN
                headers.add_vary_header("Origin")
            await send(message)

        await self.inner(scope, receive, send_with_origin)


app.add_middleware(_WebOriginCors)


def _event(name: str, data: Dict[str, object], *, event_id: Optional[int] = None) -> str:
    lines = [f"event: {name}"]
    if event_id is not None:
        lines.append(f"id: {event_id}")
    lines.append(f"data: {json.dumps(data, separators=(',', ':'), ensure_ascii=False)}")
    return "\n".join(lines) + "\n\n"


@app.get("/health")
async def health() -> Dict[str, str]:
    """The Lambda Web Adapter's readiness check (``AWS_LWA_READINESS_CHECK_PATH``)."""
    return {"status": "ok"}


@app.get("/chat/conversations/{conversation_id}/stream")
async def stream_generation(
    conversation_id: str,
    turn_id: Optional[str] = Query(None, description="The generation the app is showing"),
    attempt_id: Optional[str] = Query(None, description="The generation the app is showing"),
    after_seq: int = Query(-1, ge=-1, description="Last sequence the app holds; -1 for none"),
    current_user: AuthUser = Depends(get_current_user),
):
    """Replay then follow the live generation of a conversation."""
    user_id = current_user.id
    conversation = await chat_db.get_conversation(user_id, conversation_id)
    if conversation is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": {"error_code": "conversation_not_found"}},
        )
    live_turn = conversation.active_turn_id
    live_attempt = conversation.active_attempt_id
    live_index = conversation.active_turn_index
    if not live_turn or not live_attempt or live_index is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    live = await chat_db.get_attempt(user_id, conversation_id, live_index, live_attempt)
    if live is None or is_attempt_lost(live):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if (turn_id and turn_id != live_turn) or (attempt_id and attempt_id != live_attempt):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": {
                    "error_code": "generation_stale",
                    "turn_id": live_turn,
                    "turn_index": live_index,
                    "attempt_id": live_attempt,
                }
            },
        )

    log_event(
        logger,
        logging.INFO,
        "chat.stream.opened",
        "Chat stream opened",
        user_id=user_id,
        conversation_id=conversation_id,
        attempt_id=live_attempt,
        after_seq=after_seq,
    )
    return StreamingResponse(
        _follow(
            user_id=user_id,
            conversation_id=conversation_id,
            turn_id=live_turn,
            turn_index=live_index,
            attempt_id=live_attempt,
            cursor=after_seq,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _follow(
    *,
    user_id: str,
    conversation_id: str,
    turn_id: str,
    turn_index: int,
    attempt_id: str,
    cursor: int,
) -> AsyncIterator[str]:
    started = time.monotonic()
    last_sent = started
    last_state_check = 0.0
    yield _event("generation", {"turn_id": turn_id, "turn_index": turn_index, "attempt_id": attempt_id})

    while True:
        fragments = await chat_db.list_fragments(
            user_id=user_id,
            conversation_id=conversation_id,
            attempt_id=attempt_id,
            after_seq=cursor,
        )
        for fragment in fragments:
            cursor = fragment.seq
            yield _event("fragment", {"seq": fragment.seq, "text": fragment.text}, event_id=fragment.seq)
            last_sent = time.monotonic()

        now = time.monotonic()
        if not fragments and now - last_state_check >= STATE_CHECK_SECONDS:
            last_state_check = now
            answer = await chat_db.get_assistant_message(user_id, conversation_id, turn_index)
            if answer is None:
                # The conversation was deleted under the stream.
                yield _event("end", {"turn_id": turn_id, "attempt_id": attempt_id, "status": "deleted"})
                return
            if answer.status in TERMINAL_TURN_STATUSES:
                # Sealed: every fragment of this attempt was written before the
                # seal, so drain what is left (page by page), then announce the
                # persisted end.
                while remaining := await chat_db.list_fragments(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    attempt_id=attempt_id,
                    after_seq=cursor,
                ):
                    for fragment in remaining:
                        cursor = fragment.seq
                        yield _event("fragment", {"seq": fragment.seq, "text": fragment.text}, event_id=fragment.seq)
                yield _event(
                    "end",
                    {
                        "turn_id": turn_id,
                        "attempt_id": attempt_id,
                        "status": answer.status.value,
                        "interruption_cause": (
                            answer.interruption_cause.value if answer.interruption_cause else None
                        ),
                        "error_code": answer.error_code,
                        "last_seq": cursor,
                        "text": answer.text,
                    },
                )
                return
            attempt = await chat_db.get_attempt(user_id, conversation_id, turn_index, attempt_id)
            if attempt is None or is_attempt_lost(attempt):
                # Lost and not sealed yet: over, but with no persisted end to send.
                log_event(
                    logger,
                    logging.WARNING,
                    "chat.stream.generation_lost",
                    "Generation lost; closing the stream without an end",
                    user_id=user_id,
                    conversation_id=conversation_id,
                    attempt_id=attempt_id,
                )
                return

        if now - started >= MAX_STREAM_SECONDS:
            yield _event("reconnect", {"turn_id": turn_id, "attempt_id": attempt_id, "after_seq": cursor})
            return
        if now - last_sent >= KEEPALIVE_SECONDS:
            yield ": keepalive\n\n"
            last_sent = now
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
