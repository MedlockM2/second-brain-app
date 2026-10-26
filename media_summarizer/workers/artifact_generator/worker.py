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

A message carrying a ``translation`` block is the same work in the small: the
artifact already exists in another language, so one stored payload is read instead
of N transcripts and the model rewrites a few hundred words instead of reading the
whole corpus (task-395). Everything around it is shared on purpose — the same
queue, the same lease, the same failure taxonomy, the same sealing call — because
what changes is only where the input text comes from.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict

from media_summarizer.core.models.artifact_options import ArtifactOptions
from media_summarizer.core.models.media_artifact import MediaArtifactType
from media_summarizer.core.services import llm_client, llm_corpus
from media_summarizer.core.services.artifact_service import (
    MAX_FOLDER_CORPUS_TOKENS,
    claim_artifact_generation,
    complete_artifact_generation,
    fail_artifact_generation,
)
from media_summarizer.utils import s3, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.llm_failure import (
    LLMFailureKind,
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
    # Present when this entry is another entry's text in another language: the input
    # is one stored artifact, so there is no corpus to download and no snapshot to
    # carry in the message (task-395).
    translation = body.get("translation") or None

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
        if not artifact_id or not (sources or translation):
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
        claimed = await claim_artifact_generation(artifact_id)
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

        if translation is not None:
            # Same lease, same failure handling below, same sealing call — only the
            # input text and the prompt differ.
            await _translate_stored_artifact(
                body=body,
                artifact_id=artifact_id,
                artifact_type=artifact_type,
                translation=translation,
            )
            return

        corpus_sources = await llm_corpus.download_transcripts(sources)

        # Second ceiling check, on the text actually downloaded: the API measured
        # the corpus before the transcripts were read, and a source can have grown
        # since. Failing here costs nothing; sending a request the provider will
        # reject costs the whole invocation.
        estimated_tokens = llm_corpus.estimate_tokens(
            llm_corpus.corpus_byte_length(corpus_sources)
        )
        if estimated_tokens > MAX_FOLDER_CORPUS_TOKENS:
            raise ValueError(
                f"corpus_too_large: {estimated_tokens} estimated tokens exceeds "
                f"{MAX_FOLDER_CORPUS_TOKENS}"
            )

        # The options travel in `parameters` without their defaults (the request
        # dropped them before hashing); reading them here fills the defaults back in.
        prompt = generator.build_prompt(
            corpus_sources,
            language=language,
            options=ArtifactOptions.from_parameters(parameters),
        )

        # The configured model supports Structured Outputs (llm_config), so a
        # generator that has a schema always sends it.
        schema = generator.response_format_schema()

        result = await llm_client.complete(
            [{"role": "user", "content": prompt}],
            response_format=schema,
            prompt_cache_key=prompt_cache_key,
            artifact_type=artifact_type.value,
        )
        raw_content = result.content
        llm_usage = result.usage

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

        await complete_artifact_generation(
            artifact_id=artifact_id,
            content=envelope,
            title=artifact_title,
            llm_usage=llm_usage,
        )

        # Keyed on the artifact, so a redelivery cannot record twice.
        await llm_client.record_observed_cost(
            body.get("user_id"),
            llm_usage,
            idempotency_token=f"artifact_cost:{artifact_id}",
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


async def _translate_stored_artifact(
    *,
    body: Dict[str, Any],
    artifact_id: str,
    artifact_type: MediaArtifactType,
    translation: Dict[str, Any],
) -> None:
    """Write this entry as another entry's payload in another language (task-395).

    One S3 read and one model call over a text of a few hundred words, where a
    generation reads the whole corpus. The stored envelope's ``sources`` and
    ``source_count`` are carried over unchanged: the translation covers exactly what
    its original covered, and claiming anything else would make the Sources tab lie.
    """
    from media_summarizer.workers.artifact_generator import translation as translator

    source_language = translation.get("source_language")
    target_language = translation.get("target_language")
    source_artifact_id = translation.get("source_artifact_id")
    bucket = translation.get("bucket")
    key = translation.get("key")
    if not bucket or not key or not source_language or not target_language:
        raise ValueError("Incomplete translation block on the artifact message")

    raw = await s3.download_file_to_memory(bucket=bucket, key=key)
    source_envelope = json.loads(raw.decode("utf-8"))
    source_content = source_envelope.get("content")
    if not isinstance(source_content, (dict, list)):
        raise ValueError(
            f"Artifact {source_artifact_id} has no payload to translate"
        )

    segments = translator.collect_segments(source_content)
    if not segments:
        raise ValueError(
            f"Artifact {source_artifact_id} holds no translatable text"
        )

    result = await llm_client.complete(
        [
            {
                "role": "user",
                "content": translator.build_prompt(
                    segments=segments,
                    source_language=source_language,
                    target_language=target_language,
                    artifact_type=artifact_type.value,
                ),
            }
        ],
        response_format=translator.build_response_format(len(segments)),
        artifact_type=artifact_type.value,
    )
    raw_content = result.content
    llm_usage = result.usage
    translated_content = translator.apply_segments(
        source_content,
        segments=segments,
        translated=translator.read_translated_segments(
            _strip_code_fences(raw_content)
        ),
    )

    envelope: Dict[str, Any] = {
        "artifact_id": artifact_id,
        "artifact_type": artifact_type.value,
        "scope": body.get("scope"),
        "scope_id": body.get("scope_id"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_count": source_envelope.get("source_count"),
        "sources": source_envelope.get("sources") or [],
        "generator_version": body.get("generator_version"),
        "llm_usage": llm_usage.model_dump(exclude_none=True),
        # What this entry is, readable from the payload alone: whose text it carries
        # and which model moved it across.
        "translated_from": {
            "artifact_id": source_artifact_id,
            "source_language": source_language,
            "target_language": target_language,
            "model": llm_usage.model,
        },
        "content": translated_content,
    }

    await complete_artifact_generation(
        artifact_id=artifact_id,
        content=envelope,
        title=(
            translated_content.get("title")
            if isinstance(translated_content, dict)
            else None
        ),
        llm_usage=llm_usage,
    )
    await llm_client.record_observed_cost(
        body.get("user_id"),
        llm_usage,
        idempotency_token=f"artifact_cost:{artifact_id}",
    )

    log_event(
        logger,
        logging.INFO,
        "artifact.translated",
        "Artifact translated from an existing entry instead of regenerated",
        artifact_id=artifact_id,
        source_artifact_id=source_artifact_id,
        artifact_type=artifact_type.value,
        source_language=source_language,
        target_language=target_language,
        segment_count=len(segments),
        model=llm_usage.model,
        prompt_tokens=llm_usage.prompt_tokens,
        completion_tokens=llm_usage.completion_tokens,
        cost_eur=llm_usage.cost_eur,
    )


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
