"""Translate a media's existing artifacts into the reader's language (task-395).

A reading language change used to translate nothing: the language travels in
``parameters``, ``parameters`` is in the hash, so the second language was a second
id and therefore a **regeneration from the whole transcript** — thousands of input
tokens to rewrite the four lines of a ``review_blurb``. What exists is translated
instead, on the model already proven for the full text
(``transcript_translation``): free local comparison of the languages, a model call
only when they differ, and persistence under a deterministic key so a couple
``(content, type, language)`` is never translated twice.

Three properties, and each is a consequence of *where* and *how* this runs rather
than of a flag:

- **it is the opening of a media that triggers it, never the language change.**
  ``PATCH /api/auth/me`` writes the preference and nothing else; this module is
  called from the scope listing (``artifact_service.list_scope_artifacts``), the
  read the detail screen issues on mount. Changing language therefore costs zero
  provider calls, and a library of 500 media translates the ones actually opened.
- **a translation is a new entry, never a mutation.** The history is append-only —
  an entry that reached ``ready`` is never written again — so the translation is
  written under the id its own ``parameters`` hash to, and the original keeps
  serving the accounts that read in its language. That id is *exactly* the one a
  native request for that type in that language computes, which is what makes a
  later tap on the tile answer ``reused`` instead of generating.
- **it is free to re-decide.** The pointer of the target language lives in the same
  scope key as its source, so it is already in the listing page the caller holds:
  a media whose artifacts are all translated costs no read at all, which is what
  makes reopening — and every poll of the tile — cost nothing.

Nothing here debits the quota, for the reason ``review_blurb_service`` states: the
allowance is spent by what the *user* asks for, and this is a background
generation nobody requested. What the operator pays is measured all the same, on
the entry's ``llm_usage`` and through ``record_observed_cost`` in the worker.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from media_summarizer.core.models.media_artifact import (
    ArtifactScope,
    MediaArtifactRecord,
    MediaArtifactStatus,
    MediaArtifactType,
    build_scope_key,
)
from media_summarizer.core.services import artifact_service
from media_summarizer.core.services.transcript_translation import (
    TRANSLATION_MODEL,
    normalize_language_tag,
    should_translate,
)
from media_summarizer.utils import media_artifacts
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

#: Bumped when the translation prompt changes. Recorded on the entry, never keyed
#: on: like every ``generator_version`` it buys traceability, not a right to
#: re-translate what is already translated.
TRANSLATION_PROMPT_VERSION = "prompt-v1"


def build_translation_generator_version(artifact_type: MediaArtifactType) -> str:
    """What produced this entry: a translation of an artifact, not a generation.

    Deliberately shaped like ``get_generator_version`` and deliberately different
    from it: reading a row must tell whether its text came out of the transcript or
    out of another entry, and which model did it.
    """
    return f"{artifact_type.value}:translated:{TRANSLATION_MODEL}:{TRANSLATION_PROMPT_VERSION}"


async def translate_scope_artifacts_for_reader(
    *,
    user_id: str,
    scope_id: str,
    content_scope_id: str,
    reading_language: Optional[str],
    listed: Sequence[MediaArtifactRecord],
) -> List[MediaArtifactRecord]:
    """Arm the translations a media needs to be readable in ``reading_language``.

    Returns the entries armed — possibly none, which is the normal case — so the
    caller can show them straight away instead of waiting for the next poll to
    discover them.

    ``listed`` is the scope page the caller already read, *before* the internal
    types are filtered out: that is what makes the preview translatable from here
    and what keeps the whole decision at zero extra DynamoDB queries.

    Never raises. This runs inside a read, and a listing that cannot arm a
    translation must still hand back the history.
    """
    target = normalize_language_tag(reading_language)
    if not target:
        return []

    armed: List[MediaArtifactRecord] = []
    for artifact_type, rows in _rows_by_type(listed).items():
        try:
            entry = await _translate_one_type(
                user_id=user_id,
                scope_id=scope_id,
                content_scope_id=content_scope_id,
                artifact_type=artifact_type,
                rows=rows,
                target_language=target,
            )
        except Exception as exc:  # noqa: BLE001 - a read must still answer
            log_event(
                logger,
                logging.WARNING,
                "artifact.translation_not_armed",
                "Could not arm the translation of this artifact type (non-fatal)",
                artifact_type=artifact_type.value,
                scope_id=scope_id,
                target_language=target,
                error_type=type(exc).__name__,
                detail=str(exc)[:200],
            )
            continue
        if entry is not None:
            armed.append(entry)
    return armed


def _rows_by_type(
    listed: Sequence[MediaArtifactRecord],
) -> Dict[MediaArtifactType, List[MediaArtifactRecord]]:
    """Group a scope page by artifact type, keeping the order it came in."""
    grouped: Dict[MediaArtifactType, List[MediaArtifactRecord]] = {}
    for record in listed:
        if record.artifact_type not in artifact_service.GENERATABLE_ARTIFACT_TYPES:
            continue
        grouped.setdefault(record.artifact_type, []).append(record)
    return grouped


async def _translate_one_type(
    *,
    user_id: str,
    scope_id: str,
    content_scope_id: str,
    artifact_type: MediaArtifactType,
    rows: List[MediaArtifactRecord],
    target_language: str,
) -> Optional[MediaArtifactRecord]:
    """The entry armed for one artifact type, or ``None`` when there is nothing to do.

    Reads nothing at all in the common case. The pointer an entry in the target
    language would be written under is derived from the same recipe every request
    uses, and it lives in this very scope key — so its presence in the page proves
    the reading language is already served, whatever the state of that entry. That
    check is what makes a reopen, and every poll of an in-flight tile, free.

    Only then does it read one row, and only one: the *oldest* ``ready`` entry of
    the type. Oldest rather than newest because that is the one generated from the
    transcript — translating the newest would chain translation onto translation
    and drift a little further from the source each time a reader changes language.
    """
    expected_id = artifact_service.build_artifact_id(
        user_id=user_id,
        scope=ArtifactScope.MEDIA,
        scope_id=content_scope_id,
        artifact_type=artifact_type,
        parameters={"language": target_language},
        source_media_item_ids=[content_scope_id],
    )
    if any(row.artifact_id == expected_id for row in rows):
        return None

    ready = sorted(
        (row for row in rows if row.status == MediaArtifactStatus.READY),
        key=lambda row: row.created_at,
    )
    if not ready:
        # Either nothing finished yet, or every entry failed. A type that exists in
        # no language at all is out of scope: it is a normal generation, and one
        # that failed is retried by the request that asks for it, not from a read.
        return None

    source = await media_artifacts.get_media_artifact_by_id(ready[0].artifact_id)
    if source is None or source.storage is None:
        return None

    # The artifact *declares* the language it was written in, and that declaration
    # is part of its id — so there is nothing to detect here, unlike a transcript.
    # An entry with no declared language names no couple to key a translation on
    # and is left alone.
    source_language = normalize_language_tag(source.parameters.get("language"))
    if source_language is None:
        return None
    if not should_translate(source_language, target_language):
        return None

    # The recipe is verified, not assumed. The fast path above hashed the material a
    # media artifact is keyed on — one content id, and the language as the only
    # parameter — so it is recomputed here on the entry in hand, whose id is known.
    # A mismatch would mean the target id is wrong too, and a translation written
    # under an id no request ever computes is paid for and never reused. Standing
    # down leaves the type to be generated as before, which is merely expensive.
    if (
        artifact_service.build_artifact_id(
            user_id=source.user_id,
            scope=ArtifactScope.MEDIA,
            scope_id=content_scope_id,
            artifact_type=artifact_type,
            parameters=artifact_service.normalize_artifact_parameters(
                source.parameters
            ),
            source_media_item_ids=[content_scope_id],
        )
        != source.artifact_id
    ):
        log_event(
            logger,
            logging.INFO,
            "artifact.translation_recipe_mismatch",
            "Artifact id does not recompute from its content: not translating it",
            artifact_id=source.artifact_id,
            artifact_type=artifact_type.value,
            scope_id=scope_id,
        )
        return None

    plan = await _plan_translation(
        source=source,
        source_language=source_language,
        user_id=user_id,
        scope_id=scope_id,
        content_scope_id=content_scope_id,
        target_language=target_language,
    )
    if plan is None:
        return None

    entry, outcome = await artifact_service.commit_artifact_generation(plan)
    log_event(
        logger,
        logging.INFO,
        "artifact.translation_armed",
        "Artifact translated into the reader's language instead of regenerated",
        artifact_id=entry.artifact_id,
        shared_artifact_id=entry.shared_artifact_id,
        source_artifact_id=source.artifact_id,
        artifact_type=artifact_type.value,
        scope_id=scope_id,
        source_language=source_language,
        target_language=target_language,
        outcome=outcome.value,
    )
    return entry


async def _plan_translation(
    *,
    source: MediaArtifactRecord,
    source_language: str,
    user_id: str,
    scope_id: str,
    content_scope_id: str,
    target_language: str,
) -> Optional[artifact_service.ArtifactGenerationPlan]:
    """What has to be written for the translation, or ``None`` if nothing has.

    Built on the very recipes a request uses, which is the point: the entry lands
    on the id a native request for this type in this language would compute, so the
    tap that follows the language change is answered by this entry instead of
    generating a second one — and another account reading in the same language is
    served by the same shared row.

    The source's own snapshot is carried over unchanged: the translation covers
    exactly the sources its original covered, and it must claim neither more nor
    less. Nothing of the source row is written.
    """
    parameters = artifact_service.normalize_artifact_parameters(
        {**source.parameters, "language": target_language}
    )
    now = datetime.now(timezone.utc)
    artifact_id = artifact_service.build_artifact_id(
        user_id=user_id,
        scope=ArtifactScope.MEDIA,
        scope_id=content_scope_id,
        artifact_type=source.artifact_type,
        parameters=parameters,
        source_media_item_ids=[content_scope_id],
    )
    if artifact_id == source.artifact_id:
        return None

    # Consistent, unlike the listing page the fast path above reads: the index lags
    # a write by a moment, so this is what stops two opens seconds apart from arming
    # the same translation twice.
    existing = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if existing is not None and existing.status != MediaArtifactStatus.FAILED:
        return None

    generator_version = build_translation_generator_version(source.artifact_type)
    entry = MediaArtifactRecord(
        artifact_id=artifact_id,
        user_id=user_id,
        scope=ArtifactScope.MEDIA,
        scope_id=scope_id,
        scope_key=build_scope_key(
            user_id=user_id, scope=ArtifactScope.MEDIA, scope_id=content_scope_id
        ),
        artifact_type=source.artifact_type,
        status=MediaArtifactStatus.QUEUED,
        parameters=parameters,
        generator_version=generator_version,
        source_count=source.source_count,
        sources=source.sources,
        created_at=existing.created_at if existing is not None else now,
        updated_at=now,
    )
    entry_reclaims_failed = existing is not None

    if not artifact_service.mutualizes_generation(
        scope=ArtifactScope.MEDIA, content_scope_id=content_scope_id
    ):
        # A file the account sent: nothing to share, so this row *is* the generation.
        return artifact_service.ArtifactGenerationPlan(
            entry=entry,
            entry_reclaims_failed=entry_reclaims_failed,
            generation=entry,
            message=build_translation_message(
                record=entry,
                source=source,
                source_language=source_language,
                target_language=target_language,
            ),
        )

    shared_id = artifact_service.build_shared_artifact_id(
        scope=ArtifactScope.MEDIA,
        scope_id=content_scope_id,
        artifact_type=source.artifact_type,
        parameters=parameters,
        source_media_item_ids=[content_scope_id],
    )
    entry.shared_artifact_id = shared_id
    shared_existing = await media_artifacts.get_media_artifact_by_id(shared_id)
    if (
        shared_existing is not None
        and shared_existing.status != MediaArtifactStatus.FAILED
    ):
        # This content already exists in the reading language — translated for
        # another account, or generated natively for one. Either way the provider is
        # not called: the account gains a pointer to it.
        return artifact_service.ArtifactGenerationPlan(
            entry=artifact_service.entry_served_by(entry=entry, shared=shared_existing),
            entry_reclaims_failed=entry_reclaims_failed,
        )

    shared = artifact_service.build_shared_generation_record(
        shared_artifact_id=shared_id,
        user_id=user_id,
        scope=ArtifactScope.MEDIA,
        scope_id=scope_id,
        content_scope_id=content_scope_id,
        artifact_type=source.artifact_type,
        parameters=parameters,
        generator_version=generator_version,
        sources=source.sources,
        source_count=source.source_count,
        created_at=shared_existing.created_at if shared_existing is not None else None,
    )
    return artifact_service.ArtifactGenerationPlan(
        entry=entry,
        entry_reclaims_failed=entry_reclaims_failed,
        generation=shared,
        generation_reclaims_failed=shared_existing is not None,
        message=build_translation_message(
            record=shared,
            source=source,
            source_language=source_language,
            target_language=target_language,
        ),
    )


def build_translation_message(
    *,
    record: MediaArtifactRecord,
    source: MediaArtifactRecord,
    source_language: str,
    target_language: str,
) -> Dict[str, Any]:
    """The SQS payload of one translation.

    Same queue and same envelope as a generation, with ``translation`` where
    ``sources`` would be — that key is what tells the worker to read one stored
    artifact instead of every transcript, and it is the whole of the saving: a few
    hundred tokens of finished text against the whole corpus.

    No ``prompt_cache_key``: there is no corpus prefix to share between the types,
    since each translation reads only its own payload.
    """
    if source.storage is None:  # pragma: no cover - callers check it first
        raise artifact_service.ArtifactServiceError(
            f"Artifact {source.artifact_id} has no stored payload to translate."
        )
    return {
        "artifact_id": record.artifact_id,
        "user_id": record.user_id,
        "scope": record.scope.value,
        "scope_id": record.scope_id,
        "artifact_type": record.artifact_type.value,
        "parameters": record.parameters,
        "generator_version": record.generator_version,
        "translation": {
            "source_artifact_id": source.artifact_id,
            "bucket": source.storage.bucket,
            "key": source.storage.key,
            "source_language": source_language,
            "target_language": target_language,
        },
    }
