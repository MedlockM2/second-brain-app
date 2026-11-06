"""The one path every LLM call of the repository takes (task-460).

Extracted from the artifact worker so that the chat worker calls the provider the
same way instead of through a "chat mode" of the artifact worker (Decision point 2
of docs/research/task-430-chatbot-architecture/README.md). What lives here:

- **the request**: one ``POST /v1/responses`` of the Responses API (task-613,
  owner decision of 2026-11-06; the only path to the provider). Model, reasoning
  effort, output ceiling and ``store: false`` come from
  ``llm_config.response_parameters()`` and nowhere else -- a caller passes its
  messages, an optional Structured Outputs ``text.format`` and an optional
  ``prompt_cache_key``, never a model or a ceiling of its own. The messages go as
  they are into ``input`` (``role`` + ``content``, the system or developer message
  first), so the corpus they carry stays one stable prefix for the cache, and no
  ``previous_response_id`` is ever sent: the caller rebuilds the conversation;
- **the reading of a refusal**: one parse of the provider's answer through
  ``llm_failure.classify_llm_failure``, raised as ``LlmProviderRefusedError`` when
  the provider declined the call;
- **the end of an answer**: a response is ``completed``, or ``incomplete`` with
  ``incomplete_details.reason`` (``max_output_tokens`` when the ceiling cut it),
  carried on :class:`LlmResult`;
- **the usage**: ``read_usage`` reads the provider's usage block. What a call is
  charged is not decided here: every caller sends under an attempt of the beta
  budget and settles it on this usage (``budget_guard``, task-549).

Two modes. ``complete`` buffers the answer: it is what every artifact, the review
blurb and the re-translation use. ``stream`` is taken only by a caller that asks
for it -- the chat -- and reads the provider's typed server-sent events
(``response.output_text.delta`` for the text; ``response.completed`` or
``response.incomplete`` for the end, the usage and the model; ``response.failed``
and ``error`` for a failure), hands each text delta to a callback, lets the caller
stop consuming, and tells a failure *before* the first text apart from one *after*
it: only the former may be retried (Decision point 2), a text already shown is
never taken back (Decision point 6).

One call sends its own HTTP request: the full-text translation
(``transcript_translation.py``), which must not carry the shared output ceiling and
classifies every provider error itself for its retry budget. It still builds its
body with :func:`request_payload` and reads the answer with :func:`read_response`
(task-556, task-613).

Responses API reference and streaming events read on 2026-11-06:
https://developers.openai.com/api/reference/resources/responses/methods/create and
https://developers.openai.com/api/reference/resources/responses/streaming-events.
The usage block is ``input_tokens`` (with ``input_tokens_details.cached_tokens``
and ``cache_write_tokens``) and ``output_tokens``, reasoning included
(``output_tokens_details.reasoning_tokens`` is a subset, never added again). The
stream ends on its terminal event; there is no ``[DONE]`` sentinel.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence

import aiohttp

from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.core.services.llm_config import (
    LLM_MAX_OUTPUT_TOKENS,
    LLM_MODEL,
    response_parameters,
)
from media_summarizer.core.services.llm_corpus import estimate_tokens
from media_summarizer.core.services.llm_pricing import estimate_llm_cost_eur
from media_summarizer.utils.llm_failure import (
    REFUSAL_AUTHENTICATION,
    LLMFailureKind,
    LlmProviderRefusedError,
    classify_llm_failure,
    parse_retry_after,
)
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

LLM_API_URL = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/responses")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

#: One message of a conversation, as an item of the Responses API ``input``:
#: ``{"role": "system" | "developer" | "user" | "assistant", "content": "..."}``.
LlmMessage = Dict[str, str]

#: Receives each text delta of a streamed answer. Returning ``False`` stops the
#: consumption of the provider's stream (a stop requested by the user); ``None``
#: or ``True`` keeps reading.
DeltaCallback = Callable[[str], Awaitable[Optional[bool]]]

#: ``incomplete_details.reason`` of a response the output ceiling cut.
INCOMPLETE_MAX_OUTPUT_TOKENS = "max_output_tokens"

#: The stream events that end a response with its final object.
_TERMINAL_EVENTS = frozenset({"response.completed", "response.incomplete"})


@dataclass(frozen=True)
class LlmResult:
    """A finished call: the text, what it cost, and why the provider stopped.

    ``status`` is the response's own (``completed``, ``incomplete``…) and
    ``incomplete_reason`` its ``incomplete_details.reason`` (``max_output_tokens``,
    ``content_filter``…), so a caller can tell an answer cut by the output ceiling
    from a complete one. Both ``None`` when the provider never sent its final
    response -- a stream the caller stopped.
    """

    content: str
    usage: ArtifactLlmUsage
    status: Optional[str]
    incomplete_reason: Optional[str] = None

    @property
    def output_limit_reached(self) -> bool:
        """The output ceiling (reasoning included) cut the answer."""
        return self.status == "incomplete" and self.incomplete_reason == INCOMPLETE_MAX_OUTPUT_TOKENS


@dataclass(frozen=True)
class LlmStreamResult(LlmResult):
    #: The caller stopped reading before the provider finished.
    stopped: bool = False


class LlmStreamInterruptedError(Exception):
    """A streamed answer failed **after** some of its text was delivered.

    The delivered text is kept, never retried into: a new attempt would start an
    answer from scratch, not continue this one (Decision point 6). The failure
    axes of the underlying error ride along, so the caller files it the way it
    files any other provider failure. ``usage`` is estimated when the provider
    never delivered its usage chunk.
    """

    def __init__(
        self,
        message: str,
        *,
        partial_content: str,
        usage: ArtifactLlmUsage,
        failure_kind: str,
        refusal_reason: Optional[str] = None,
        provider_status: Optional[int] = None,
    ) -> None:
        super().__init__(message)
        self.partial_content = partial_content
        self.usage = usage
        self.failure_kind = failure_kind
        self.refusal_reason = refusal_reason
        self.provider_status = provider_status


class LlmResponseFailedError(RuntimeError):
    """The provider reported, after its 200, that it could not generate a response.

    ``failure_kind`` is read from the error it named: an ``invalid_prompt`` is
    permanent and must not be retried, a ``server_error`` may pass.
    """

    def __init__(self, message: str, *, failure_kind: str) -> None:
        super().__init__(message)
        self.failure_kind = failure_kind


def read_usage(usage: Dict[str, Any]) -> ArtifactLlmUsage:
    """Price the Responses API usage block, under the model the provider names.

    ``input_tokens`` holds the cached and cache-written tokens as subsets;
    ``output_tokens`` already counts the reasoning tokens.
    """
    model = str(usage.get("model") or LLM_MODEL)
    input_details = usage.get("input_tokens_details") or {}
    prompt_tokens = int(usage.get("input_tokens") or 0)
    cached_tokens = int(input_details.get("cached_tokens") or 0)
    cache_write_tokens = int(input_details.get("cache_write_tokens") or 0)
    completion_tokens = int(usage.get("output_tokens") or 0)
    return ArtifactLlmUsage(
        model=model,
        prompt_tokens=prompt_tokens,
        cached_tokens=cached_tokens,
        cache_write_tokens=cache_write_tokens,
        completion_tokens=completion_tokens,
        cost_eur=estimate_llm_cost_eur(
            model=model,
            prompt_tokens=prompt_tokens,
            cached_tokens=cached_tokens,
            cache_write_tokens=cache_write_tokens,
            completion_tokens=completion_tokens,
        ),
    )


def estimate_usage(
    messages: Sequence[LlmMessage],
    completion_text: str,
    *,
    model: Optional[str] = None,
) -> ArtifactLlmUsage:
    """The usage of a stream that ended without its usage chunk (complement C1.11).

    Writing zeros would understate the observed cost exactly on the interrupted
    turns. The input is estimated from the bytes sent, the output from the text
    received -- which leaves out reasoning tokens, so it stays a floor -- and no
    cache discount is assumed. The figure is marked as estimated.
    """
    model = model or LLM_MODEL
    prompt_tokens = estimate_tokens(
        sum(len((message.get("content") or "").encode("utf-8")) for message in messages)
    )
    completion_tokens = estimate_tokens(len(completion_text.encode("utf-8")))
    return ArtifactLlmUsage(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_eur=estimate_llm_cost_eur(
            model=model,
            prompt_tokens=prompt_tokens,
            cached_tokens=0,
            completion_tokens=completion_tokens,
        ),
        usage_estimated=True,
    )


def request_payload(
    messages: Sequence[LlmMessage],
    *,
    text_format: Optional[Dict[str, Any]] = None,
    prompt_cache_key: Optional[str] = None,
    max_output_tokens: Optional[int] = LLM_MAX_OUTPUT_TOKENS,
) -> Dict[str, Any]:
    """The body of one ``POST /v1/responses``.

    ``text_format`` is the generator's Structured Outputs format
    (``{"type": "json_schema", "name", "strict", "schema"}``), sent as
    ``text.format``. ``max_output_tokens=None`` is the full-text translation's
    request: no ceiling but the model's.
    """
    payload: Dict[str, Any] = {
        **response_parameters(max_output_tokens=max_output_tokens),
        "input": list(messages),
    }
    if text_format is not None:
        payload["text"] = {"format": text_format}
    if prompt_cache_key:
        payload["prompt_cache_key"] = prompt_cache_key
    return payload


def response_text(response: Dict[str, Any]) -> str:
    """The text of a response: every ``output_text`` part of its ``message`` items.

    ``output_text`` on the response object is an SDK convenience, absent from the
    HTTP answer, so the ``output`` array is read. Reasoning items carry no text, and
    a ``refusal`` part is not answer text.
    """
    parts: List[str] = []
    for item in response.get("output") or []:
        if item.get("type") != "message":
            continue
        for part in item.get("content") or []:
            if part.get("type") == "output_text":
                parts.append(str(part.get("text") or ""))
    return "".join(parts)


def _incomplete_reason(response: Dict[str, Any]) -> Optional[str]:
    details = response.get("incomplete_details") or {}
    reason = details.get("reason")
    return str(reason) if reason else None


def read_response(
    response: Dict[str, Any], messages: Sequence[LlmMessage]
) -> LlmResult:
    """Read a whole (non-streamed) response: text, end and priced usage.

    The usage is estimated when the provider sent none, rather than written as
    zero.
    """
    content = response_text(response)
    # The model that actually answered, as the provider names it, rides with the
    # usage it produced: that is what cost and traceability read.
    model = response.get("model") or LLM_MODEL
    usage = response.get("usage")
    return LlmResult(
        content=content,
        usage=(
            read_usage({**usage, "model": model})
            if usage
            else estimate_usage(messages, content, model=model)
        ),
        status=response.get("status"),
        incomplete_reason=_incomplete_reason(response),
    )


def _require_api_key() -> str:
    if not OPENAI_API_KEY:
        # A missing key and a revoked key are the same outage seen from here, and
        # they need the same action, so they carry the same refusal reason.
        raise LlmProviderRefusedError(
            "openai_api_key_missing",
            refusal_reason=REFUSAL_AUTHENTICATION,
            # Three deliveries of the same message would make three identical
            # no-ops: the key appears in the runtime secret, not between retries.
            failure_kind=LLMFailureKind.PERMANENT,
        )
    return OPENAI_API_KEY


def _headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


async def _raise_for_provider_error(
    response: aiohttp.ClientResponse, log_fields: Dict[str, Any]
) -> None:
    """Classify an HTTP error answer once, log it, and raise it as itself."""
    if response.status < 400:
        return
    body = await response.text()
    # One parse of the provider's answer, both axes out: what the operator must do
    # about it, and whether another delivery of this message could ever get a
    # different answer.
    retry_after = response.headers.get("Retry-After")
    failure = classify_llm_failure(
        status_code=response.status,
        body=body,
        retry_after=retry_after,
    )
    log_event(
        logger,
        logging.ERROR,
        "external_call.failed",
        "LLM API returned an error",
        provider="openai",
        status=response.status,
        failure_kind=failure.kind,
        refusal_reason=failure.refusal_reason,
        detail=body[:500],
        **log_fields,
    )
    # A refusal is raised as itself so the failure metric can name the account
    # state (no credit / bad key / throttled) instead of lumping it in with a
    # validation error.
    if failure.refusal_reason is not None:
        raise LlmProviderRefusedError(
            f"llm_provider_refused_http_{response.status}",
            refusal_reason=failure.refusal_reason,
            failure_kind=failure.kind,
            provider_status=response.status,
            retry_after_seconds=parse_retry_after(retry_after),
        )
    response.raise_for_status()


async def complete(
    messages: Sequence[LlmMessage],
    *,
    text_format: Optional[Dict[str, Any]] = None,
    prompt_cache_key: Optional[str] = None,
    **log_fields: Any,
) -> LlmResult:
    """Call the model and wait for the whole answer.

    ``prompt_cache_key`` keeps the requests over one corpus on the same cached
    prefix. ``log_fields`` (``artifact_type=…``) ride on the error log line.
    """
    api_key = _require_api_key()
    timeout = aiohttp.ClientTimeout(
        total=int(os.environ.get("LLM_TIMEOUT_SECONDS", "180"))
    )
    payload = request_payload(
        messages, text_format=text_format, prompt_cache_key=prompt_cache_key
    )

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            LLM_API_URL, headers=_headers(api_key), json=payload
        ) as response:
            await _raise_for_provider_error(response, log_fields)
            result = await response.json()
            # A response the model failed to generate is a 200 with
            # ``status: failed``: classified like the same error in a stream.
            if result.get("status") == "failed":
                _raise_for_stream_error(
                    {"type": "response.failed", "response": result}, log_fields
                )
            return read_response(result, messages)


async def stream(
    messages: Sequence[LlmMessage],
    *,
    on_delta: DeltaCallback,
    prompt_cache_key: Optional[str] = None,
    **log_fields: Any,
) -> LlmStreamResult:
    """Call the model and hand its answer over as it is written.

    Raises, **before any text was delivered**, exactly what ``complete`` raises
    (``LlmProviderRefusedError``, an ``aiohttp`` error, a timeout): the caller may
    retry those within its own bounds. **After** the first delta, any failure is
    raised as :class:`LlmStreamInterruptedError` carrying the delivered text.

    ``on_delta`` returning ``False`` stops the read: the connection is closed, the
    provider stops generating, and the result comes back with ``stopped=True``,
    the text delivered so far and an estimated usage (the usage only comes with
    the terminal event).

    There is no total timeout: a long answer is bounded by the caller's own
    deadline. ``LLM_TIMEOUT_SECONDS`` bounds the silence between two reads
    instead, which covers a reasoning model thinking before its first token.
    """
    api_key = _require_api_key()
    timeout = aiohttp.ClientTimeout(
        total=None,
        sock_read=int(os.environ.get("LLM_TIMEOUT_SECONDS", "180")),
    )
    payload = request_payload(messages, prompt_cache_key=prompt_cache_key)
    payload["stream"] = True

    parts: List[str] = []
    model: Optional[str] = None
    final: Optional[Dict[str, Any]] = None
    raw_usage: Optional[Dict[str, Any]] = None

    def interrupted(exc: BaseException) -> LlmStreamInterruptedError:
        partial = "".join(parts)
        return LlmStreamInterruptedError(
            f"llm_stream_interrupted: {type(exc).__name__}: {exc}"[:500],
            partial_content=partial,
            usage=_stream_usage(raw_usage, model, messages, partial),
            failure_kind=getattr(exc, "failure_kind", LLMFailureKind.TRANSIENT),
            refusal_reason=getattr(exc, "refusal_reason", None),
            provider_status=getattr(exc, "provider_status", None),
        )

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            LLM_API_URL, headers=_headers(api_key), json=payload
        ) as response:
            await _raise_for_provider_error(response, log_fields)
            try:
                async for raw_line in response.content:
                    data = _sse_data(raw_line)
                    if data is None:
                        continue
                    event = json.loads(data)
                    _raise_for_stream_error(event, log_fields)
                    event_type = event.get("type")
                    snapshot = event.get("response")
                    if isinstance(snapshot, dict):
                        # response.created / in_progress / completed / incomplete
                        # all carry the response object: the model that answers.
                        model = snapshot.get("model") or model
                    if event_type in _TERMINAL_EVENTS and isinstance(snapshot, dict):
                        final = snapshot
                        if snapshot.get("usage"):
                            raw_usage = dict(snapshot["usage"])
                        break
                    if event_type != "response.output_text.delta":
                        continue
                    text = event.get("delta")
                    if not text:
                        continue
                    parts.append(text)
                    if await on_delta(text) is False:
                        response.close()
                        content = "".join(parts)
                        return LlmStreamResult(
                            content=content,
                            usage=_stream_usage(raw_usage, model, messages, content),
                            status=None,
                            stopped=True,
                        )
            except Exception as exc:
                if not parts:
                    raise
                raise interrupted(exc) from exc

    content = "".join(parts)
    return LlmStreamResult(
        content=content,
        usage=_stream_usage(raw_usage, model, messages, content),
        status=final.get("status") if final else None,
        incomplete_reason=_incomplete_reason(final) if final else None,
    )


def _sse_data(raw_line: bytes) -> Optional[str]:
    """The payload of a ``data:`` line; ``None`` for blank lines and comments."""
    line = raw_line.decode("utf-8").strip()
    if not line.startswith("data:"):
        return None
    return line[len("data:"):].strip()


def _raise_for_stream_error(event: Dict[str, Any], log_fields: Dict[str, Any]) -> None:
    """An error the provider reports after its 200.

    Two shapes in the stream: an ``error`` event (``code``, ``message`` at the top)
    and ``response.failed``, whose response carries ``error.code`` and
    ``error.message``. The raw event is what is classified, so either wording
    reaches the markers of ``classify_llm_failure``.
    """
    event_type = event.get("type")
    if event_type not in {"error", "response.failed"}:
        return
    body = json.dumps(event)
    failure = classify_llm_failure(status_code=None, body=body)
    log_event(
        logger,
        logging.ERROR,
        "external_call.failed",
        "LLM stream reported an error",
        provider="openai",
        failure_kind=failure.kind,
        refusal_reason=failure.refusal_reason,
        detail=body[:500],
        **log_fields,
    )
    if failure.refusal_reason is not None:
        raise LlmProviderRefusedError(
            "llm_provider_refused_in_stream",
            refusal_reason=failure.refusal_reason,
            failure_kind=failure.kind,
        )
    raise LlmResponseFailedError(f"llm_stream_error: {body[:300]}", failure_kind=failure.kind)


def _stream_usage(
    raw_usage: Optional[Dict[str, Any]],
    model: Optional[str],
    messages: Sequence[LlmMessage],
    content: str,
) -> ArtifactLlmUsage:
    if raw_usage is None:
        return estimate_usage(messages, content, model=model)
    return read_usage({**raw_usage, "model": model or LLM_MODEL})
