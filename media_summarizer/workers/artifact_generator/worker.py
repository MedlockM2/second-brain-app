"""
Unified artifact generator worker.

Polls a single SQS queue (artifact-generator-queue) and dispatches to
per-kind generators based on `body.artifact_type`. Retries, validation and
status transitions live here once instead of being duplicated across 5 separate
workers. The transcript download, the corpus layout and the LLM call itself are
shared with the chat worker: ``core/services/llm_corpus.py`` and
``core/services/llm_client.py`` (task-460).

Consolidates the former flashcards, notes, quiz, summarization, and summary
workers (task-195).

One invocation = one artifact type = one LLM call over the whole corpus
(task-269, strategy S1). N transcripts are downloaded in parallel and
concatenated, tagged, into a single prompt: no condensation stage, so the detail
that flashcards and quizzes live on is still in front of the model. The 300 s
timeout and the 180 s LLM timeout are unchanged because the number of sequential
calls per invocation is still one.

Beta budget (task-549): the call is sent under an attempt bounded by the request
about to leave — its UTF-8 bytes, schema included, and the output ceiling sent
(``budget_guard.llm_call_line``). The automatic ``review_blurb`` claims the attempt
its import's admission held (rule 10, operation = the library row); any other
generation, and a blurb with no admission behind it, reserves its own. An artifact
stored settles on the provider's usage; a refused, failed or invalid answer
releases it, the tokens billed going to the operator's spend (rule 5). The artifact
lease is the exclusive claim, so the budget lease is zero.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from media_summarizer.core.models.artifact_options import ArtifactOptions
from media_summarizer.core.models.beta_budget import BudgetRefusal, Component, MeasuredCost
from media_summarizer.core.models.media_artifact import ArtifactLlmUsage, MediaArtifactType
from media_summarizer.core.services import beta_budget, budget_guard, llm_client, llm_corpus
from media_summarizer.core.services.artifact_service import (
    ERROR_CODE_SOURCES_CHANGED,
    MAX_FOLDER_CORPUS_TOKENS,
    claim_artifact_generation,
    complete_artifact_generation,
    fail_artifact_generation,
)
from media_summarizer.core.services.budget_guard import (
    BudgetBusyError,
    BudgetCall,
    BudgetRefusedError,
)
from media_summarizer.utils import sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.llm_failure import (
    LLMFailureKind,
    LlmProviderRefusedError,
    log_llm_generation_failure,
)
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
    setup_logging,
)

logger = logging.getLogger(__name__)

ARTIFACT_GENERATOR_QUEUE = required_env("ARTIFACT_GENERATOR_QUEUE")


class ArtifactValidationError(Exception):
    """Raised when the model output does not pass the generator's validator."""


def _strip_code_fences(content: str) -> str:
    """Remove markdown code fences from LLM output."""
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _budget_step(artifact_type: MediaArtifactType, body: Dict[str, Any], artifact_id: str) -> Tuple[Component, str]:
    """The step and operation an artifact's call is charged under.

    The automatic preview belongs to its import: the operation is the library row
    it is generated for, the one its admission reserved it under (rule 10). Every
    other artifact is its own operation.
    """
    if artifact_type == MediaArtifactType.REVIEW_BLURB:
        return Component.REVIEW_BLURB, str(body.get("scope_id") or artifact_id)
    return Component.GENERATION, f"artifact:{artifact_id}:{body['generation_revision']}"


async def _keep_preview_value(body: Dict[str, Any], consumed: int) -> None:
    """Keep a preview's settled cost with its content, per language (rule 12).

    Another account saving this content in the same reading language is given this
    preview and charged this value. Best effort: the settlement already happened.
    """
    from media_summarizer.utils import media_idempotence
    from media_summarizer.utils import user_media as user_media_store

    try:
        record = await user_media_store.get_user_media(
            str(body.get("user_id") or ""), str(body.get("scope_id") or "")
        )
    except Exception:  # noqa: BLE001 - without the row the value is simply not kept
        return
    if record is None:
        return
    await media_idempotence.record_preview_value(
        media_key=record.media_key,
        language=(body.get("parameters") or {}).get("language"),
        nano_eur=consumed,
    )


