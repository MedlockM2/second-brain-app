"""The one path every LLM call of the repository takes (task-460).

Extracted from the artifact worker so that the chat worker calls the provider the
same way instead of through a "chat mode" of the artifact worker (Decision point 2
of docs/research/task-430-chatbot-architecture/README.md). What lives here:

- **the request**: model, reasoning effort and output ceiling come from
  ``llm_config.chat_completion_parameters()`` and nowhere else -- a caller passes
  its messages, an optional Structured Outputs schema and an optional
  ``prompt_cache_key``, never a model or a ceiling of its own;
- **the reading of a refusal**: one parse of the provider's answer through
  ``llm_failure.classify_llm_failure``, raised as ``LlmProviderRefusedError`` when
  the provider declined the call;
- **the usage and its cost**: ``read_usage`` prices the provider's usage block,
  ``record_observed_cost`` stores it against the account's period.

Two modes. ``complete`` buffers the answer: it is what every artifact, the review
blurb and the re-translation use, and its request is byte-for-byte the one the
artifact worker sent before the extraction. ``stream`` is taken only by a caller
that asks for it -- the chat -- and reads the provider's server-sent events
(``stream: true`` with ``stream_options.include_usage``), hands each text delta to a
callback, lets the caller stop consuming, and tells a failure *before* the first
text apart from one *after* it: only the former may be retried (Decision point 2),
a text already shown is never taken back (Decision point 6).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence

import aiohttp

from media_summarizer.core.models.media_artifact import ArtifactLlmUsage
from media_summarizer.core.services import quota_enforcer
from media_summarizer.core.services.llm_config import (
    LLM_MODEL,
    chat_completion_parameters,
)
from media_summarizer.core.services.llm_corpus import estimate_tokens
from media_summarizer.core.services.llm_pricing import estimate_llm_cost_eur
from media_summarizer.utils.llm_failure import (
    REFUSAL_AUTHENTICATION,
    LLMFailureKind,
    LlmProviderRefusedError,
    classify_llm_failure,
)
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

LLM_API_URL = os.environ.get(
    "LLM_API_URL", "https://api.openai.com/v1/chat/completions"
)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

#: One message of a conversation, as Chat Completions takes it:
#: ``{"role": "system" | "developer" | "user" | "assistant", "content": "..."}``.
LlmMessage = Dict[str, str]

#: Receives each text delta of a streamed answer. Returning ``False`` stops the
#: consumption of the provider's stream (a stop requested by the user); ``None``
#: or ``True`` keeps reading.
DeltaCallback = Callable[[str], Awaitable[Optional[bool]]]

_STREAM_DONE = "[DONE]"


@dataclass(frozen=True)
class LlmResult:
    """A finished call: the text, what it cost, and why the provider stopped.

    ``finish_reason`` is the provider's own (``stop``, ``length``…), so a caller
    can tell an answer cut by the output ceiling from a complete one. ``None`` when
    the provider never sent one -- a stream the caller stopped.
    """

    content: str
    usage: ArtifactLlmUsage
    finish_reason: Optional[str]


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


def read_usage(usage: Dict[str, Any]) -> ArtifactLlmUsage:
    """Price the provider's usage block, under the model the provider names."""
    model = str(usage.get("model") or LLM_MODEL)
    prompt_details = usage.get("prompt_tokens_details") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    cached_tokens = int(prompt_details.get("cached_tokens") or 0)
    cache_write_tokens = int(prompt_details.get("cache_write_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
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


async def record_observed_cost(
    user_id: Optional[str],
    usage: ArtifactLlmUsage,
    *,
    idempotency_token: str,
) -> None:
    """Store the measured LLM cost against the period, for observability only.

    Nothing gates on this figure -- the minute allowance is what bounds spend --
    but recording it is how the owner can compare the model's assumptions with the
    real invoice. ``idempotency_token`` names the unit of work (an artifact, a
    chat attempt) so a redelivery cannot record twice.
    """
    if not user_id or usage.cost_eur <= 0:
        return
    await quota_enforcer.record_observed_cost(
        user_id,
        cost_eur=usage.cost_eur,
        idempotency_token=idempotency_token,
    )


def _build_payload(
    messages: Sequence[LlmMessage],
    response_format: Optional[Dict[str, Any]],
    prompt_cache_key: Optional[str],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        **chat_completion_parameters(),
        "messages": list(messages),
    }
    if response_format is not None:
        payload["response_format"] = response_format
    if prompt_cache_key:
        payload["prompt_cache_key"] = prompt_cache_key
    return payload


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
    failure = classify_llm_failure(
        status_code=response.status,
        body=body,
        retry_after=response.headers.get("Retry-After"),
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
        )
    response.raise_for_status()


async def complete(
    messages: Sequence[LlmMessage],
    *,
    response_format: Optional[Dict[str, Any]] = None,
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
    payload = _build_payload(messages, response_format, prompt_cache_key)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(
            LLM_API_URL, headers=_headers(api_key), json=payload
        ) as response:
            await _raise_for_provider_error(response, log_fields)
            result = await response.json()
            usage = dict(result.get("usage") or {})
            # The model that actually answered, as the provider names it, rides
            # with the usage it produced: that is what cost and traceability read.
            usage["model"] = result.get("model") or LLM_MODEL
            choice = result["choices"][0]
            return LlmResult(
                content=choice["message"]["content"],
                usage=read_usage(usage),
                finish_reason=choice.get("finish_reason"),
            )


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
    the text delivered so far and an estimated usage (the usage chunk only comes
    at the end).

    There is no total timeout: a long answer is bounded by the caller's own
    deadline. ``LLM_TIMEOUT_SECONDS`` bounds the silence between two reads
    instead, which covers a reasoning model thinking before its first token.
    """
    api_key = _require_api_key()
    timeout = aiohttp.ClientTimeout(
        total=None,
        sock_read=int(os.environ.get("LLM_TIMEOUT_SECONDS", "180")),
    )
    payload = _build_payload(messages, None, prompt_cache_key)
    payload["stream"] = True
    payload["stream_options"] = {"include_usage": True}

    parts: List[str] = []
    model: Optional[str] = None
    finish_reason: Optional[str] = None
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
                    if data == _STREAM_DONE:
                        break
                    chunk = json.loads(data)
                    _raise_for_stream_error(chunk, log_fields)
                    model = chunk.get("model") or model
                    if chunk.get("usage"):
                        # The extra chunk sent before [DONE]: no choices, the usage
                        # of the whole call.
                        raw_usage = dict(chunk["usage"])
                    for choice in chunk.get("choices") or []:
                        finish_reason = choice.get("finish_reason") or finish_reason
                        text = (choice.get("delta") or {}).get("content")
                        if not text:
                            continue
                        parts.append(text)
                        if await on_delta(text) is False:
                            response.close()
                            content = "".join(parts)
                            return LlmStreamResult(
                                content=content,
                                usage=_stream_usage(raw_usage, model, messages, content),
                                finish_reason=None,
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
        finish_reason=finish_reason,
    )


def _sse_data(raw_line: bytes) -> Optional[str]:
    """The payload of a ``data:`` line; ``None`` for blank lines and comments."""
    line = raw_line.decode("utf-8").strip()
    if not line.startswith("data:"):
        return None
    return line[len("data:"):].strip()


def _raise_for_stream_error(chunk: Dict[str, Any], log_fields: Dict[str, Any]) -> None:
    """An error the provider reports inside the stream, after its 200."""
    error = chunk.get("error")
    if not error:
        return
    body = json.dumps(chunk)
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
    raise RuntimeError(f"llm_stream_error: {body[:300]}")


def _stream_usage(
    raw_usage: Optional[Dict[str, Any]],
    model: Optional[str],
    messages: Sequence[LlmMessage],
    content: str,
) -> ArtifactLlmUsage:
    if raw_usage is None:
        return estimate_usage(messages, content, model=model)
    return read_usage({**raw_usage, "model": model or LLM_MODEL})
