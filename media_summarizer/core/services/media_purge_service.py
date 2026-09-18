"""
The cascade that removes everything one media item owns.

Two callers, one implementation, on purpose:

- ``account_deletion_service.purge_account`` (task-224) runs it over every media
  item of an account being erased.
- ``workers/cleanup/media_lifecycle.py`` (task-243) runs it for a single item when
  the ``user_media`` TTL sweeps a row the user deleted 30 days earlier.

The two paths *must* delete the same things. Media-scoped artifacts are owned by
``(user_id, media_key)`` and therefore survive deletion of one save while another
retained row for that content remains. That is why this module exists instead of
a second copy of the same logic in the worker.

An artifact is deleted at two different levels since task-394, and the difference is
who paid for the object:

- **an account's entry** goes with the account's scope, always. When it points at a
  shared generation it owns no S3 object, so deleting it deletes a row and nothing
  else — the object still answers every other account.
- **a shared generation** goes with the *content*, exactly like the transcript: only
  once no save anywhere still references that ``media_key``. Deleting it earlier would
  take the object out from under another account's entry.

Transcripts are globally deduplicated for the same reason, which is why the stream
caller checks for remaining ``media_key`` references before asking this module to
remove job objects.
"""

from __future__ import annotations

import logging
from typing import Dict, Iterable, List, Optional, Tuple

from media_summarizer.core.models.media_artifact import (
    ArtifactScope,
    MediaArtifactRecord,
    build_content_scope_key,
    build_scope_key,
)
from media_summarizer.utils import (
    media_artifacts,
    s3,
    translation_idempotence,
)
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)


def _bump(counts: Dict[str, int], step: str, count: int = 1) -> None:
    counts[step] = counts.get(step, 0) + count


# ---------------------------------------------------------------------------
# Artifacts
# ---------------------------------------------------------------------------


async def purge_artifacts_for_scopes(
    *,
    user_id: str,
    media_content_ids: Iterable[str] = (),
    folder_ids: Iterable[str] = (),
) -> Dict[str, int]:
    """Delete every artifact of the given scopes, plus the S3 objects they own.

    Folder scopes are passed explicitly because a folder's artifacts hang off
    the folder, not off any media item: an account erasure that only walked media
    items would leave every folder artifact behind.

    "The objects they own" is the whole subtlety. A media entry pointing at a shared
    generation owns no object — the object belongs to the generation, which serves
    other accounts and is purged with the *content*, by
    :func:`purge_shared_artifacts_for_content`. A folder artifact and an artifact over
    an uploaded file own theirs outright.
    """
    counts: Dict[str, int] = {}
    scopes = [
        (ArtifactScope.MEDIA, media_content_id)
        for media_content_id in sorted(set(media_content_ids))
    ] + [(ArtifactScope.FOLDER, folder_id) for folder_id in sorted(set(folder_ids))]

    for scope, scope_id in scopes:
        records, _ = await media_artifacts.list_artifacts_by_scope(
            scope_key=build_scope_key(user_id=user_id, scope=scope, scope_id=scope_id)
        )
        for record in records:
            _bump(counts, "artifact_objects_deleted", await _delete_owned_object(record))
            await media_artifacts.delete_media_artifact(record.artifact_id)
            _bump(counts, "artifact_rows_deleted")

    return counts


async def purge_shared_artifacts_for_content(
    *,
    content_ids: Iterable[str],
    ignore_user_id: Optional[str] = None,
) -> Dict[str, int]:
    """Delete the shared generations of content nobody holds any more (task-394).

    Content-level, not account-level: one generation answers every account that asked,
    so it survives until the last save of that ``media_key`` is gone — the same rule
    the transcript and the re-hosted cover already follow. Nothing else in the codebase
    can decide this, which is why the check lives here rather than in each caller: both
    of them would otherwise have to re-derive it, and the account purge would get it
    wrong.

    ``ignore_user_id`` is what makes it usable from an account erasure. That path runs
    the artifact purge *before* it deletes the account's library rows, so the rows about
    to disappear are still readable and would look like a live reference to every
    content the account held.
    """
    from media_summarizer.utils import user_media as user_media_store

    counts: Dict[str, int] = {}
    for content_id in sorted({cid for cid in content_ids if cid}):
        holders = [
            row
            for row in await user_media_store.list_by_media_key(
                content_id, include_deleted=True
            )
            if row.user_id != ignore_user_id
        ]
        if holders:
            _bump(counts, "shared_artifacts_kept_still_referenced")
            continue

        records, _ = await media_artifacts.list_artifacts_by_scope(
            scope_key=build_content_scope_key(
                scope=ArtifactScope.MEDIA, scope_id=content_id
            )
        )
        for record in records:
            _bump(
                counts,
                "shared_artifact_objects_deleted",
                await _delete_owned_object(record),
            )
            await media_artifacts.delete_media_artifact(record.artifact_id)
            _bump(counts, "shared_artifact_rows_deleted")

    return counts


