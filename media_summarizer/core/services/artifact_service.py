"""
Artifact generation: scope resolution, reuse of what already exists, storage.

Both scopes go through one mechanism (task-269 decision, strategy S1): a media
artifact is a folder artifact whose ``sources`` has one element. A request
resolves the scope's sources, checks the ceilings, writes **one immutable history
entry** and enqueues **one** SQS message per artifact type.

One rule decides whether anything is generated at all (task-316 owner decision):
**an existing artifact is reused as soon as the set of sources behind it is
identical, and a generation only happens when that set differs.** The
``artifact_id`` is a hash of (user, scope, scope_id, type, parameters, sorted
source ids) with no time component, so finding the artifact that already answers a
request is a single ``GetItem`` with no time bound and no lock table. A media item
has exactly one source and that set never changes, so "one generation per type
per media" follows from the same rule with no special case; a folder can
legitimately produce a new entry, and only once its sources have changed.

The history stays append-only: a different source set writes a new entry next to
the older ones, and nothing is ever overwritten or invalidated. The single
exception is an entry that *failed* — it holds no artifact to reuse, so a request
for the same key reclaims it and generates again rather than being barred forever
by one transient provider error.

Since task-394 that rule crosses accounts for a **media** scope: everything the id
hashes except ``user_id`` is already content identity — ``effective_scope_id`` is
the deduplicated ``media_key`` and the source ids are content ids — so two accounts
asking for the same type, in the same language, over the same content were paying
for two generations of identical text. They no longer do, and the request is served
by two rows instead of one:

- a **shared generation**, keyed on the content alone
  (:func:`build_shared_artifact_id`) and indexed under a scope key no account can
  produce (``@content#media#…``). It is what the worker generates into and what owns
  the S3 object. Exactly one exists per (content, type, parameters);
- a **pointer**, one per account that asked, keyed exactly as before
  (:func:`build_artifact_id`) and carrying ``shared_artifact_id``. It is the only
  row the API addresses, so a listing still shows an account nothing but what it
  asked for.

Two consequences, both deliberate. The quota no longer depends on whether a
generation ran: it is debited whenever an account gains an entry, and the avoided
provider call accrues to the operator rather than as free allowance to whoever
happened to ask second. And a scope that is *not* content-addressed keeps a single
per-account row with no indirection at all: a folder artifact (its scope id is a
folder id, owned by one account) and an artifact over a user-uploaded file (whose
content id names its owner — see :func:`mutualizes_generation`).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError

from media_summarizer.core.media_ingestion.source_description import (
    job_source_description,
)
from media_summarizer.core.models import ProcessingJob
from media_summarizer.core.models.media_artifact import (
    DEFAULT_ARTIFACT_TYPES_ALLOWED,
    ArtifactLlmUsage,
    ArtifactScope,
    ArtifactSource,
    ArtifactStorageRef,
    MediaArtifactRecord,
    MediaArtifactStatus,
    MediaArtifactType,
    build_content_scope_key,
    build_scope_key,
    content_scope_id_from_scope_key,
)
from media_summarizer.core.models.processing_job import JobStatus
from media_summarizer.core.models.user_media import ReviewBlurb, UserMediaStatus
from media_summarizer.core.services.media_identity import is_account_scoped_media_key
from media_summarizer.core.services.transcript_translation import (
    detect_language,
    job_source_language_hint,
    normalize_language_tag,
    persist_detected_language,
)
from media_summarizer.utils import media_artifacts, s3, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

ARTIFACT_GENERATION_ENABLED = os.environ.get(
    "ARTIFACT_GENERATION_ENABLED", "true"
).lower() == "true"
TRANSCRIPT_BUCKET = required_env("TRANSCRIPT_BUCKET")
SUMMARY_BUCKET = required_env("SUMMARY_BUCKET")
SUMMARY_SHORT_BUCKET = required_env("SUMMARY_SHORT_BUCKET")
SUMMARY_DETAILED_BUCKET = required_env("SUMMARY_DETAILED_BUCKET")
QUIZ_BUCKET = required_env("QUIZ_BUCKET")
NOTES_BUCKET = required_env("NOTES_BUCKET")
FLASHCARDS_BUCKET = required_env("FLASHCARDS_BUCKET")
REVIEW_BLURB_BUCKET = required_env("REVIEW_BLURB_BUCKET")
ARTIFACT_GENERATOR_QUEUE = required_env("ARTIFACT_GENERATOR_QUEUE")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-nano-2026-03-17")
# LLM models per artifact type — validated by owner in task-72 benchmark:
# summary_short: gpt-5-nano-2025-08-07
# all other artifacts: gpt-5.4-nano-2026-03-17
SUMMARY_SHORT_MODEL = os.environ.get("SUMMARY_SHORT_LLM_MODEL", "gpt-5-nano-2025-08-07")
SUMMARY_DETAILED_MODEL = os.environ.get("SUMMARY_DETAILED_LLM_MODEL", OPENAI_MODEL)
NOTES_MODEL = os.environ.get("NOTES_LLM_MODEL", OPENAI_MODEL)
FLASHCARDS_MODEL = os.environ.get("FLASHCARDS_LLM_MODEL", OPENAI_MODEL)

# The two ceilings a request must fit under. Both derive from the model's input
# window, not from pricing, which is why they are code constants and stay out of
# `pricing_config`: no tier can buy 50 sources into a 272k-token context.
# 25 sources at the measured median (4 622 tokens) is 42.7% of the window; the
# token ceiling is the guard that catches a folder of unusually long sources.
MAX_FOLDER_SOURCES = 25
MAX_FOLDER_CORPUS_TOKENS = 120_000
# `tiktoken` is not in the Lambda image, so the corpus is measured in UTF-8 bytes
# and converted. ±10%, which the 2.3x margin to the model's window absorbs.
BYTES_PER_TOKEN = 3.4

# Matches the artifact_generator Lambda's 300 s timeout, so a worker killed
# mid-generation leaves an entry another invocation can reclaim.
GENERATION_LEASE_SECONDS = 300

# How long a request may sit waiting for its sources to become readable before it
# becomes a `failed` entry (task-360). One hour is far above the whole pipeline
# under load — a long podcast's extraction and transcription — so reaching it
# means the preparation is stuck, not slow. Bounding it is the point: an unbounded
# wait is a spinner nobody ends, which is what the refusal it replaces at least
# avoided.
AWAITING_SOURCES_TIMEOUT_SECONDS = int(
    os.environ.get("ARTIFACT_AWAITING_TIMEOUT_SECONDS", "3600")
)

# How long an *internal* entry may stay in flight before a read stops calling it
# pending (task-391). It is the age bound the other two mechanisms leave out: a
# waiting entry is bounded by `awaiting_expires_at`, a claimed one by its lease —
# but an internal type is triggered by a backend hook that gives up after a single
# attempt, so a `queued` entry whose SQS message was lost, or a `generating` one
# whose lease expired with no redelivery left, is revisited by nobody. The media
# contract then answers "the preview is being written" for ever.
#
# 30 minutes is six generation leases (`GENERATION_LEASE_SECONDS`), so a generation
# that is merely slow, or being retried by SQS, is never mistaken for a dead one.
INTERNAL_GENERATION_STALL_SECONDS = int(
    os.environ.get("ARTIFACT_INTERNAL_STALL_SECONDS", "1800")
)

REQUESTABLE_ARTIFACT_TYPES = {
    MediaArtifactType.SUMMARY_SHORT,
    MediaArtifactType.SUMMARY_DETAILED,
    MediaArtifactType.QUIZ,
    MediaArtifactType.NOTES,
    MediaArtifactType.FLASHCARDS,
}

# Types nobody can ask for. They are generated by a backend trigger only, live on
# ``ArtifactScope.MEDIA`` only, cost no quota (nothing was requested), and are
# filtered out of ``list_scope_artifacts`` — the history is the list of what the
# user asked for, and an internal artifact was never asked for. Keeping them out of
# ``REQUESTABLE_ARTIFACT_TYPES`` rather than adding a flag is what makes every
# user-facing surface exclude them by default instead of by remembering to.
INTERNAL_ARTIFACT_TYPES = {
    MediaArtifactType.REVIEW_BLURB,
}

# What the pipeline can actually produce: the union of the two sets above, i.e.
# what has a generator registered. ``plan_artifact_generation`` gates on this, while
# ``ArtifactCreateRequest`` rejects ``INTERNAL_ARTIFACT_TYPES`` outright — a request
# is refused before the quota is even looked at.
GENERATABLE_ARTIFACT_TYPES = REQUESTABLE_ARTIFACT_TYPES | INTERNAL_ARTIFACT_TYPES


# Why a source is in the snapshot without having been read. Recorded rather than
# dropped: the snapshot is what makes an artifact interpretable, and "13 of 15
# sources" needs the two missing ones to say what happened to them.
#: No transcript, and none is coming: the ingestion failed, was cancelled, or
#: finished without producing readable text. Deliberately not the same fact as a
#: transcription still running — that one is a wait, and conflating the two is
#: what used to answer "nothing to generate" while the pipeline was working
#: (task-360).
EXCLUDED_REASON_TRANSCRIPT_UNAVAILABLE = "transcript_unavailable"

# The one preparation a request can be waiting on, recorded on the snapshot line
# of the source it is waiting for. It decides nothing in the code, but it is what
# makes a waiting entry readable in the table and in a log. There is no longer a
# `translation` preparation: an artifact is generated from the *original*
# transcript and its output language is carried by the prompt (task-398), so
# nothing about a generation waits on a translation any more.
PREPARATION_TRANSCRIPTION = "transcription"

# Pipeline stages that mean "the text is coming". Compared by value, never by
# membership of the enum: ``JobStatus`` mixes in ``str`` but keeps ``Enum``'s
# identity hash, so ``JobStatus.PENDING in {"pending"}`` is False.
_JOB_STATUSES_IN_PREPARATION = frozenset(
    {
        JobStatus.PENDING.value,
        JobStatus.EXTRACTING.value,
        JobStatus.TRANSCRIBING.value,
        JobStatus.SUMMARIZING.value,
    }
)
#: Same question asked of the library row, for the window where no job answers for
#: the content yet (the ledger is written before the job, and a job is allowed to
#: expire while the library row stays).
_LIBRARY_STATUSES_IN_PREPARATION = frozenset(
    {UserMediaStatus.PENDING.value, UserMediaStatus.PROCESSING.value}
)

#: ``error_code`` of an entry whose wait was ended rather than served. All three
#: are terminal and actionable: the tile shows the failed state task-328 defined,
#: and asking again starts a fresh generation over whatever is readable by then.
ERROR_CODE_PREPARATION_TIMEOUT = "sources_preparation_timeout"
ERROR_CODE_PREPARATION_FAILED = "sources_preparation_failed"
ERROR_CODE_SOURCES_CHANGED = "sources_changed"

#: ``error_code`` of an entry that was really enqueued and never reported back.
#: Terminal like the three above, and reclaimable: the next trigger for the same
#: key generates again instead of being answered by the corpse.
ERROR_CODE_GENERATION_STALLED = "generation_stalled"

#: The two non-terminal statuses. Grouped because every age bound has to treat them
#: alike: a request nobody will serve is as stuck queued as it is generating.
_IN_FLIGHT_ARTIFACT_STATUSES = (
    MediaArtifactStatus.QUEUED,
    MediaArtifactStatus.GENERATING,
)


class ArtifactServiceError(Exception):
    pass


class ArtifactGenerationDisabledError(ArtifactServiceError):
    pass


class ArtifactTypeNotEnabledError(ArtifactServiceError):
    pass


class ArtifactTranscriptNotReadyError(ArtifactServiceError):
    """At least one source is still being transcribed.

    **Never reaches a user request** since task-360: a requested generation is
    deferred into a waiting entry instead of refused. What is left is the internal
    path — ``review_blurb_service`` and ``digest_service`` generate from a backend
    trigger, have no tile to spin and no one to notify, so for them "not ready" is
    "give up for this run" and they catch this. Nothing was written when it is
    raised, so the history stays free of stillborn entries.
    """

    def __init__(
        self,
        message: str,
        *,
        pending_titles: Optional[List[str]] = None,
        pending_count: int = 0,
    ) -> None:
        super().__init__(message)
        self.pending_titles = pending_titles or []
        self.pending_count = pending_count or len(self.pending_titles)


class ArtifactScopeEmptyError(ArtifactServiceError):
    """The scope holds no usable source at all."""


class ArtifactScopeTooLargeError(ArtifactServiceError):
    """The scope exceeds a ceiling. Carries the four numbers the UI displays."""

    def __init__(
        self,
        message: str,
        *,
        source_count: int,
        max_sources: int,
        estimated_tokens: int,
        max_tokens: int,
    ) -> None:
        super().__init__(message)
        self.source_count = source_count
        self.max_sources = max_sources
        self.estimated_tokens = estimated_tokens
        self.max_tokens = max_tokens


class ArtifactNotFoundError(ArtifactServiceError):
    pass


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _artifact_type(value: Any) -> MediaArtifactType:
    if isinstance(value, MediaArtifactType):
        return value
    return MediaArtifactType(str(value))


def _artifact_scope(value: Any) -> ArtifactScope:
    if isinstance(value, ArtifactScope):
        return value
    return ArtifactScope(str(value))


def normalize_artifact_parameters(value: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """The canonical form of a request's parameters, on the way in *and* back out.

    Idempotent, and total over what DynamoDB hands back: a number stored here
    returns as a ``Decimal``, which ``_stable_json`` cannot serialise. Converting it
    is what lets a deferred request recompute its own id from the stored entry and
    land on the same hash (task-360).
    """

    def _normalize(node: Any) -> Any:
        if isinstance(node, dict):
            return {str(key): _normalize(node[key]) for key in sorted(node)}
        if isinstance(node, list):
            return [_normalize(item) for item in node]
        if isinstance(node, Decimal):
            as_int = int(node)
            return as_int if node == as_int else float(node)
        return node

    return _normalize(value or {})


def _stable_json(value: Dict[str, Any]) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def get_generator_version(artifact_type: MediaArtifactType) -> str:
    versions = {
        MediaArtifactType.SUMMARY_SHORT: os.environ.get(
            "SUMMARY_SHORT_ARTIFACT_GENERATOR_VERSION",
            f"summary_short:{SUMMARY_SHORT_MODEL}:prompt-v4",
        ),
        MediaArtifactType.SUMMARY_DETAILED: os.environ.get(
            "SUMMARY_DETAILED_ARTIFACT_GENERATOR_VERSION",
            f"summary_detailed:{SUMMARY_DETAILED_MODEL}:prompt-v4",
        ),
        MediaArtifactType.QUIZ: os.environ.get(
            "QUIZ_ARTIFACT_GENERATOR_VERSION",
            f"quiz:{OPENAI_MODEL}:prompt-v4",
        ),
        MediaArtifactType.NOTES: os.environ.get(
            "NOTES_ARTIFACT_GENERATOR_VERSION",
            f"notes:{NOTES_MODEL}:prompt-v4",
        ),
        MediaArtifactType.FLASHCARDS: os.environ.get(
            "FLASHCARDS_ARTIFACT_GENERATOR_VERSION",
            f"flashcards:{FLASHCARDS_MODEL}:prompt-v4",
        ),
        # v3: v1's prose paragraph was unreadable on the triage card, and v2's
        # structured card asked for bullets of up to 110 characters when the card
        # can show ~65 -- half of them came back clipped mid-word. v3 states the
        # lengths the card can actually render and drops the audience line, which
        # the owner found told them nothing the hook did not. Note that a bump
        # regenerates nothing on its own: `build_artifact_id` deliberately excludes
        # the generator version, so old blurbs have to be purged explicitly.
        MediaArtifactType.REVIEW_BLURB: os.environ.get(
            "REVIEW_BLURB_ARTIFACT_GENERATOR_VERSION",
            f"review_blurb:{OPENAI_MODEL}:prompt-v3",
        ),
    }
    return versions[artifact_type]


def get_artifact_bucket(artifact_type: MediaArtifactType) -> str:
    buckets = {
        MediaArtifactType.SUMMARY_SHORT: SUMMARY_SHORT_BUCKET,
        MediaArtifactType.SUMMARY_DETAILED: SUMMARY_DETAILED_BUCKET,
        MediaArtifactType.QUIZ: QUIZ_BUCKET,
        MediaArtifactType.NOTES: NOTES_BUCKET,
        MediaArtifactType.FLASHCARDS: FLASHCARDS_BUCKET,
        MediaArtifactType.REVIEW_BLURB: REVIEW_BLURB_BUCKET,
    }
    return buckets[artifact_type]


def get_artifact_queue(artifact_type: MediaArtifactType) -> str:
    """Return the SQS queue name for artifact generation.

    All artifact types route to the unified artifact-generator-queue (task-195).
    """
    return ARTIFACT_GENERATOR_QUEUE


def build_artifact_storage_key(
    *,
    artifact_id: str,
    artifact_type: MediaArtifactType,
) -> str:
    return f"{artifact_type.value}/{artifact_id}.json"


def _allowed_artifact_types() -> set[MediaArtifactType]:
    raw = os.environ.get("ARTIFACT_TYPES_ALLOWED", DEFAULT_ARTIFACT_TYPES_ALLOWED)
    allowed = set()
    for chunk in raw.split(","):
        value = chunk.strip()
        if not value:
            continue
        try:
            allowed.add(MediaArtifactType(value))
        except ValueError:
            logger.warning("Ignoring unknown artifact type in ARTIFACT_TYPES_ALLOWED: %s", value)
    return allowed or set(GENERATABLE_ARTIFACT_TYPES)


def estimate_tokens(byte_length: int) -> int:
    return int(byte_length / BYTES_PER_TOKEN)


def build_artifact_id(
    *,
    user_id: str,
    scope: ArtifactScope,
    scope_id: str,
    artifact_type: MediaArtifactType,
    parameters: Dict[str, Any],
    source_media_item_ids: List[str],
) -> str:
    """Deterministic id of **one account's entry** — the whole of the reuse mechanism.

    The key is *what this user asked for*: owner, scope, artifact type, parameters,
    and the sorted set of sources behind it. Two requests from the same account
    collide exactly when its existing entry already answers the second one, and that
    collision is what makes reuse a single ``GetItem``.

    Deliberately *not* in the hash:

    - **Time.** There is no window and no expiry. The same request an hour or a
      month later resolves to the same id, which is what "generate once per media"
      means concretely.
    - **``generator_version``.** It is recorded on the entry for traceability, but
      keying on it would hand out one fresh generation per prompt bump — the exact
      thing the owner's decision rules out. The corollary is deliberate: bumping a
      prompt does **not** invalidate anything already generated.

    ``parameters`` carries the reading language, so two reading languages are two
    different ids and therefore two legitimate entries. The decision is about
    regenerating, not about translating.

    ``user_id`` stays in it, and stays first: this id is what the account's own
    listing and detail routes address, so it must be unguessable from another
    account's request. What is *generated* is keyed without it — see
    :func:`build_shared_artifact_id`.
    """
    material = "|".join(
        [
            user_id,
            scope.value,
            scope_id,
            artifact_type.value,
            _stable_json(parameters),
            ",".join(sorted(source_media_item_ids)),
        ]
    )
    return f"art_{_sha256_text(material)[:32]}"


def build_shared_artifact_id(
    *,
    scope: ArtifactScope,
    scope_id: str,
    artifact_type: MediaArtifactType,
    parameters: Dict[str, Any],
    source_media_item_ids: List[str],
) -> str:
    """Deterministic id of **the generation itself** — the same material minus the owner.

    Two accounts asking for the same type, in the same language, over the same
    content land on this one id, which is what makes the second request cost no
    provider call (task-394). Nothing else about the material changes, so the
    properties of :func:`build_artifact_id` carry over unchanged: no time, no
    ``generator_version``, and the language still part of the key.

    The ``shared_`` prefix has no code behind it and is not parsed anywhere. It is
    there so a row in the table can be told apart from an account's entry by looking
    at it, which is what a purge or an incident investigation actually does.
    """
    material = "|".join(
        [
            scope.value,
            scope_id,
            artifact_type.value,
            _stable_json(parameters),
            ",".join(sorted(source_media_item_ids)),
        ]
    )
    return f"shared_{_sha256_text(material)[:32]}"


def mutualizes_generation(
    *,
    scope: ArtifactScope,
    content_scope_id: str,
    user_id: str,
) -> bool:
    """Whether this request's generation is shared between accounts.

    Media scope only — a folder's scope id is a folder id, which belongs to one
    account and means nothing to another — and only over content whose identity is
    not itself account-scoped, i.e. never over a file a user uploaded.

    The upload exclusion is enforced twice over, which is why it cannot be worked
    around from here: this returns False, *and* an upload's content id carries the
    account (:func:`is_account_scoped_media_key`) so the same file sent by two people
    is two content ids with two unrelated shared ids. What this test buys is the
    absence of a pointer indirection nothing could ever share.
    """
    return scope == ArtifactScope.MEDIA and not is_account_scoped_media_key(
        media_key=content_scope_id, owner_user_id=user_id
    )


# ---------------------------------------------------------------------------
# Scope resolution
# ---------------------------------------------------------------------------


class ResolvedSource:
    """One source ready to enter the corpus, with the bytes already measured."""

    def __init__(
        self,
        *,
        media_item_id: str,
        content_id: str,
        title: Optional[str],
        transcript_s3_key: str,
        language: Optional[str],
        byte_length: int,
        published: Optional[str] = None,
        captured: Optional[str] = None,
        description: Optional[str] = None,
    ) -> None:
        self.media_item_id = media_item_id
        self.content_id = content_id
        self.title = title
        #: The **original** transcript, always: an artifact is generated from the
        #: text as it was transcribed and the reading language is carried by the
        #: prompt (task-398).
        self.transcript_s3_key = transcript_s3_key
        #: The language this source is *written in*, detected locally. It goes in
        #: the corpus header so the model knows what it is reading; it is never the
        #: language the artifact comes out in, which is ``parameters["language"]``.
        self.language = language
        #: Transcript bytes **plus** description bytes: what the model is actually
        #: sent, which is what ``MAX_FOLDER_CORPUS_TOKENS`` has to measure. A
        #: description in the prompt but out of the count would make the ceiling
        #: report on something other than the request it guards.
        self.byte_length = byte_length
        #: The presentation text the author wrote next to the media — an Instagram
        #: caption, a TikTok caption, a YouTube description. Its own corpus block,
        #: never folded into the transcript: the transcript is shown verbatim in
        #: the reader tab and the prompt tells the model it is transcribed speech
        #: (task-383). None for every source whose platform has no such field.
        self.description = description
        #: ``YYYY-MM-DD`` publication date, when the pipeline resolved a real one.
        #: Only the podcast path does today, so it is usually None.
        self.published = published
        #: ``YYYY-MM-DD`` day the text entered the library. Always known, and the
        #: date a scraped bulletin's "today" actually refers to. Both go in the
        #: corpus header so the model can anchor point-in-time facts instead of
        #: freezing "today" into a permanent artifact (task-316 §2.7).
        self.captured = captured

    def snapshot(self) -> ArtifactSource:
        return ArtifactSource(
            media_item_id=self.media_item_id,
            title=self.title,
            transcript_s3_key=self.transcript_s3_key,
            language=self.language,
        )


class PendingSource:
    """One source whose transcript is coming but is not there yet.

    Carries the same two ids as a resolved source, because both are needed and for
    different things: ``content_id`` (the deduplicated ``media_key``) enters the
    ``artifact_id`` hash, so a waiting entry keys on the sources it *expects*;
    ``media_item_id`` is the library row a completion event resolves to, so a
    waiting entry can be matched against the media that just became readable.
    """

    def __init__(
        self,
        *,
        media_item_id: str,
        content_id: str,
        title: Optional[str],
        preparation: str,
    ) -> None:
        self.media_item_id = media_item_id
        self.content_id = content_id
        self.title = title
        self.preparation = preparation

    def snapshot(self) -> ArtifactSource:
        return ArtifactSource(
            media_item_id=self.media_item_id,
            title=self.title,
            preparation=self.preparation,
        )


class ScopeResolution:
    """What a scope resolved to: usable sources, exclusions, and the volume.

    ``pending`` is the third outcome and the whole of task-360: a source being
    transcribed is neither readable nor lost, so the request is honoured over a
    source set that includes it and starts once it lands. It used to abort the
    request with a refusal the user had to come back and retry.
    """

    def __init__(
        self,
        *,
        sources: List[ResolvedSource],
        excluded: List[ArtifactSource],
        pending: List[PendingSource],
        output_language: Optional[str],
    ) -> None:
        self.sources = sources
        self.excluded = excluded
        self.pending = pending
        #: The language the artifact must be **written** in — the requester's
        #: reading language, normalized. It reaches the model through
        #: ``parameters["language"]`` and ``corpus.language_instruction``; no
        #: source text is ever translated for it (task-398).
        self.output_language = output_language

    @property
    def estimated_tokens(self) -> int:
        return estimate_tokens(sum(source.byte_length for source in self.sources))

    @property
    def is_awaiting(self) -> bool:
        """True when at least one source's text is still being prepared."""
        return bool(self.pending)

    @property
    def expected_source_ids(self) -> List[str]:
        """The content ids the finished artifact will cover: read *and* awaited.

        This is what ``artifact_id`` is keyed on, which is what makes a deferred
        request and the generation that follows one single entry: the id computed
        while a source is still being transcribed is the id the completed
        resolution computes once it is readable.
        """
        return [source.content_id for source in self.sources] + [
            source.content_id for source in self.pending
        ]

    def snapshot(self) -> List[ArtifactSource]:
        """The immutable snapshot: what was read, what is awaited, what was skipped."""
        return (
            [source.snapshot() for source in self.sources]
            + [source.snapshot() for source in self.pending]
            + self.excluded
        )


