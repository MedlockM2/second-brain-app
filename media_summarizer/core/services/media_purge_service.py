"""
The cascade that removes everything one media item owns.

Two callers, one implementation, on purpose:

- ``account_deletion_service.purge_account`` (task-224) runs it over every media
  item of an account being erased.
- ``workers/cleanup/media_lifecycle.py`` (task-243) runs it for a single item when
  the ``user_media`` TTL sweeps a row the user deleted 30 days earlier.

The two paths *must* delete the same things. That is why this module exists instead
of a second copy of the same logic in the worker — and why the **last-holder test**
lives here (:func:`content_holders`) rather than in each caller: both would
otherwise have to re-derive it, and the account purge used not to apply it at all,
which is the bug task-432 closes.

Two levels, and the only question that separates them
-----------------------------------------------------
*Who would still be reading this object tomorrow?*

- **Account level.** The object exists because of one account and answers only that
  account. It goes with the account, unconditionally, and goes with a single save
  when that save is the account's last one for the content. Reached through a key
  that carries the ``user_id`` (``shared-audio/<user_id>/``, a bug-report
  attachment) or through a job that carries no ``media_key`` at all — a direct
  document or audio upload, whose content identity is account-scoped and which no
  other account can ever compute (``media_identity.is_account_scoped_media_key``).
- **Content level.** The object answers every account that saved the same
  ``media_key``, because the pipeline produced it once and deduplicated the rest.
  It goes only when :func:`content_holders` reports that no save anywhere still
  references that content.

Deleting a content-level object at account level is the whole failure mode: account
A shares a Reel, account B shares the same Reel and reuses A's transcript, A deletes
its account, and B's reader, artifact generation and digests all lose their source.

Where each key a job carries lands, and why (task-432)
------------------------------------------------------
- ``transcription_s3_key`` — **content**. The text of the content, written once:
  the second save of a public media runs no job at all and reads this exact object
  (``media_submission``, ``finalize_deduplicated_save``). Its translations are
  derived keys of the same object (``<stem>.translated.<lang>.<ext>``) and their
  locks are fingerprinted on the source key, so both follow it.
- ``audio_s3_key`` — **content**. Same reasoning one step earlier in the pipeline:
  the media file is downloaded once, under the content job's id, and a deduplicated
  save never re-downloads it. An *uploaded* audio file is not this case — its job
  carries no ``media_key``, so it is account level by the rule above.
- ``quiz_s3_key`` — **content**. A generation over the content, from before
  generations went through ``media_artifacts`` (task-406). Since task-394 a shared
  generation belongs to the content; this legacy key is the same kind of object
  under another name, so it gets the same rule rather than a second one.
- The per-job document prefix in ``DOCUMENT_BUCKET`` — **account**, by
  construction: only an upload writes there, and an upload's job carries no
  ``media_key``.

An artifact is deleted at the same two levels since task-394, and the difference is
who paid for the object:

- **an account's entry** goes with the account's scope, always. When it points at a
  shared generation it owns no S3 object, so deleting it deletes a row and nothing
  else — the object still answers every other account.
- **a shared generation** goes with the *content*, exactly like the transcript: only
  once no save anywhere still references that ``media_key``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from media_summarizer.core.models.media_artifact import (
    ArtifactScope,
    MediaArtifactRecord,
    build_content_scope_key,
    build_scope_key,
)
from media_summarizer.utils import (
    media_artifacts,
    media_idempotence,
    s3,
    translation_idempotence,
)
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)


def _bump(counts: Dict[str, int], step: str, count: int = 1) -> None:
    counts[step] = counts.get(step, 0) + count


# ---------------------------------------------------------------------------
# The last-holder test
# ---------------------------------------------------------------------------


async def content_holders(
    media_key: str,
    *,
    ignore_user_id: Optional[str] = None,
    ignore_save: Optional[Tuple[str, str]] = None,
) -> List[Any]:
    """Every save that still references this content, minus the ones going away.

    The single answer to "may a content-level object go?". An empty list means this
    content has no holder left anywhere, which is the only state in which its
    transcript, its media file, its re-hosted cover and its ledger row may be
    deleted.

    Soft-deleted rows count as holders (``include_deleted=True``): a row inside its
    30-day grace window is restorable, and purging the content under it would make
    the restore give back an item with no text.

    The two exclusions are the two shapes of "about to disappear", and a caller
    passes the one that matches what it is deleting:

    - ``ignore_user_id`` — an account erasure. It purges content *before* it deletes
      the account's library rows, so those rows are still readable and would every
      one of them look like a live reference.
    - ``ignore_save`` — a ``(user_id, media_item_id)`` pair whose row the TTL has
      just swept. Only that one save is gone; the same account may well hold the
      content through another save, which is a holder like any other.
    """
    from media_summarizer.utils import user_media as user_media_store

    rows = await user_media_store.list_by_media_key(media_key, include_deleted=True)
    return [
        row
        for row in rows
        if row.user_id != ignore_user_id
        and (ignore_save is None or (row.user_id, row.media_item_id) != ignore_save)
    ]


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
    counts: Dict[str, int] = {}
    for content_id in sorted({cid for cid in content_ids if cid}):
        holders = await content_holders(content_id, ignore_user_id=ignore_user_id)
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
# Content-level objects
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class JobObjectKeys:
    """A job id, plus whatever keys the caller can name off its row.

    The prefix sweeps of :func:`purge_job_objects` do the bulk of the work; the
    explicit keys are there for an object written outside the job's id prefix,
    which only a caller still holding the job row can know about.
    """

    job_id: str
    transcription_s3_key: Optional[str] = None
    audio_s3_key: Optional[str] = None
    quiz_s3_key: Optional[str] = None


async def purge_content_for_media_key(
    *,
    media_key: str,
    ignore_user_id: Optional[str] = None,
    ignore_save: Optional[Tuple[str, str]] = None,
    jobs: Iterable[JobObjectKeys] = (),
    cover_locators: Iterable[str] = (),
) -> Dict[str, int]:
    """Destroy everything one content owns, if and only if nobody holds it any more.

    The content-level half of both purge paths, and the only place that decides it.
    Everything here goes together or stays together — the transcript and its
    translations, the media file, the legacy quiz object, the translation locks, the
    re-hosted cover, and the ledger row that names the transcript. Letting any one of
    them go early is how a reader ends up with a row that promises text nothing can
    serve, and how the ledger ends up answering "already processed, job X" for an
    object that no longer exists.

    Which job wrote the objects is read from the ledger *and* from the caller:

    - the ledger's ``job_id`` is the content job, which may belong to an account
      that was erased long ago and is the only name for the objects it wrote;
    - ``jobs`` is what the caller already holds — the account's own jobs for this
      content, or the swept row's ``last_job_id``, which covers a content whose
      ledger row has already been purged.

    The union of the two is swept, by prefix, which is idempotent and lets the same
    object be named twice at no cost.

    Returns the counters of what it did, including ``content_kept_still_referenced``
    when the last-holder test refused the purge — a normal and frequent outcome.
    """
    counts: Dict[str, int] = {}
    if not media_key:
        return counts

    if await content_holders(
        media_key, ignore_user_id=ignore_user_id, ignore_save=ignore_save
    ):
        _bump(counts, "content_kept_still_referenced")
        return counts

    ledger = await media_idempotence.already_processed(media_key)
    ledger_job_id = str((ledger or {}).get("job_id") or "")

    targets: Dict[str, JobObjectKeys] = {
        keys.job_id: keys for keys in jobs if keys.job_id
    }
    if ledger_job_id and ledger_job_id not in targets:
        targets[ledger_job_id] = JobObjectKeys(
            job_id=ledger_job_id,
            transcription_s3_key=media_idempotence.transcript_s3_key_of(ledger),
        )

    for job_id in sorted(targets):
        keys = targets[job_id]
        for step, count in (
            await purge_job_objects(
                job_id,
                transcription_s3_key=keys.transcription_s3_key,
                audio_s3_key=keys.audio_s3_key,
                quiz_s3_key=keys.quiz_s3_key,
            )
        ).items():
            _bump(counts, step, count)

    # A re-hosted cover is one object shared by every save of the content: a
    # deduplicated save copies the locator of the first one onto its own row
    # (``display_attributes_from_job``), so the object belongs to the content. A
    # hotlinked URL has nothing to delete and ``delete_cover`` says so (task-304).
    from media_summarizer.core.services import cover_capture

    for locator in sorted({loc for loc in cover_locators if loc}):
        if not cover_capture.parse_cover_locator(locator):
            continue
        if await cover_capture.delete_cover(locator):
            _bump(counts, "cover_objects_deleted")
        else:
            # Already logged by delete_cover; a thumbnail never stalls a purge.
            _bump(counts, "cover_objects_delete_failed")

    if ledger is not None and await media_idempotence.delete_content_entry(
        media_key=media_key,
        job_id=ledger_job_id,
    ):
        _bump(counts, "media_idempotence_rows_deleted")

    return counts


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

    **Unconditional.** It deletes what it is given and asks nobody. Whether it may
    run at all is the caller's decision, and there are exactly two right answers:
    :func:`purge_content_for_media_key` for a job that worked on shared content, a
    direct call for a job carrying no ``media_key`` — a document or audio upload,
    whose objects no second account can ever be reading.

    Prefix sweeps are keyed on the bare job id, which is safe because job ids are
    fixed-length UUIDs: none is a prefix of another.

    The explicit keys are optional because callers know different things. One
    holding the job row passes the keys recorded on it, which catches objects
    written outside the id prefix. A content purge whose job row expired years ago
    has only the ledger's recorded transcript key, and relies on the prefix sweeps
    for the rest.
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
