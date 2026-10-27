"""Trigger the internal ``review_blurb`` artifact at the end of ingestion (task-323).

Its own module rather than a function in ``digest_service``: the completion path of
every ingestion would then import the digest graph — digest records, digest
settings, weekly assembly, the push producer — to write one triage card. This module
imports the artifact service and the library store, nothing else.

It is the only background generation left in the codebase, since the digest stopped
pre-generating anything (task-366). The chain is ``resolve_scope_sources`` →
``enforce_scope_ceilings`` → ``plan_artifact_generation`` → ``commit_artifact_generation``,
and **no quota is debited**: the allowance is spent by what the *user* asks for, and
the endpoint in ``api/endpoints/artifacts.py`` is the only place that debits it. A
background artifact nobody requested must not eat into what the user paid for.
"""

from __future__ import annotations

import logging
from typing import Optional

from media_summarizer.core.models.media_artifact import ArtifactScope, MediaArtifactType
from media_summarizer.core.services.durable_media_service import (
    resolve_content_transcript,
)
from media_summarizer.utils import user_media as user_media_store

logger = logging.getLogger(__name__)


async def trigger_review_blurb_generation(
    user_id: str,
    media_item_id: str,
) -> Optional[str]:
    """Queue the blurb for one library row, or return ``None`` if there is nothing to do.

    Returns the ``artifact_id`` that answers this row (queued or already existing),
    ``None`` when the row cannot produce one — no row, deleted row, no transcript,
    a blurb already there, or a service error. Never raises: every caller is a
    completion hook whose SQS message must still be deleted.
    """
    try:
        record = await user_media_store.get_user_media(user_id, media_item_id)
    except Exception as exc:
        logger.warning(
            "review_blurb: cannot read library row %s: %s", media_item_id, exc
        )
        return None

    if record is None or record.is_deleted:
        logger.debug(
            "review_blurb: no live library row for %s, nothing to generate",
            media_item_id,
        )
        return None

    # Already provisioned. Checked first so a redelivered completion event, or a
    # backfill re-run, costs one GetItem instead of a scope resolution.
    if record.review_blurb is not None and record.review_blurb.hook.strip():
        return None

    # The content's own transcript, off the global ledger: a save that reuses the
    # text another account's ingestion produced gets its blurb exactly like the
    # first one, and keeps getting it after that account is erased (task-432).
    if await resolve_content_transcript(record) is None:
        logger.debug("review_blurb: no transcript yet for %s", media_item_id)
        return None

    from media_summarizer.core.services.artifact_service import (
        ArtifactGenerationOutcome,
        ArtifactScopeEmptyError,
        ArtifactServiceError,
        ArtifactTranscriptNotReadyError,
        commit_artifact_generation,
        copy_review_blurb_to_library_row,
        enforce_scope_ceilings,
        plan_artifact_generation,
        resolve_scope_sources,
    )

    try:
        # The original transcript feeds the model directly (task-398), with the
        # language captured on this save. Profile changes never replace its card.
        resolution = await resolve_scope_sources(
            user_id=user_id,
            scope=ArtifactScope.MEDIA,
            scope_id=media_item_id,
            reading_language=record.reading_language,
        )
        enforce_scope_ceilings(resolution)

        plan = await plan_artifact_generation(
            user_id=user_id,
            scope=ArtifactScope.MEDIA,
            scope_id=media_item_id,
            content_scope_id=record.media_key,
            artifact_type=MediaArtifactType.REVIEW_BLURB,
            resolution=resolution,
        )
        artifact, outcome = await commit_artifact_generation(plan)

        # REUSED means the blurb of this content already exists — a second save by
        # the same user (same artifact_id) or another account's save that already
        # paid for the generation (task-394). Either way this row was never written
        # to, and repairing it from the stored object costs one S3 read and spends
        # nothing on the model.
        if outcome == ArtifactGenerationOutcome.REUSED:
            await copy_review_blurb_to_library_row(
                record=artifact,
                media_item_id=media_item_id,
            )

        logger.info(
            "review_blurb: %s for %s (artifact %s)",
            outcome.value,
            media_item_id,
            artifact.artifact_id,
        )
        return artifact.artifact_id
    except (
        ArtifactScopeEmptyError,
        ArtifactTranscriptNotReadyError,
        ArtifactServiceError,
    ) as exc:
        logger.warning(
            "review_blurb: failed to trigger for %s: %s", media_item_id, exc
        )
        return None