async def _load_transcript_bytes(job: ProcessingJob) -> Tuple[str, bytes]:
    transcript_s3_key = (getattr(job, "transcription_s3_key", None) or "").strip()
    if not transcript_s3_key:
        raise ArtifactTranscriptNotReadyError(
            "Transcript is not available for this media item."
        )

    transcript_bytes = await s3.download_file_to_memory(
        bucket=TRANSCRIPT_BUCKET,
        key=transcript_s3_key,
    )
    if not transcript_bytes or not transcript_bytes.strip():
        raise ArtifactTranscriptNotReadyError(
            "Transcript is empty or unavailable for this media item."
        )
    return transcript_s3_key, transcript_bytes


def _iso_date(value: Any) -> Optional[str]:
    """``YYYY-MM-DD`` from a datetime or a Unix timestamp, or None.

    Only the date survives: the corpus header exists to let the model anchor a
    point-in-time fact to a day, and an hour would be noise the model has to read
    on every source.
    """
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, (int, float)) and value > 0:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).date().isoformat()
    return None


async def resolve_source(
    *,
    job: ProcessingJob,
    media_item_id: str,
    content_id: str,
    title: Optional[str],
    captured: Optional[str] = None,
) -> ResolvedSource:
    """Resolve one source to the exact text the model will read: its transcript.

    The **original** transcript, always — no translation is resolved, reserved or
    waited on here (task-398). Asking for an artifact used to send this function
    into the translation pipeline, which enqueued a full transcript translation and
    made the request wait 60-90 s for it before generating, while the prompt
    imposed the output language a second time through
    ``corpus.language_instruction``. The reading language is carried by
    ``parameters["language"]`` alone, so a media in any language generates
    immediately.

    The language is still detected — locally, from a source tag when the platform
    gave one, so no LLM call and no cost — because the corpus header states what
    each source is written in and the job keeps the answer for the reader path.

    ``captured`` comes from the caller because it lives on the durable library row
    while the publication date lives on the job, and the job is what this function
    already holds. The author's description comes off that same job, through the
    one reader that knows every platform's spelling (task-383).
    """
    transcript_s3_key, transcript_bytes = await _load_transcript_bytes(job)
    detected_language, _ = detect_language(
        transcript_bytes.decode("utf-8", errors="ignore"),
        source_hint=job_source_language_hint(job),
    )
    await persist_detected_language(job, detected_language)

    # Never truncated: a cut would sever a sentence, and the corpus ceiling is the
    # right place to refuse a volume that grew too big (task-383).
    description = job_source_description(job)
    description_bytes = len(description.encode("utf-8")) if description else 0
    return ResolvedSource(
        media_item_id=media_item_id,
        content_id=content_id,
        title=title,
        transcript_s3_key=transcript_s3_key,
        language=detected_language,
        byte_length=len(transcript_bytes) + description_bytes,
        published=_iso_date(getattr(job, "media_date_published", None)),
        captured=captured,
        description=description,
    )