async def _usage_cost(usage: Optional[ArtifactLlmUsage]) -> Optional[MeasuredCost]:
    if usage is None:
        return None
    try:
        return await budget_guard.llm_cost(usage)
    except Exception:  # noqa: BLE001 - the bound stands in for an unpriced usage
        return None


def _build_envelope(
    *,
    generator: Any,
    schema: Optional[Dict[str, Any]],
    raw_content: str,
    llm_usage: ArtifactLlmUsage,
    body: Dict[str, Any],
    artifact_id: str,
    artifact_type: MediaArtifactType,
    sources: Any,
) -> Tuple[Optional[str], Dict[str, Any]]:
    """Validate the model's answer and wrap it as the stored artifact."""
    if schema is not None:
        raw_content = generator.unwrap_structured_response(raw_content)

    # Validate
    validated = generator.validate(raw_content)

    # Build artifact content
    artifact_content = generator.build_artifact_content(validated, body=body)
    # The title is the model's, not a derived label: it is what tells two
    # entries of the same type apart in the history (task-269 §5.4).
    artifact_title = validated.get("title") if isinstance(validated, dict) else None

    envelope: Dict[str, Any] = {
        "artifact_id": artifact_id,
        "artifact_type": artifact_type.value,
        "scope": body.get("scope"),
        "scope_id": body.get("scope_id"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_count": len(sources),
        "sources": [
            {
                "media_item_id": source.get("media_item_id"),
                "title": source.get("title"),
                "language": source.get("language"),
                "transcript_s3_key": source.get("transcript_s3_key"),
            }
            for source in sources
        ],
        "generator_version": body.get("generator_version"),
        "llm_usage": llm_usage.model_dump(exclude_none=True),
        "content": artifact_content,
    }
    return artifact_title, envelope


async def process_message(message: Dict[str, Any]) -> None:
    """Process a single artifact generation message from the unified queue."""
    from media_summarizer.workers.artifact_generator.generators import GENERATORS

    body = json.loads(message.get("Body", "{}"))
    artifact_id = body.get("artifact_id")
    artifact_type_str = body.get("artifact_type")
    sources = body.get("sources") or []
    parameters = body.get("parameters") or {}
    language = parameters.get("language")
    prompt_cache_key = body.get("prompt_cache_key")
    # Resolve artifact type
    try:
        artifact_type = MediaArtifactType(artifact_type_str)
    except (ValueError, KeyError):
        log_event(
            logger,
            logging.ERROR,
            "worker.unknown_artifact_type",
            f"Unknown artifact_type: {artifact_type_str}",
            artifact_id=artifact_id,
        )
        raise ValueError(f"Unknown artifact_type: {artifact_type_str}")

    generator = GENERATORS.get(artifact_type)
    if generator is None:
        log_event(
            logger,
            logging.ERROR,
            "worker.unsupported_artifact_type",
            f"No generator registered for artifact_type: {artifact_type_str}",
            artifact_id=artifact_id,
        )
        raise ValueError(f"No generator for artifact_type: {artifact_type_str}")

    context_token = bind_log_context(
        artifact_id=artifact_id,
        artifact_type=artifact_type.value,
        scope=body.get("scope"),
        scope_id=body.get("scope_id"),
    )

    try:
        if not artifact_id or not sources:
            log_event(
                logger,
                logging.ERROR,
                "worker.invalid_message",
                f"Missing fields for {artifact_type.value} generation",
                queue=ARTIFACT_GENERATOR_QUEUE,
            )
            raise ValueError(f"Missing fields for {artifact_type.value} generation")

        # The lease is what absorbs at-least-once delivery: an entry already
        # terminal, or held by a live worker, is not generated a second time.
        # Standing down here costs one DynamoDB write and saves one LLM call.
        claimed = await claim_artifact_generation(artifact_id, int(body["generation_revision"]))
        if claimed is None:
            log_event(
                logger,
                logging.INFO,
                "artifact.claim_declined",
                "Artifact already terminal or leased by another worker; standing down",
                artifact_id=artifact_id,
                artifact_type=artifact_type.value,
            )
            return

        try:
            corpus_sources = await llm_corpus.download_transcripts(sources)
        except Exception as exc:
            cause = exc.__cause__ or exc
            response = getattr(cause, "response", {})
            code = response.get("Error", {}).get("Code") if isinstance(response, dict) else None
            if not isinstance(cause, FileNotFoundError) and code not in {"NoSuchKey", "NoSuchVersion", "404"}:
                raise
            await fail_artifact_generation(
                artifact_id=artifact_id, generation_revision=claimed.generation_revision,
                error_code=ERROR_CODE_SOURCES_CHANGED, error_message="An original source no longer exists", retryable=False,
            )
            return
        if any(not source["text"].strip() for source in corpus_sources):
            await fail_artifact_generation(
                artifact_id=artifact_id, generation_revision=claimed.generation_revision,
                error_code=ERROR_CODE_SOURCES_CHANGED, error_message="An original source is no longer readable", retryable=False,
            )
            return

        # Second ceiling check, on the text actually downloaded: the API measured
        # the corpus before the transcripts were read, and a source can have grown
        # since. Failing here costs nothing; sending a request the provider will
        # reject costs the whole invocation.
        estimated_tokens = llm_corpus.estimate_tokens(
            llm_corpus.corpus_byte_length(corpus_sources)
        )
        if estimated_tokens > MAX_FOLDER_CORPUS_TOKENS:
            raise BudgetRefusedError(
                BudgetRefusal.ITEM_TOO_LARGE,
                {
                    "quantity": "corpus_tokens",
                    "measured": estimated_tokens,
                    "limit": MAX_FOLDER_CORPUS_TOKENS,
                },
            )

        # The options travel in `parameters` without their defaults (the request
        # omitted explicit defaults); reading them here fills the defaults back in.
        prompt = generator.build_prompt(
            corpus_sources,
            language=language,
            options=ArtifactOptions.from_parameters(parameters),
        )

        # The configured model supports Structured Outputs (llm_config), so a
        # generator that has a schema always sends it.
        schema = generator.response_format_schema()

        messages = [{"role": "user", "content": prompt}]
        component, operation_id = _budget_step(artifact_type, body, artifact_id)
        call: BudgetCall = await budget_guard.start(
            str(body.get("user_id") or ""),
            operation_id=operation_id,
            component=component,
            line=lambda ctx: budget_guard.llm_call_line(
                ctx, component=component, messages=messages, response_format=schema
            ),
            lease=timedelta(0),
        )
        try:
            result = await llm_client.complete(
                messages,
                response_format=schema,
                prompt_cache_key=prompt_cache_key,
                artifact_type=artifact_type.value,
            )
        except LlmProviderRefusedError:
            # The provider answered with an error: it billed nothing.
            await call.release(operator_cost=budget_guard.no_cost())
            raise
        except BaseException:
            await call.release()
            raise
        raw_content = result.content
        llm_usage = result.usage
        usage_cost = await _usage_cost(llm_usage)
        try:
            artifact_title, envelope = _build_envelope(
                generator=generator,
                schema=schema,
                raw_content=raw_content,
                llm_usage=llm_usage,
                body=body,
                artifact_id=artifact_id,
                artifact_type=artifact_type,
                sources=sources,
            )
            await complete_artifact_generation(
                artifact_id=artifact_id,
                content=envelope,
                title=artifact_title,
                llm_usage=llm_usage,
                generation_revision=claimed.generation_revision,
            )
        except BaseException:
            # An answer was billed but no artifact reached the user (rule 5).
            await call.release(operator_cost=usage_cost)
            raise
        if usage_cost is not None:
            consumed = await call.settle(usage_cost, metric_source=budget_guard.llm_metric_source(llm_usage))
            if consumed and component == Component.REVIEW_BLURB:
                await _keep_preview_value(body, consumed)

    except BudgetBusyError:
        log_event(
            logger,
            logging.INFO,
            "artifact.budget_busy",
            "Another delivery is sending this generation; standing down",
            artifact_id=artifact_id,
        )
    except BudgetRefusedError as refusal:
        if not refusal.observed:
            refusal.observed = True
            await beta_budget.observe(
                str(body.get("user_id") or ""),
                outcome="refused",
                operation_id=str(artifact_id),
                components=["generation"],
                refusal=refusal.refusal.value,
                params=refusal.params,
            )
        # Nothing was sent: the entry fails with the budget's code and the message
        # is acknowledged, a redelivery would get the same answer this month.
        log_event(
            logger,
            logging.INFO,
            "artifact.budget_refused",
            "Artifact generation refused by the beta budget",
            artifact_id=artifact_id,
            error_code=refusal.error_code,
        )
        if artifact_id:
            await fail_artifact_generation(
                artifact_id=artifact_id,
                error_message=refusal.error_code,
                error_code=refusal.failure_code.value,
                error_params=refusal.public_params(),
                generation_revision=int(body["generation_revision"]),
            )
    except Exception as exc:
        # Determine error code for validation errors
        error_code = None
        from media_summarizer.workers.artifact_generator.generators.flashcards import FlashcardsValidationError
        from media_summarizer.workers.artifact_generator.generators.notes import NotesValidationError
        from media_summarizer.workers.artifact_generator.generators.quiz import QuizValidationError
        from media_summarizer.workers.artifact_generator.generators.review_blurb import (
            ReviewBlurbValidationError,
        )
        from media_summarizer.workers.artifact_generator.generators.summary_short import SummaryShortValidationError

        if isinstance(exc, (
            FlashcardsValidationError,
            NotesValidationError,
            QuizValidationError,
            ReviewBlurbValidationError,
            SummaryShortValidationError,
        )):
            error_code = "VALIDATION_ERROR"

        # The alarm layer's only view of this failure: re-raising below produces a
        # batchItemFailures entry, which Lambda counts as a successful invocation
        # (see media_summarizer/utils/llm_failure.py). artifact_id and
        # artifact_type ride along from the bound log context.
        log_llm_generation_failure(
            logger,
            worker="artifact_generator",
            exc=exc,
            error_code=error_code,
            source_count=len(sources),
        )

        if artifact_id:
            await fail_artifact_generation(
                artifact_id=artifact_id,
                error_message=str(exc),
                error_code=error_code,
                generation_revision=int(body["generation_revision"]),
                retryable=getattr(exc, "failure_kind", LLMFailureKind.TRANSIENT) != LLMFailureKind.PERMANENT,
            )

        # The retry axis, read off the exception rather than re-derived from its
        # message. A permanent refusal -- no credit, rejected key -- gets the same
        # answer on every redelivery, so returning normally acknowledges the
        # message instead of spending its two remaining deliveries and filling the
        # DLQ with records nobody can usefully replay. The entry is already
        # terminal in DynamoDB, so the client stops polling either way. This is
        # the asymmetry the translation worker has enforced since task-327.
        # Everything else keeps its deliveries: the default is transient, so an
        # unclassified error still gets its three attempts.
        failure_kind = getattr(exc, "failure_kind", LLMFailureKind.TRANSIENT)
        if failure_kind == LLMFailureKind.PERMANENT:
            log_event(
                logger,
                logging.WARNING,
                "artifact.delivery_acknowledged",
                "Permanent refusal: acknowledging the message instead of retrying",
                failure_kind=failure_kind,
                refusal_reason=getattr(exc, "refusal_reason", None),
                error_type=type(exc).__name__,
            )
            return
        raise
    finally:
        reset_log_context(context_token)


async def poll_queue() -> None:
    """Poll the unified artifact-generator queue."""
    from media_summarizer.workers.base_worker import process_message_with_retry

    log_event(
        logger,
        logging.INFO,
        "worker.started",
        "Starting artifact-generator worker queue poller",
        queue=ARTIFACT_GENERATOR_QUEUE,
    )
    while True:
        try:
            messages = await sqs.receive_messages(
                queue_name=ARTIFACT_GENERATOR_QUEUE,
                max_messages=5,
                wait_time_seconds=20,
                visibility_timeout=int(os.environ.get("SQS_VISIBILITY_TIMEOUT", "120")),
            )
            if messages:
                for message in messages:
                    await process_message_with_retry(
                        message=message,
                        processor=process_message,
                        queue_name=ARTIFACT_GENERATOR_QUEUE,
                        max_retries=int(os.environ.get("ARTIFACT_GENERATOR_MAX_RETRIES", "3")),
                        worker_name="artifact-generator-worker",
                    )
            await asyncio.sleep(1)
        except Exception as exc:
            log_event(
                logger,
                logging.ERROR,
                "worker.polling_error",
                "Artifact generator worker polling failed",
                queue=ARTIFACT_GENERATOR_QUEUE,
                exc_info=exc,
            )
            await asyncio.sleep(5)


async def main() -> None:
    setup_logging("artifact-generator-worker")
    await poll_queue()


if __name__ == "__main__":
    asyncio.run(main())