async def _delete_owned_object(listed: MediaArtifactRecord) -> int:
    """Delete the S3 object of one artifact row, if that row is the one that owns it.

    The row has to be re-read from the base table: ``scope-index`` projects neither
    ``storage`` nor ``shared_artifact_id``, so a listed record carries no storage ref
    at all — which is why artifact objects used to survive every purge silently. Both
    attributes are needed here, and one ``GetItem`` per row to be deleted is a price
    only the purge pays.

    Returns how many objects were deleted: 0 or 1, so the caller can add it to its
    counters directly.
    """
    record = await media_artifacts.get_media_artifact_by_id(listed.artifact_id)
    if record is None or record.storage is None:
        return 0
    if record.shared_artifact_id is not None:
        # A pointer. The object belongs to the generation it mirrors, which other
        # accounts read through their own pointers.
        return 0
    storage = record.storage
    if not storage.bucket or not storage.key:
        return 0
    await s3.delete_object(storage.bucket, storage.key)
    return 1


# ---------------------------------------------------------------------------
# S3 objects produced by a processing job
# ---------------------------------------------------------------------------


async def purge_job_objects(
    job_id: str,
    *,
    transcription_s3_key: Optional[str] = None,
    audio_s3_key: Optional[str] = None,
    quiz_s3_key: Optional[str] = None,
) -> Dict[str, int]:
    """Every S3 object one job produced, plus the translation locks it owns.

    Prefix sweeps are keyed on the bare job id, which is safe because job ids are
    fixed-length UUIDs: none is a prefix of another.

    The explicit keys are optional because the two callers know different things.
    The account purge still holds the job row and passes the keys recorded on it,
    which catches objects written outside the id prefix. The TTL purge only has
    ``user_media.last_job_id`` — the job row may have expired years ago — so it
    relies on the prefix sweeps alone.
    """
    if not job_id:
        return {}

    counts: Dict[str, int] = {}
    audio_bucket = required_env("AUDIO_BUCKET")
    transcript_bucket = required_env("TRANSCRIPT_BUCKET")
    document_bucket = required_env("DOCUMENT_BUCKET")

    transcript_keys = await list_prefix(transcript_bucket, job_id)
    if transcription_s3_key and transcription_s3_key not in transcript_keys:
        transcript_keys.append(transcription_s3_key)

    for key in transcript_keys:
        source_key, language = _split_translated_key(key)
        if source_key and language:
            # The lock is fingerprinted on the *source* key, so it is recoverable
            # only from the translated object that proves it exists.
            await translation_idempotence.delete_translation_lock(
                translation_idempotence.build_translation_fingerprint(
                    transcript_s3_key=source_key,
                    target_language=language,
                )
            )
            _bump(counts, "translation_locks_deleted")
        await s3.delete_object(transcript_bucket, key)
        _bump(counts, "transcript_objects_deleted")

    _bump(counts, "audio_objects_deleted", await purge_prefix(audio_bucket, job_id))
    if audio_s3_key and not audio_s3_key.startswith(job_id):
        await s3.delete_object(audio_bucket, audio_s3_key)
        _bump(counts, "audio_objects_deleted")

    # Documents are stored under a per-job folder ("<job_id>/<file_name>").
    _bump(
        counts,
        "document_objects_deleted",
        await purge_prefix(document_bucket, f"{job_id}/"),
    )

    # Pre-artifact jobs wrote their quiz straight to a bucket instead of going
    # through media_artifacts, so that key only exists on the job row (task-406).
    if quiz_s3_key:
        await s3.delete_object(required_env("QUIZ_BUCKET"), quiz_s3_key)
        _bump(counts, "legacy_quiz_objects_deleted")

    return counts


def _split_translated_key(key: str) -> Tuple[Optional[str], Optional[str]]:
    """Recover ``(source_key, language)`` from a translated transcript key.

    Inverse of ``build_translated_transcript_key``: ``<stem>.translated.<lang>.<ext>``
    -> ``(<stem>.<ext>, <lang>)``. Returns ``(None, None)`` for a source key.
    """
    marker = ".translated."
    if marker not in key:
        return None, None
    stem, remainder = key.split(marker, 1)
    parts = remainder.split(".", 1)
    language = parts[0]
    if not language:
        return None, None
    if len(parts) == 1:
        return stem, language
    return f"{stem}.{parts[1]}", language


# ---------------------------------------------------------------------------
# S3 prefix helpers
# ---------------------------------------------------------------------------


async def list_prefix(bucket: str, prefix: str) -> List[str]:
    if not prefix:
        raise ValueError("refusing to list a whole bucket: prefix is required")
    return [
        str(obj["Key"])
        for obj in await s3.list_objects(bucket, prefix=prefix, max_keys=1000)
        if obj.get("Key")
    ]


async def purge_prefix(bucket: str, prefix: str) -> int:
    """Delete every object under a prefix, one page at a time.

    Re-listing after each page rather than paginating with a continuation token:
    the page just deleted is gone, so the next LIST returns the next 1000 keys.
    An empty ``prefix`` would mean "empty this bucket" and is rejected outright.
    """
    if not prefix:
        raise ValueError("refusing to purge a whole bucket: prefix is required")
    deleted = 0
    while True:
        keys = await list_prefix(bucket, prefix)
        if not keys:
            return deleted
        for key in keys:
            await s3.delete_object(bucket, key)
            deleted += 1
        if len(keys) < 1000:
            return deleted