def _is_still_being_ingested(record: Any, job: Optional[ProcessingJob]) -> bool:
    """Whether this media's text is on its way, as opposed to never coming.

    The distinction ``EXCLUDED_REASON_TRANSCRIPT_UNAVAILABLE`` used to swallow.
    The job is the precise answer when there is one; the library row's own coarse
    status covers the window where no job answers for the content — the durable
    row is written before the job, and a job is allowed to expire under a row that
    stays.
    """
    if job is not None:
        job_status = getattr(job, "status", None)
        return str(getattr(job_status, "value", job_status) or "") in (
            _JOB_STATUSES_IN_PREPARATION
        )
    library_status = getattr(record, "processing_status", None)
    return str(getattr(library_status, "value", library_status) or "") in (
        _LIBRARY_STATUSES_IN_PREPARATION
    )


async def resolve_scope_sources(
    *,
    user_id: str,
    scope: ArtifactScope,
    scope_id: str,
    reading_language: Optional[str],
) -> ScopeResolution:
    """List a scope's sources and resolve each one's effective transcript.

    For a folder the scope covers the folder **and every descendant**, matching
    ``GET /api/media?folder_id=`` and therefore the Sources tab the user is
    looking at: generating over a strict subset of what that tab shows would
    produce a ``source_count`` that contradicts the screen.

    Each source lands in exactly one of three places, and the three are never
    conflated (task-360):

    - **read** — its transcript exists and was measured;
    - **pending** — its text is coming: the ingestion is still running. The
      request is honoured over it and waits;
    - **excluded** — its text will never come: the ingestion failed or produced
      nothing readable. Recorded in the snapshot rather than dropped, so one
      broken media cannot lock a folder out and the artifact stays honest about
      what it could not read.

    A source's own language is never a reason to wait: every transcript is read
    as it was transcribed and the output language travels in the prompt
    (task-398), so a freshly ingested foreign media resolves as *read* on the
    first request.

    ``output_language`` is derived from the *reading language*, never from a
    source that happened to resolve. That is what makes it knowable before any
    source is readable, hence what makes a waiting entry's ``artifact_id`` equal
    to the one the finished resolution computes.
    """
    from media_summarizer.core.services.durable_media_service import resolve_job_for_record

    records = await _list_scope_media_records(
        user_id=user_id, scope=scope, scope_id=scope_id
    )

    resolved: List[ResolvedSource] = []
    excluded: List[ArtifactSource] = []
    pending: List[PendingSource] = []

    async def resolve_one(record: Any) -> Any:
        media_item_id = getattr(record, "media_item_id", None) or getattr(record, "id", "")
        content_id = getattr(record, "media_key", None) or media_item_id
        title = getattr(record, "title", None)

        def _pending(preparation: str) -> PendingSource:
            return PendingSource(
                media_item_id=media_item_id,
                content_id=content_id,
                title=title,
                preparation=preparation,
            )

        def _excluded(reason: str) -> ArtifactSource:
            return ArtifactSource(
                media_item_id=media_item_id,
                title=title,
                excluded=True,
                excluded_reason=reason,
            )

        job = await resolve_job_for_record(record)
        if job is None:
            if _is_still_being_ingested(record, job):
                return _pending(PREPARATION_TRANSCRIPTION)
            return _excluded(EXCLUDED_REASON_TRANSCRIPT_UNAVAILABLE)
        try:
            return await resolve_source(
                job=job,
                media_item_id=media_item_id,
                content_id=content_id,
                title=title,
                captured=_iso_date(getattr(record, "saved_at", None)),
            )
        except ArtifactTranscriptNotReadyError:
            # No transcript behind the job yet. Whether that is a wait or a dead
            # end is the job's own status, never the absence of the file.
            if _is_still_being_ingested(record, job):
                return _pending(PREPARATION_TRANSCRIPTION)
            return _excluded(EXCLUDED_REASON_TRANSCRIPT_UNAVAILABLE)

    # In parallel: the API Lambda has a 30 s budget and 25 sources are ~400 kB of
    # S3 reads. Language detection is local, so nothing here calls an LLM.
    outcomes = await asyncio.gather(*(resolve_one(record) for record in records))

    for outcome in outcomes:
        if isinstance(outcome, PendingSource):
            pending.append(outcome)
        elif isinstance(outcome, ArtifactSource):
            excluded.append(outcome)
        else:
            resolved.append(outcome)

    return ScopeResolution(
        sources=resolved,
        excluded=excluded,
        pending=pending,
        output_language=normalize_language_tag(reading_language),
    )


async def _list_scope_media_records(
    *,
    user_id: str,
    scope: ArtifactScope,
    scope_id: str,
) -> List[Any]:
    from media_summarizer.core.services.folder_service import _get_descendant_ids
    from media_summarizer.utils import database_async
    from media_summarizer.utils import user_media as user_media_store

    if scope == ArtifactScope.MEDIA:
        record = await user_media_store.get_user_media(user_id, scope_id)
        return [record] if record is not None else []

    all_folders = await database_async.get_folders_by_user_id(user_id)
    folder_ids = [scope_id, *_get_descendant_ids(scope_id, all_folders)]

    seen: Dict[str, Any] = {}
    pages = await asyncio.gather(
        *(user_media_store.list_for_folder(user_id, folder_id) for folder_id in folder_ids)
    )
    for page in pages:
        for record in page:
            # Several saves may point at one content item. A folder reads
            # that transcript once, regardless of how many rows reference it.
            seen.setdefault(record.media_key, record)
    return list(seen.values())


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def list_scope_artifacts(
    *,
    user_id: str,
    scope: ArtifactScope,
    scope_id: str,
    content_scope_id: Optional[str] = None,
    limit: Optional[int] = None,
    cursor: Optional[str] = None,
) -> Tuple[List[MediaArtifactRecord], Optional[str]]:
    """Every *requestable* entry of a scope, newest first, all types mixed.

    This single response is what replaced ``artifact_statuses``: it carries the
    history *and* the in-flight entries (``queued`` / ``generating``), so the
    mobile polls one endpoint per scope instead of one per artifact type.

    Internal types are dropped: the history is the list of what the user asked
    for, and the mobile row falls back to the raw ``artifact_type`` string when it
    does not know a type — leaking ``review_blurb`` here would render a row
    literally labelled "review_blurb" next to the five real ones.

    The filter runs on the page, not in the query, so a page may come back shorter
    than ``limit`` while still handing out a cursor. The mobile already treats
    ``limit`` as a ceiling and paginates on the cursor, and at one internal entry
    per media the difference is at most one row per page.

    It is also where an in-flight entry is brought up to date, which covers two
    things a projected row cannot say on its own: a wait that ran out is ended
    (task-360), and a pointer whose shared generation has finished is mirrored
    (task-394). Doing both on read is what makes them felt at the only moment they
    matter — someone is looking at the tile — instead of at the next nightly pass.
    """
    records, next_cursor = await media_artifacts.list_artifacts_by_scope(
        scope_key=build_scope_key(
            user_id=user_id,
            scope=scope,
            scope_id=content_scope_id or scope_id,
        ),
        limit=limit,
        cursor=cursor,
    )
    visible = [
        record
        for record in records
        if record.artifact_type not in INTERNAL_ARTIFACT_TYPES
    ]
    # In parallel: a scope holds at most one in-flight entry per type, and the
    # terminal ones cost nothing here.
    return list(
        await asyncio.gather(*(refresh_listed_artifact(record) for record in visible))
    ), next_cursor


async def refresh_listed_artifact(
    listed: MediaArtifactRecord,
) -> MediaArtifactRecord:
    """Bring one listed entry up to date, or hand it back untouched.

    A terminal entry is already the whole truth and costs no read at all, which is
    what keeps a history page at one DynamoDB query. An in-flight one is not: the
    ``scope-index`` projection carries neither ``awaiting_expires_at`` nor
    ``shared_artifact_id``, so the two things that can have happened since — its wait
    expired, or the generation it points at finished — are only readable on the base
    row. That read is the price of the poll, and it is bounded: at most one in-flight
    entry per artifact type per scope.

    Never fatal: a listing that cannot refresh an entry still shows the history.
    """
    if listed.status not in _IN_FLIGHT_ARTIFACT_STATUSES:
        return listed

    try:
        record = await media_artifacts.get_media_artifact_by_id(listed.artifact_id)
        if record is None:
            return listed
        ended = await _end_overdue_wait(record)
        if ended is not None:
            return ended
        return await resolve_through_shared_generation(record)
    except Exception as exc:  # noqa: BLE001 - a listing must still answer
        logger.warning(
            "Could not refresh the listed artifact %s: %s", listed.artifact_id, exc
        )
        return listed


async def _end_overdue_wait(
    record: MediaArtifactRecord,
) -> Optional[MediaArtifactRecord]:
    """Fail an entry whose wait for its sources ran out. ``None`` when it had not.

    The wait lives on the account's own entry — its deadline, and the ``preparation``
    lines of its snapshot — never on a shared generation, which is only ever armed
    once every source is readable.
    """
    now = _now_utc()
    if not _is_awaiting_overdue(record, now=now):
        return None
    if not await media_artifacts.fail_awaiting_artifact(
        artifact_id=record.artifact_id,
        error_code=ERROR_CODE_PREPARATION_TIMEOUT,
        error_message=(
            "The sources of this generation were still being prepared "
            "when the request expired."
        ),
    ):
        return None
    log_event(
        logger,
        logging.WARNING,
        "artifact.wait_expired",
        "Artifact wait ended: its sources were still not readable",
        artifact_id=record.artifact_id,
        artifact_type=record.artifact_type.value,
        timeout_seconds=AWAITING_SOURCES_TIMEOUT_SECONDS,
    )
    return record.model_copy(
        update={
            "status": MediaArtifactStatus.FAILED,
            "error_code": ERROR_CODE_PREPARATION_TIMEOUT,
            "awaiting_expires_at": None,
            "completed_at": now,
            "updated_at": now,
        }
    )


async def resolve_through_shared_generation(
    pointer: MediaArtifactRecord,
) -> MediaArtifactRecord:
    """The state an account's entry is really in, read off the generation it points at.

    A pointer holds no generation of its own (task-394): the status, the storage ref,
    the title and the source snapshot all belong to the shared row. While that row is
    in flight the answer is computed and not stored — the account's entry is
    ``generating`` because the generation is. Once it is terminal the answer is
    *written through* onto the pointer, which is what makes every later read of it
    free again and what lets the content route serve the object with no second hop.

    The write-through is conditional on the pointer still being in flight, so a
    request that reclaimed it in the meantime is never overwritten by a verdict
    prepared before the reclaim.

    Three kinds of record are returned untouched, and each for its own reason: a
    **terminal** one is already the mirror (or a wait this account's row ended on its
    own), so it costs no read; one still **awaiting its sources** has no generation to
    resolve yet, since nothing is armed until the last source is readable (task-360);
    and one with no ``shared_artifact_id`` at all *is* its own generation — every
    folder artifact, and every artifact over a user-uploaded file.
    """
    if pointer.status not in _IN_FLIGHT_ARTIFACT_STATUSES:
        return pointer
    if pointer.awaiting_expires_at is not None:
        return pointer
    shared_id = pointer.shared_artifact_id
    if not shared_id:
        return pointer

    shared = await media_artifacts.get_media_artifact_by_id(shared_id)
    if shared is None:
        # The generation row is gone (a purge, or a manual deletion) while the
        # pointer remains. Nothing is running, so the entry is terminal — said here
        # rather than written, since the pointer has no artifact to hand out either
        # way and a request for the same type will arm a fresh generation.
        return pointer.model_copy(
            update={
                "status": MediaArtifactStatus.FAILED,
                "error_code": ERROR_CODE_GENERATION_STALLED,
            }
        )
    if shared.status in _IN_FLIGHT_ARTIFACT_STATUSES:
        return pointer.model_copy(update={"status": shared.status})

    mirrored = _mirror_of_shared_generation(pointer=pointer, shared=shared)
    await media_artifacts.mirror_shared_artifact(mirrored)
    return mirrored


def _mirror_of_shared_generation(
    *,
    pointer: MediaArtifactRecord,
    shared: MediaArtifactRecord,
) -> MediaArtifactRecord:
    """The pointer as it looks once its shared generation is terminal.

    Everything the generation produced is copied — including ``storage``, so the
    account reads the one object that was generated, and ``sources``, so its snapshot
    names the exact text the model saw rather than the preparation it was waiting on.

    Two things are deliberately not copied. ``llm_usage`` stays on the generation: it
    is what the provider was actually paid once, and duplicating it onto every
    pointer would make any sum over the table count the same euros twice.
    ``created_at`` stays the account's own, since it is the history's sort key and
    the entry belongs where the account asked for it.
    """
    return pointer.model_copy(
        update={
            "status": shared.status,
            "storage": shared.storage,
            "title": shared.title or pointer.title,
            "source_count": shared.source_count,
            "sources": shared.sources,
            "generator_version": shared.generator_version,
            "error_code": shared.error_code,
            "error_message": shared.error_message,
            "completed_at": shared.completed_at,
            "updated_at": _now_utc(),
            "awaiting_expires_at": None,
            "lease_expires_at": None,
        }
    )


async def latest_internal_artifact_status(
    *,
    user_id: str,
    content_scope_id: str,
) -> Optional[MediaArtifactStatus]:
    """Status of the newest internal entry of a media scope, or ``None`` if it has none.

    The counterpart of ``list_scope_artifacts`` and the reason its filter can stay
    exactly as it is: the media detail response needs to know how the internal
    ``review_blurb`` generation went (task-363), and that question is answered here
    instead of by widening what the AI tab is served. Nothing about the history
    listing changes — a row literally labelled "review_blurb" next to the five real
    ones is still what the filter exists to prevent.

    ``content_scope_id`` is the ``media_key``, not the ``media_item_id``: internal
    entries are written under the content identity (see
    ``review_blurb_service.trigger_review_blurb_generation``), so that is the scope
    key they are indexed by.

    Read without a ``limit`` on purpose: a media scope holds at most one entry per
    type, so the whole scope is one query, and a page-bounded read could hand back
    a first page of user artifacts with the internal entry left on the next one.

    It is also where an in-flight entry that stopped moving becomes terminal
    (task-391), the same way ``list_scope_artifacts`` ends an overdue wait: on read,
    at the only moment the answer matters.
    """
    records, _ = await media_artifacts.list_artifacts_by_scope(
        scope_key=build_scope_key(
            user_id=user_id,
            scope=ArtifactScope.MEDIA,
            scope_id=content_scope_id,
        ),
    )
    # Newest first, so the first internal entry seen is the current one.
    for record in records:
        if record.artifact_type in INTERNAL_ARTIFACT_TYPES:
            return await _internal_status(record)
    return None


async def _internal_status(listed: MediaArtifactRecord) -> MediaArtifactStatus:
    """Status of one listed internal entry, resolved and bounded.

    Resolved because the entry the account holds is a pointer and the generation is
    the shared row (task-394); bounded because an internal generation that stopped
    moving must become terminal rather than answer "the preview is being written" for
    ever (task-391). The two are one read path: the row to judge, and to end, is the
    one that actually generates.

    A terminal projected status short-circuits everything, which is what keeps the
    common media read free.

    Never raises: a media detail response must still answer if the entry cannot be
    judged or ended, and it then reports what the index said.
    """
    if listed.status not in _IN_FLIGHT_ARTIFACT_STATUSES:
        return listed.status

    try:
        pointer = await media_artifacts.get_media_artifact_by_id(listed.artifact_id)
        if pointer is None:
            # The row is gone (the purge script deletes them) while the index still
            # lists it. Nothing is generating, so terminal is the honest answer.
            return MediaArtifactStatus.FAILED

        generation = pointer
        if pointer.shared_artifact_id:
            shared = await media_artifacts.get_media_artifact_by_id(
                pointer.shared_artifact_id
            )
            if shared is None:
                return MediaArtifactStatus.FAILED
            generation = shared

        status = await _bounded_internal_status(generation)
        if status not in _IN_FLIGHT_ARTIFACT_STATUSES and generation is not pointer:
            # Write the verdict through onto the pointer, exactly like a user-facing
            # entry: the account's row is what the next read looks at, and what the
            # blurb repair path reads the storage ref off.
            refreshed = await media_artifacts.get_media_artifact_by_id(
                generation.artifact_id
            )
            if refreshed is not None:
                await media_artifacts.mirror_shared_artifact(
                    _mirror_of_shared_generation(pointer=pointer, shared=refreshed)
                )
        return status
    except Exception as exc:  # noqa: BLE001 - a media read must still answer
        logger.warning(
            "Could not resolve internal artifact %s: %s", listed.artifact_id, exc
        )
        return listed.status


async def _bounded_internal_status(
    full: MediaArtifactRecord,
) -> MediaArtifactStatus:
    """The generation's status, with an in-flight one that stopped moving turned terminal.

    The age bound that makes ``pending`` finite (task-391). An internal generation is
    queued by a hook that tries once and gives up, so nothing in the codebase ever
    revisits it: a lost SQS message left it ``queued``, and a worker killed after its
    last redelivery left it ``generating`` with a dead lease. Both used to be
    reported as "the preview is being written" for ever, and a *terminal* answer is
    what the reader needs — the tile settles, and the entry becomes reclaimable, so
    the next trigger for this content generates again instead of reusing a corpse.

    Takes the full row, never a projected one: the judgement is made on ``updated_at``
    and ``lease_expires_at``, and the index projects neither.

    Never raises: a media detail response must still answer if the entry cannot be
    ended, and it then reports what the row said.
    """
    if full.status not in _IN_FLIGHT_ARTIFACT_STATUSES:
        return full.status

    now = _now_utc()
    stale_before = now - timedelta(seconds=INTERNAL_GENERATION_STALL_SECONDS)
    if full.updated_at > stale_before:
        return full.status
    if full.lease_expires_at is not None and full.lease_expires_at > now:
        # A worker holds a live lease: the generation is running, however old the
        # entry looks.
        return full.status

    try:
        ended = await media_artifacts.fail_stalled_artifact(
            artifact_id=full.artifact_id,
            stale_before=stale_before,
            error_code=ERROR_CODE_GENERATION_STALLED,
            error_message=(
                "This generation stopped reporting and its entry was ended."
            ),
        )
        if not ended:
            # Something wrote to the entry between the read and the write: it is
            # alive after all, or already terminal. Either way this read must report
            # what the entry now says rather than the verdict it had prepared.
            refreshed = await media_artifacts.get_media_artifact_by_id(
                full.artifact_id
            )
            return refreshed.status if refreshed is not None else MediaArtifactStatus.FAILED
    except Exception as exc:  # noqa: BLE001 - a media read must still answer
        logger.warning(
            "Could not end the stalled generation of artifact %s: %s",
            full.artifact_id,
            exc,
        )
        return full.status

    log_event(
        logger,
        logging.WARNING,
        "artifact.generation_stalled",
        "Artifact generation ended: it stopped reporting before completing",
        artifact_id=full.artifact_id,
        artifact_type=full.artifact_type.value,
        artifact_status=full.status.value,
        scope_id=full.scope_id,
        stall_seconds=INTERNAL_GENERATION_STALL_SECONDS,
    )
    return MediaArtifactStatus.FAILED


async def get_media_artifact_record(
    artifact_id: str,
) -> Optional[MediaArtifactRecord]:
    """One entry, as the API must see it. The only read behind the two GET routes.

    Two things happen here that a raw table read does not do:

    - a **shared generation** answers ``None``. Its ``user_id`` is the account that
      triggered it, so the ownership comparison in the routes would otherwise let that
      one account address a row that belongs to no account — and read a ``scope_key``
      naming a content id instead of its library row. A shared row is reachable only
      through an entry that points at it (task-394);
    - an entry whose generation has finished is resolved and mirrored, so opening an
      artifact answers with its content even when no listing has refreshed the entry
      yet.
    """
    record = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if record is None or record.is_shared_generation:
        return None
    return await resolve_through_shared_generation(record)


# ---------------------------------------------------------------------------
# Generation request
# ---------------------------------------------------------------------------


class ArtifactGenerationOutcome(str, Enum):
    """What a committed request actually did. Four cases, never conflated.

    ``REUSED`` and ``COLLAPSED`` both mean "no generation was started", but they are
    not the same fact and the caller must be able to tell them apart: one is a
    generation that already covered these sources, the other is the second of two
    taps racing on the same write.

    Since task-394 the outcome no longer decides the debit. A reuse across accounts
    still hands an artifact to an account that did not have one, so it is charged;
    what the mutualization saves is the provider call, and that saving is the
    operator's. Only two things consume nothing: an entry this account already holds,
    and a collapse (the request that won the write is the one charged). The endpoint
    reads that off ``ArtifactGenerationPlan.already_owned`` and off the debit's
    idempotency token, not off this value.
    """

    #: A new entry was written and a generation enqueued for it.
    CREATED = "created"
    #: A previously failed entry for the same key was reclaimed and re-enqueued.
    RETRIED = "retried"
    #: A generation already covering these sources answered the request — this
    #: account's own earlier entry, or the one another account already paid for.
    REUSED = "reused"
    #: A concurrent identical request won the conditional write; this one lost.
    COLLAPSED = "collapsed"


class ArtifactGenerationPlan:
    """Everything decided before anything is written.

    Split in two on purpose: the quota must be checked *after* the ownership verdict
    (an account already holding the entry it asks for must not be charged twice) and
    *before* the write (a denied request leaves no entry). Planning and committing as
    separate steps is what lets the endpoint express that order without an extra read
    (task-269 §10.3).

    Two records, because a media artifact is generated once per content and held once
    per account (task-394): ``entry`` is the row this account gets, ``generation`` is
    the row the worker generates into. For a folder artifact, and for an artifact over
    a user-uploaded file, they are the *same object* — there is nothing to share, so
    there is no indirection.
    """

    def __init__(
        self,
        *,
        owned: Optional[MediaArtifactRecord] = None,
        entry: Optional[MediaArtifactRecord] = None,
        entry_reclaims_failed: bool = False,
        generation: Optional[MediaArtifactRecord] = None,
        generation_reclaims_failed: bool = False,
        message: Optional[Dict[str, Any]] = None,
        awaits_sources: bool = False,
    ) -> None:
        #: The account's entry already answers this request, so nothing is written
        #: and nothing is charged: it was charged when the account acquired it.
        self.owned = owned
        #: The row this account will hold. Addressed by the API, listed in the
        #: history, and the token the debit is keyed on.
        self.entry = entry
        #: ``entry`` carries the id of a failed row to overwrite in place, rather
        #: than an id nothing is stored under yet.
        self.entry_reclaims_failed = entry_reclaims_failed
        #: The row to generate into, or ``None`` when a generation that already
        #: exists answers the request — the whole point of the mutualization: the
        #: account gains an entry, the provider is not called.
        self.generation = generation
        self.generation_reclaims_failed = generation_reclaims_failed
        self.message = message
        #: The entry is written but **not** enqueued: at least one source is still
        #: being prepared, and a completion event resumes it (task-360). The debit
        #: happens here all the same — the request was accepted, and the resume
        #: never charges anything, which is what keeps one deferred generation to
        #: one debit.
        self.awaits_sources = awaits_sources

    @property
    def already_owned(self) -> bool:
        """True when this account already holds the entry it is asking for.

        The only case that consumes nothing. A request served by *another* account's
        generation does consume: the account gains an entry it did not have, and the
        avoided provider call is the operator's saving, not free allowance.
        """
        return self.owned is not None


async def plan_artifact_generation(
    *,
    user_id: str,
    scope: Any,
    scope_id: str,
    content_scope_id: Optional[str] = None,
    artifact_type: Any,
    resolution: ScopeResolution,
    parameters: Optional[Dict[str, Any]] = None,
) -> ArtifactGenerationPlan:
    """Decide whether anything has to be generated, and what has to be written.

    Two lookups, in this order, and both without any time bound — the ids are
    derived from the sources alone, so what they find was generated over exactly
    these sources, whenever that happened:

    1. **the account's own entry.** Found and not failed, it *is* the answer: nothing
       is written and nothing is charged.
    2. **the shared generation for this content** (media scope, content not
       account-scoped). Found and not failed, the account gets an entry pointing at
       it — mirrored if it is already terminal, in flight if it is still running —
       and the provider is not called a second time (task-394).

    Only a *failed* row is not an answer, on either side, and it is reclaimed
    instead.

    A resolution that still has sources in preparation writes the account's entry
    under the same id — the id hashes the sources the artifact *will* read, not the
    ones already readable — and arms no generation at all (task-360). The wait is the
    account's, so its deadline and its ``preparation`` snapshot live on its own row;
    a shared generation is only ever armed once every source is readable.
    """
    if not ARTIFACT_GENERATION_ENABLED:
        raise ArtifactGenerationDisabledError("Artifact generation is disabled.")

    resolved_scope = _artifact_scope(scope)
    resolved_type = _artifact_type(artifact_type)
    if resolved_type not in _allowed_artifact_types():
        raise ArtifactTypeNotEnabledError(
            f"Artifact type '{resolved_type.value}' is not enabled."
        )
    if resolved_type not in GENERATABLE_ARTIFACT_TYPES:
        raise ArtifactTypeNotEnabledError(
            f"Artifact type '{resolved_type.value}' is not implemented yet."
        )
    # An internal type has no user-facing entry point, so the only thing that can
    # aim it at a folder is a backend caller getting its scope wrong. Refusing
    # here rather than trusting the caller keeps the invariant next to the rule it
    # protects: a folder artifact would land in a listing that filters this type
    # out, i.e. it would be generated, billed, and unreadable.
    if resolved_type in INTERNAL_ARTIFACT_TYPES and resolved_scope != ArtifactScope.MEDIA:
        raise ArtifactTypeNotEnabledError(
            f"Artifact type '{resolved_type.value}' is internal and only exists on "
            f"the media scope, not on '{resolved_scope.value}'."
        )
    # Deferring only makes sense for a request someone is waiting on. An internal
    # type is triggered *by* the end of a preparation, so a waiting entry there
    # would be a background job scheduling its own retry through the artifact
    # table — and it has no tile to spin, no user to inform. Its callers already
    # catch this error and give up for this run.
    if resolution.is_awaiting and resolved_type in INTERNAL_ARTIFACT_TYPES:
        raise ArtifactTranscriptNotReadyError(
            f"Artifact type '{resolved_type.value}' is internal and is not "
            "deferred while its sources are being prepared.",
            pending_titles=[source.title for source in resolution.pending if source.title],
            pending_count=len(resolution.pending),
        )

    merged_parameters = dict(parameters or {})
    # The reading language is the *only* carrier of the output language: no source
    # text is translated for it, the prompt asks for it (task-398). It is part of
    # the hash, so reading in another language is another artifact.
    if resolution.output_language:
        merged_parameters["language"] = resolution.output_language
    normalized_parameters = normalize_artifact_parameters(merged_parameters)

    generator_version = get_generator_version(resolved_type)
    effective_scope_id = content_scope_id or scope_id
    # Sources still in preparation are hashed in like readable ones: they are part
    # of what this artifact will have read, and leaving them out would give the
    # deferred request one id and the generation that follows another — two
    # entries, two debits (task-360).
    source_ids = resolution.expected_source_ids
    now = _now_utc()

    artifact_id = build_artifact_id(
        user_id=user_id,
        scope=resolved_scope,
        scope_id=effective_scope_id,
        artifact_type=resolved_type,
        parameters=normalized_parameters,
        source_media_item_ids=source_ids,
    )

    existing = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if existing is not None and _is_awaiting_overdue(existing, now=now):
        # The wait behind this id ran out and nobody has ended it yet (the sweep
        # runs on read, and this request may be the first read since). End it here
        # so the request in hand starts a fresh wait instead of being answered by a
        # dead one.
        if await media_artifacts.fail_awaiting_artifact(
            artifact_id=existing.artifact_id,
            error_code=ERROR_CODE_PREPARATION_TIMEOUT,
            error_message=(
                "The sources of this generation were still being prepared when the "
                "request expired."
            ),
        ):
            existing = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if existing is not None and existing.status != MediaArtifactStatus.FAILED:
        log_event(
            logger,
            logging.INFO,
            "artifact.reused",
            "Existing artifact reused: the sources behind it are unchanged",
            artifact_id=existing.artifact_id,
            artifact_type=existing.artifact_type.value,
            artifact_status=existing.status.value,
            scope=resolved_scope.value,
            scope_id=scope_id,
            source_count=existing.source_count,
        )
        return ArtifactGenerationPlan(owned=existing)

    entry = MediaArtifactRecord(
        artifact_id=artifact_id,
        user_id=user_id,
        scope=resolved_scope,
        scope_id=scope_id,
        scope_key=build_scope_key(
            user_id=user_id, scope=resolved_scope, scope_id=effective_scope_id
        ),
        artifact_type=resolved_type,
        status=MediaArtifactStatus.QUEUED,
        parameters=normalized_parameters,
        # Recorded, never keyed on: this is what says which prompt produced which
        # artifact, and a retry below stamps the version that actually reran.
        generator_version=generator_version,
        source_count=len(source_ids),
        sources=resolution.snapshot(),
        # A reclaimed entry keeps its original position in the history: the GSI
        # sorts on `created_at`, and a retry is the same generation attempted
        # again, not a later one.
        created_at=existing.created_at if existing is not None else now,
        updated_at=now,
        # The deadline is stored rather than derived from `created_at`, which a
        # reclaimed entry inherits from the attempt before: a retried request would
        # otherwise be born already expired.
        awaiting_expires_at=(
            now + timedelta(seconds=AWAITING_SOURCES_TIMEOUT_SECONDS)
            if resolution.is_awaiting
            else None
        ),
    )
    entry_reclaims_failed = existing is not None

    if not mutualizes_generation(
        scope=resolved_scope, content_scope_id=effective_scope_id, user_id=user_id
    ):
        # Nothing to share: this row *is* the generation, exactly as before task-394.
        if resolution.is_awaiting:
            _log_awaiting(entry, resolution=resolution)
            return ArtifactGenerationPlan(
                entry=entry,
                entry_reclaims_failed=entry_reclaims_failed,
                awaits_sources=True,
            )
        return ArtifactGenerationPlan(
            entry=entry,
            entry_reclaims_failed=entry_reclaims_failed,
            generation=entry,
            message=build_generation_message(
                record=entry,
                resolution=resolution,
                content_scope_id=effective_scope_id,
            ),
        )

    shared_id = build_shared_artifact_id(
        scope=resolved_scope,
        scope_id=effective_scope_id,
        artifact_type=resolved_type,
        parameters=normalized_parameters,
        source_media_item_ids=source_ids,
    )
    entry.shared_artifact_id = shared_id
    shared_existing = await media_artifacts.get_media_artifact_by_id(shared_id)

    if shared_existing is not None and shared_existing.status != MediaArtifactStatus.FAILED:
        # The generation this request needs already exists — finished, or running for
        # somebody else. Either way the provider is not called again: the account
        # gains an entry mirroring it (terminal) or waiting on it (in flight).
        if shared_existing.status in _IN_FLIGHT_ARTIFACT_STATUSES:
            served = entry
        else:
            served = _mirror_of_shared_generation(pointer=entry, shared=shared_existing)
        log_event(
            logger,
            logging.INFO,
            "artifact.shared_generation_reused",
            "Existing generation of this content answered the request: nothing queued",
            artifact_id=entry.artifact_id,
            shared_artifact_id=shared_id,
            artifact_type=resolved_type.value,
            artifact_status=shared_existing.status.value,
            scope=resolved_scope.value,
            scope_id=scope_id,
            source_count=served.source_count,
        )
        return ArtifactGenerationPlan(
            entry=served, entry_reclaims_failed=entry_reclaims_failed
        )

    if resolution.is_awaiting:
        # No generation is armed while a source is still being prepared, so the
        # account's own row carries the wait. Its expected ``shared_artifact_id`` is
        # stored all the same: that is what the resume verifies before arming.
        _log_awaiting(entry, resolution=resolution)
        return ArtifactGenerationPlan(
            entry=entry,
            entry_reclaims_failed=entry_reclaims_failed,
            awaits_sources=True,
        )

    shared = build_shared_generation_record(
        shared_artifact_id=shared_id,
        user_id=user_id,
        scope=resolved_scope,
        scope_id=scope_id,
        content_scope_id=effective_scope_id,
        artifact_type=resolved_type,
        parameters=normalized_parameters,
        generator_version=generator_version,
        resolution=resolution,
        created_at=shared_existing.created_at if shared_existing is not None else now,
    )
    return ArtifactGenerationPlan(
        entry=entry,
        entry_reclaims_failed=entry_reclaims_failed,
        generation=shared,
        generation_reclaims_failed=shared_existing is not None,
        message=build_generation_message(
            record=shared,
            resolution=resolution,
            content_scope_id=effective_scope_id,
        ),
    )


def build_shared_generation_record(
    *,
    shared_artifact_id: str,
    user_id: str,
    scope: ArtifactScope,
    scope_id: str,
    content_scope_id: str,
    artifact_type: MediaArtifactType,
    parameters: Dict[str, Any],
    generator_version: str,
    resolution: ScopeResolution,
    created_at: Optional[datetime] = None,
) -> MediaArtifactRecord:
    """The row a shared generation is written into.

    Indexed under ``@content#media#<content id>``, a scope key no account can produce,
    so it lives in the same GSI as the entries — which is what makes the generations of
    one content item enumerable for a purge — while being unreachable from any
    account's listing query.

    ``user_id`` and ``scope_id`` are the *triggering* account and its library row.
    They are attribution, not ownership: they say who caused the provider call, which
    is what the cost log and the ``review_blurb`` fan-out start from. Nothing checks
    them, and this row is not addressable through the API.
    """
    now = _now_utc()
    return MediaArtifactRecord(
        artifact_id=shared_artifact_id,
        user_id=user_id,
        scope=scope,
        scope_id=scope_id,
        scope_key=build_content_scope_key(scope=scope, scope_id=content_scope_id),
        artifact_type=artifact_type,
        status=MediaArtifactStatus.QUEUED,
        parameters=parameters,
        generator_version=generator_version,
        source_count=len(resolution.sources),
        sources=resolution.snapshot(),
        created_at=created_at or now,
        updated_at=now,
    )


def _log_awaiting(record: MediaArtifactRecord, *, resolution: ScopeResolution) -> None:
    log_event(
        logger,
        logging.INFO,
        "artifact.awaiting_sources",
        "Artifact request accepted while its sources are still being prepared",
        artifact_id=record.artifact_id,
        artifact_type=record.artifact_type.value,
        scope=record.scope.value,
        scope_id=record.scope_id,
        source_count=record.source_count,
        pending_count=len(resolution.pending),
        preparations=sorted({source.preparation for source in resolution.pending}),
        awaiting_expires_at=record.awaiting_expires_at.isoformat()
        if record.awaiting_expires_at
        else None,
    )


def _is_awaiting_overdue(
    record: MediaArtifactRecord,
    *,
    now: Optional[datetime] = None,
) -> bool:
    """True when this entry is waiting for sources and its deadline has passed."""
    if record.status != MediaArtifactStatus.QUEUED or record.awaiting_expires_at is None:
        return False
    return record.awaiting_expires_at <= (now or _now_utc())


def build_generation_message(
    *,
    record: MediaArtifactRecord,
    resolution: ScopeResolution,
    content_scope_id: str,
) -> Dict[str, Any]:
    """The SQS payload of one generation.

    Built from the record plus a resolution whose sources are all readable, which
    is what lets a deferred request produce it at resume time from the very same
    code as an immediate one — the entry says what to generate, the fresh
    resolution says which text to read.

    ``record`` is the row the worker will generate into: the shared generation for a
    media artifact, the account's own row for a folder one. ``content_scope_id`` is
    passed rather than parsed off ``scope_key`` because it is what the prompt cache
    keys on, and the cache must be shared by the five types of one request whichever
    role the row plays.
    """
    effective_scope_id = content_scope_id
    return {
        "artifact_id": record.artifact_id,
        "user_id": record.user_id,
        "scope": record.scope.value,
        "scope_id": record.scope_id,
        "artifact_type": record.artifact_type.value,
        "parameters": record.parameters,
        "generator_version": record.generator_version,
        # Same corpus prefix for the 5 types of one request, so OpenAI's prompt
        # cache is what shares the corpus between the 5 independent invocations —
        # no intermediate store and no coordination lock of ours (task-269 §2.6).
        "prompt_cache_key": _prompt_cache_key(
            scope=record.scope,
            scope_id=effective_scope_id,
            sources=resolution.sources,
        ),
        # No transcript byte travels through the queue: a key per source, plus the
        # author's description, which has no S3 object to point at. ~5 kB of keys
        # at the 25-source ceiling, and the platforms cap the description they
        # expose (5 000 characters on YouTube, 2 200 on Instagram), so a full
        # folder of description-heavy sources still sits inside SQS's 256 kB.
        "sources": [
            {
                "media_item_id": source.media_item_id,
                "title": source.title,
                "transcript_bucket": TRANSCRIPT_BUCKET,
                "transcript_s3_key": source.transcript_s3_key,
                "language": source.language,
                # Dates the worker puts in the corpus header, so the model can
                # anchor a fact that is only true at one instant instead of
                # writing "today" into a permanent artifact (task-316 §2.7).
                "published": source.published,
                "captured": source.captured,
                # The author's own presentation text, travelling as text rather
                # than as a key: it lives on the job's `extraction_metadata`, so
                # there is no S3 object to point at (task-383). None when the
                # platform exposes no such field, which is most of them.
                "description": source.description,
            }
            for source in resolution.sources
        ],
    }


async def commit_artifact_generation(
    plan: ArtifactGenerationPlan,
) -> Tuple[MediaArtifactRecord, ArtifactGenerationOutcome]:
    """Write what the plan decided, and enqueue the generation if it armed one.

    Two writes for a media artifact, in this order and for this reason: the **shared
    generation** first, because its conditional write is the exactly-once gate for the
    provider call — across accounts, not just across two taps of one thumb — and then
    the account's **entry**, which is what the API hands back. Losing the first means
    somebody else's request is generating what this one needs, so this one enqueues
    nothing and its entry is adapted to what actually exists. Losing the second means
    a concurrent identical request from the same account already wrote it.

    The order also fails safe: an entry written with no generation behind it would be
    a spinner nobody ends, whereas a generation written with no entry behind it is a
    row the next request for that content adopts.

    The outcome is the caller's contract. ``REUSED`` means no generation was armed
    because one already covers these sources — the account still gains an entry, and
    is still charged for it (task-394). ``COLLAPSED`` means this request lost the
    write of its own entry to an identical concurrent one. ``RETRIED`` reruns under the
    same entry id, so a caller keying its debit on ``artifact_id`` charges once, not
    once per attempt.

    A waiting plan writes the entry and stops there: it is ``queued``, it is what the
    history and the tile read, and the generation is armed once its last source
    becomes readable, from ``artifact_wait_service`` (task-360).
    """
    if plan.owned is not None:
        # Already held. Resolved before being handed back, so a request repeated
        # while the generation it points at finished answers with the finished state
        # rather than with a stale ``queued``.
        return (
            await resolve_through_shared_generation(plan.owned),
            ArtifactGenerationOutcome.REUSED,
        )
    if plan.entry is None:
        raise ArtifactServiceError("Artifact generation plan is empty.")

    entry = plan.entry
    generation = plan.generation
    shares_generation = generation is not None and generation is not entry
    generation_armed = False

    if shares_generation and generation is not None:
        generation, generation_armed = await arm_shared_generation(
            record=generation,
            reclaims_failed=plan.generation_reclaims_failed,
        )
        if not generation_armed:
            # Somebody else's request armed it between the plan and this write. Its
            # generation answers ours, so ours sends nothing and its entry reflects
            # the row that actually exists.
            entry = _entry_served_by(entry=entry, shared=generation)

    if plan.entry_reclaims_failed:
        # Conditional on the row still being `failed`: if a concurrent request
        # already reclaimed it, that request owns the entry and this one has nothing
        # left to write.
        entry_written = await media_artifacts.reclaim_failed_artifact(entry)
    else:
        try:
            await media_artifacts.create_media_artifact(entry)
            entry_written = True
        except media_artifacts.ArtifactAlreadyExistsError:
            entry_written = False

    if not shares_generation:
        # The entry *is* the generation: one write decided both.
        generation_armed = entry_written and plan.message is not None

    if generation_armed and plan.message is not None and generation is not None:
        try:
            await sqs.send_message(
                queue_name=get_artifact_queue(generation.artifact_type),
                message_body=plan.message,
            )
        except Exception as exc:
            await fail_artifact_generation(
                artifact_id=generation.artifact_id,
                error_message=f"artifact_enqueue_failed: {exc}",
                error_code="INTERNAL_ERROR",
            )
            raise

    if not entry_written:
        return await _collapsed_onto_existing(entry.artifact_id)

    if plan.generation is None:
        # An existing generation answers this request: the entry was written, the
        # provider was not called. This is the mutualization, seen from the caller.
        return entry, ArtifactGenerationOutcome.REUSED

    outcome = (
        ArtifactGenerationOutcome.RETRIED
        if plan.entry_reclaims_failed
        else ArtifactGenerationOutcome.CREATED
    )
    if not generation_armed:
        outcome = ArtifactGenerationOutcome.REUSED
    elif plan.message is not None and generation is not None:
        log_event(
            logger,
            logging.INFO,
            "artifact.enqueued",
            "Artifact generation enqueued",
            artifact_id=entry.artifact_id,
            shared_artifact_id=generation.artifact_id if shares_generation else None,
            artifact_type=entry.artifact_type.value,
            scope=entry.scope.value,
            scope_id=entry.scope_id,
            source_count=generation.source_count,
            queue=get_artifact_queue(generation.artifact_type),
            outcome=outcome.value,
        )
    return entry, outcome


async def arm_shared_generation(
    *,
    record: MediaArtifactRecord,
    reclaims_failed: bool,
) -> Tuple[MediaArtifactRecord, bool]:
    """Take ownership of the single generation of this content, or find who has it.

    Returns ``(row, armed)``. ``armed`` is the right to send the message: exactly one
    caller gets it per generation, because both writes are conditional — a create on
    ``attribute_not_exists``, a reclaim on the row still being ``failed``. Whoever
    loses reads back the row that won and generates nothing.

    Public because there are two ways to arm a generation and both must go through
    this single gate: a request whose sources are readable straight away
    (:func:`commit_artifact_generation`) and one resumed once its last source landed
    (``artifact_wait_service``).
    """
    if reclaims_failed:
        if await media_artifacts.reclaim_failed_artifact(record):
            return record, True
    else:
        try:
            await media_artifacts.create_media_artifact(record)
            return record, True
        except media_artifacts.ArtifactAlreadyExistsError:
            pass

    existing = await media_artifacts.get_media_artifact_by_id(record.artifact_id)
    if existing is None:
        raise ArtifactServiceError(
            "Shared generation was claimed concurrently but cannot be read back."
        )
    log_event(
        logger,
        logging.INFO,
        "artifact.shared_generation_collapsed",
        "Another request armed the generation of this content first; reusing it",
        artifact_id=existing.artifact_id,
        artifact_type=existing.artifact_type.value,
        artifact_status=existing.status.value,
        scope_id=existing.scope_id,
    )
    return existing, False


def _entry_served_by(
    *,
    entry: MediaArtifactRecord,
    shared: MediaArtifactRecord,
) -> MediaArtifactRecord:
    """The account's entry as it must be written, given the generation serving it.

    A generation still running leaves the entry ``queued``: the read path reports the
    generation's own status until it is terminal. A terminal one is mirrored straight
    away, so the entry is born ``ready`` with the storage ref and the account's very
    next read costs one query.
    """
    if shared.status in _IN_FLIGHT_ARTIFACT_STATUSES:
        return entry
    return _mirror_of_shared_generation(pointer=entry, shared=shared)


async def _collapsed_onto_existing(
    artifact_id: str,
) -> Tuple[MediaArtifactRecord, ArtifactGenerationOutcome]:
    """Read back the entry a concurrent identical request wrote first."""
    existing = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if existing is None:
        raise ArtifactServiceError(
            "Artifact id was claimed concurrently but cannot be read back."
        )
    log_event(
        logger,
        logging.INFO,
        "artifact.collapsed",
        "Concurrent identical artifact request collapsed onto the one in flight",
        artifact_id=existing.artifact_id,
        artifact_type=existing.artifact_type.value,
        scope=existing.scope.value,
        scope_id=existing.scope_id,
    )
    return existing, ArtifactGenerationOutcome.COLLAPSED


def _prompt_cache_key(
    *,
    scope: ArtifactScope,
    scope_id: str,
    sources: List[ResolvedSource],
) -> str:
    material = "|".join(
        [scope.value, scope_id, *[source.transcript_s3_key for source in sources]]
    )
    return _sha256_text(material)[:48]


def enforce_scope_ceilings(resolution: ScopeResolution) -> None:
    """Refuse rather than truncate.

    A truncated artifact would claim to cover sources whose text never reached
    the model, which makes its own snapshot a lie — and the snapshot is the thing
    that makes the history interpretable. Same reason there is no "25 most
    recent" auto-selection: that is truncation wearing a hat.

    A source still being prepared does not empty a scope: it counts here exactly
    like a readable one, which is what turns "nothing is transcribed yet" from a
    refusal into a waiting entry (task-360). Only definitive exclusions — an
    ingestion that failed or produced no readable text — can leave a scope empty.

    The token ceiling can only be measured on the sources that are readable, so a
    deferred request is checked again at resume, when every transcript exists.
    """
    source_count = len(resolution.sources) + len(resolution.pending)
    estimated_tokens = resolution.estimated_tokens
    if source_count == 0:
        raise ArtifactScopeEmptyError(
            "This folder has no source with a usable transcript yet."
        )
    if source_count > MAX_FOLDER_SOURCES or estimated_tokens > MAX_FOLDER_CORPUS_TOKENS:
        raise ArtifactScopeTooLargeError(
            "This folder is too large to generate over. Generate on a "
            "smaller subfolder instead.",
            source_count=source_count,
            max_sources=MAX_FOLDER_SOURCES,
            estimated_tokens=estimated_tokens,
            max_tokens=MAX_FOLDER_CORPUS_TOKENS,
        )


# ---------------------------------------------------------------------------
# Worker-side transitions
# ---------------------------------------------------------------------------


async def claim_artifact_generation(artifact_id: str) -> Optional[MediaArtifactRecord]:
    """Take the generation lease, or return ``None`` to stand down.

    ``None`` means the entry is already terminal or another worker owns a live
    lease — an SQS redelivery or a Lambda replay. The caller must acknowledge its
    message without calling the LLM.
    """
    claimed = await media_artifacts.claim_artifact_generation(
        artifact_id=artifact_id,
        lease_expires_at=_now_utc() + timedelta(seconds=GENERATION_LEASE_SECONDS),
    )
    if not claimed:
        return None
    record = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if record is None:
        return None
    log_event(
        logger,
        logging.INFO,
        "artifact.generating",
        "Artifact generation started",
        artifact_id=record.artifact_id,
        artifact_type=record.artifact_type.value,
        scope=record.scope.value,
        scope_id=record.scope_id,
    )
    return record


async def complete_artifact_generation(
    *,
    artifact_id: str,
    content: Dict[str, Any],
    title: Optional[str] = None,
    llm_usage: Optional[ArtifactLlmUsage] = None,
) -> MediaArtifactRecord:
    """Store the content and seal the entry. It is never written again after this."""
    record = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if not record:
        raise ArtifactNotFoundError(f"Artifact {artifact_id} not found.")

    payload_json = json.dumps(content, indent=2, ensure_ascii=False)
    payload_bytes = payload_json.encode("utf-8")
    storage = ArtifactStorageRef(
        bucket=get_artifact_bucket(record.artifact_type),
        key=build_artifact_storage_key(
            artifact_id=artifact_id,
            artifact_type=record.artifact_type,
        ),
        content_type="application/json",
        content_sha256=_sha256_bytes(payload_bytes),
    )
    await s3.upload_file_object(
        bucket=storage.bucket,
        key=storage.key,
        file_obj=BytesIO(payload_bytes),
        content_type=storage.content_type,
        metadata={
            "artifact-id": artifact_id,
            "artifact-type": record.artifact_type.value,
            "scope": record.scope.value,
        },
    )

    now = _now_utc()
    record.status = MediaArtifactStatus.READY
    record.storage = storage
    # Copied onto the row so the history listing needs no S3 access at all —
    # that is what keeps a page of N entries at one DynamoDB query.
    if title:
        record.title = title
    if llm_usage is not None:
        record.llm_usage = llm_usage
    record.lease_expires_at = None
    record.error_code = None
    record.error_message = None
    record.updated_at = now
    record.completed_at = now
    await media_artifacts.update_media_artifact(record)

    # Only this type, and only at media scope: ``scope_id`` is the library row's
    # media id there, whereas at folder scope it is a folder id and the copy
    # would address a row that does not exist.
    if (
        record.artifact_type == MediaArtifactType.REVIEW_BLURB
        and record.scope == ArtifactScope.MEDIA
    ):
        await _mirror_review_blurb_onto_content_rows(
            record=record,
            blurb=_read_blurb(content),
        )

    log_event(
        logger,
        logging.INFO,
        "artifact.completed",
        "Artifact generation completed",
        artifact_id=artifact_id,
        artifact_type=record.artifact_type.value,
        scope=record.scope.value,
        scope_id=record.scope_id,
        source_count=record.source_count,
    )
    return record


def _read_blurb(content: Dict[str, Any]) -> Optional[ReviewBlurb]:
    """Pull the triage card out of a stored ``review_blurb`` envelope.

    Validated rather than passed through: what goes onto the library row is read
    back by every list request, and an envelope in an older shape (the v1 prose)
    would otherwise travel all the way to the mobile client as a malformed card.
    """
    payload = content.get("content")
    if not isinstance(payload, dict):
        return None
    try:
        blurb = ReviewBlurb.model_validate(payload)
    except ValidationError:
        return None
    return blurb if blurb.hook.strip() else None


async def _mirror_review_blurb_onto_library_row(
    *,
    user_id: str,
    media_item_id: str,
    blurb: Optional[ReviewBlurb],
    artifact_id: str,
) -> bool:
    """Copy a finished blurb onto the ``user_media`` row that displays it.

    Same reason the model's ``title`` is copied onto the artifact row: the library
    list must render without an S3 read. A screen showing 50 rows would otherwise
    mean 50 artifact lookups plus 50 object downloads to display one card each,
    which is the cost this copy buys out — one attribute-level ``SET``, once per
    media forever.

    Never fatal. The artifact is stored and sealed by the time this runs, so a
    failure here must not turn a successful generation into a failed one;
    ``copy_review_blurb_to_library_row`` is the repair path for a row it missed.
    Returns whether the row now carries the prose.
    """
    if blurb is None:
        return False

    try:
        from media_summarizer.utils import user_media as user_media_store

        updated = await user_media_store.update_attributes(
            user_id=user_id,
            media_item_id=media_item_id,
            attributes={"review_blurb": blurb.model_dump()},
        )
        if not updated:
            log_event(
                logger,
                logging.INFO,
                "artifact.review_blurb_row_missing",
                "Library row is gone; keeping the artifact without its row copy",
                artifact_id=artifact_id,
                media_item_id=media_item_id,
            )
        return updated
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "artifact.review_blurb_copy_failed",
            "Failed to copy review_blurb onto the library row (non-fatal)",
            artifact_id=artifact_id,
            media_item_id=media_item_id,
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        return False


async def _mirror_review_blurb_onto_content_rows(
    *,
    record: MediaArtifactRecord,
    blurb: Optional[ReviewBlurb],
) -> None:
    """Copy a finished blurb onto every row that holds the content, whoever owns it.

    ``artifact_id`` is keyed on the *content* (the deduplicated ``media_key``), never
    on the save, so a single generation answers every save of the same URL — by the
    same user, and since task-394 by any user. Writing onto ``scope_id`` alone
    therefore leaves the other rows blank while the entry reports ``ready``, which is
    the media contract announcing a card that exists nowhere (task-391). Neither case
    is exotic: the first is a user re-filing a source while its blurb is still
    generating, the second is two accounts saving the same video.

    The fan-out is cross-account for the same reason the artifact is: the blurb is a
    property of the content, so every row displaying that content displays the same
    card. Each row is written under **its own** ``user_id`` — the copy is a per-row
    attribute write, never an ownership transfer.

    Best-effort like the single-row copy it wraps: the artifact is sealed by the time
    this runs, and ``copy_review_blurb_to_library_row`` remains the repair path for a
    row this missed.
    """
    if blurb is None:
        return

    targets = [(record.user_id, record.scope_id)]
    content_id = content_scope_id_from_scope_key(record.scope_key)
    if content_id:
        try:
            from media_summarizer.utils import user_media as user_media_store

            rows = await user_media_store.list_by_media_key(content_id)
        except Exception as exc:
            log_event(
                logger,
                logging.WARNING,
                "artifact.review_blurb_fanout_failed",
                "Could not list the saves of this content; copying onto the "
                "requesting row only",
                artifact_id=record.artifact_id,
                media_item_id=record.scope_id,
                error_type=type(exc).__name__,
                detail=str(exc)[:200],
            )
            rows = []
        targets.extend(
            (row.user_id, row.media_item_id)
            for row in rows
            if (row.user_id, row.media_item_id) != (record.user_id, record.scope_id)
        )

    for user_id, media_item_id in targets:
        await _mirror_review_blurb_onto_library_row(
            user_id=user_id,
            media_item_id=media_item_id,
            blurb=blurb,
            artifact_id=record.artifact_id,
        )


async def copy_review_blurb_to_library_row(
    *,
    record: MediaArtifactRecord,
    media_item_id: str,
) -> bool:
    """Repair path: mirror an *already stored* blurb onto a row that lacks it.

    Two situations produce a ready artifact next to a row with no prose, and
    neither is worth a second generation:

    - the copy at completion time failed (S3 wrote, DynamoDB did not);
    - a second save of the same content by the same user resolves to the very same
      ``artifact_id`` — the id is derived from the content key, not from the row —
      so it is answered by ``REUSED`` and its own row was never written to. Hence
      ``media_item_id`` is a parameter instead of being read off ``record``: the
      row to fill is the caller's, not the one that first triggered the generation.

    One S3 read, and only on a row that has no blurb yet.
    """
    if record.artifact_type != MediaArtifactType.REVIEW_BLURB:
        return False
    if record.scope != ArtifactScope.MEDIA:
        return False
    if record.status != MediaArtifactStatus.READY or record.storage is None:
        return False

    try:
        raw = await s3.download_file_to_memory(
            bucket=record.storage.bucket,
            key=record.storage.key,
        )
        content = json.loads(raw.decode("utf-8", errors="ignore"))
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "artifact.review_blurb_reread_failed",
            "Could not re-read a stored review_blurb to repair its library row",
            artifact_id=record.artifact_id,
            media_item_id=media_item_id,
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        return False

    return await _mirror_review_blurb_onto_library_row(
        user_id=record.user_id,
        media_item_id=media_item_id,
        blurb=_read_blurb(content if isinstance(content, dict) else {}),
        artifact_id=record.artifact_id,
    )


async def fail_artifact_generation(
    *,
    artifact_id: str,
    error_message: str,
    error_code: Optional[str] = None,
) -> Optional[MediaArtifactRecord]:
    record = await media_artifacts.get_media_artifact_by_id(artifact_id)
    if not record:
        return None

    now = _now_utc()
    record.status = MediaArtifactStatus.FAILED
    effective_error_code = error_code or "INTERNAL_ERROR"
    record.error_code = effective_error_code
    record.error_message = error_message
    record.lease_expires_at = None
    # A failed entry is never waiting for a source any more: leaving the deadline on
    # it would make a resume hook believe the wait is still open and enqueue it.
    record.awaiting_expires_at = None
    record.updated_at = now
    record.completed_at = now
    await media_artifacts.update_media_artifact(record)

    log_event(
        logger,
        logging.ERROR,
        "artifact.failed",
        "Artifact generation failed",
        artifact_id=artifact_id,
        artifact_type=record.artifact_type.value,
        scope=record.scope.value,
        scope_id=record.scope_id,
        error_code=effective_error_code,
        detail=error_message,
    )
    return record
