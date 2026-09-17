"""
Canonical internal model for AI artifacts.

One record type serves both scopes (task-269/270): a media artifact is a
folder artifact with a single source. The record is an **append-only history
entry** — once it reaches ``ready`` it is never modified again. There is no
staleness flag, no expiry, no automatic regeneration.

An entry is also the permanent answer for its source set: ``artifact_id`` is
derived from the sources, so asking again for the same type over the same set
returns this very record instead of generating a second one. A media therefore
gets one artifact per type and per ``parameters`` — its source set never changes.
A folder gets a new entry only when its contents changed, which is why the
gap between an entry's ``sources`` snapshot and the folder's current contents
*is* the history rather than a defect to repair.

Since task-394 a media-scoped artifact is generated **once per content**, not once
per account, and the same record type plays two roles:

- a **shared generation** — the row the worker generates into, keyed on the content
  alone (no ``user_id`` in its ``artifact_id``) and indexed under a scope key no
  account can produce (:data:`CONTENT_SCOPE_OWNER`). It owns the S3 object;
- a **pointer** — one row per account that asked, keyed exactly as before, carrying
  ``shared_artifact_id``. It is what a listing returns, so an account keeps seeing
  only what it asked for.

A folder artifact has neither role: it stays a single per-account row.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class MediaArtifactType(str, Enum):
    SUMMARY_SHORT = "summary_short"
    SUMMARY_DETAILED = "summary_detailed"
    QUIZ = "quiz"
    NOTES = "notes"
    FLASHCARDS = "flashcards"
    #: Internal, media-scoped only (task-323): the short prose blurb the triage
    #: screen reads off the library row. The user never requests it — it is
    #: generated in the background at the end of ingestion, and
    #: ``artifact_service.INTERNAL_ARTIFACT_TYPES`` is what keeps it out of the
    #: requestable surface and out of the artifact history listing.
    REVIEW_BLURB = "review_blurb"


# Default value of ``ARTIFACT_TYPES_ALLOWED``, derived from the enum so the three
# sites that read that variable (``core/config.py``,
# ``core/services/artifact_service.py``, ``utils/infra_check.py``) cannot drift
# apart again: ``infra_check`` still defaulted to the ``summary`` type that stopped
# existing several tasks ago.
DEFAULT_ARTIFACT_TYPES_ALLOWED = ",".join(
    artifact_type.value for artifact_type in MediaArtifactType
)


class MediaArtifactStatus(str, Enum):
    QUEUED = "queued"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class ArtifactScope(str, Enum):
    """What an artifact was generated over: one media item, or a whole folder."""

    MEDIA = "media"
    FOLDER = "folder"


#: The ``user_id`` segment of a **shared generation**'s scope key. A Cognito subject
#: is a UUID, so no account can ever produce this segment: that is what makes a
#: user's listing query structurally unable to return a shared row, even though the
#: row it points at is the same generation another account is served by (task-394).
#: It also makes the shared rows of one content item enumerable — the purge needs
#: that, and a content-addressed ``artifact_id`` is not enumerable from the content.
CONTENT_SCOPE_OWNER = "@content"


def build_scope_key(*, user_id: str, scope: "ArtifactScope | str", scope_id: str) -> str:
    """Hash key of the ``scope-index`` GSI.

    ``user_id`` is part of it on purpose: isolation of the **listing** becomes
    structural, so a listing query cannot reach another account's scope. That is
    what replaces the old ownership check, which resolved the artifact's media
    item — impossible for a folder artifact, which has no media.

    It no longer isolates the generated *content*, which is deliberately shared
    between accounts for a media scope (task-394): what a user sees is what they
    asked for, and what the provider is paid for is one generation per content.
    """
    scope_value = scope.value if isinstance(scope, ArtifactScope) else str(scope)
    return f"{user_id}#{scope_value}#{scope_id}"


def build_content_scope_key(*, scope: "ArtifactScope | str", scope_id: str) -> str:
    """Scope key of a shared generation: the content's own, owned by no account."""
    return build_scope_key(user_id=CONTENT_SCOPE_OWNER, scope=scope, scope_id=scope_id)


def content_scope_id_from_scope_key(scope_key: str) -> str:
    """The scope id a ``scope_key`` was built from.

    A media artifact's ``scope_id`` is the library row id while its ``scope_key``
    carries the *content* id (the globally deduplicated ``media_key``), so the
    key is the only place the identity behind ``artifact_id`` survives. Recovering
    it by parsing is exact: neither a user id nor a media key contains ``#``.
    """
    _, _, remainder = scope_key.partition("#")
    _, _, scope_id = remainder.partition("#")
    return scope_id


def is_content_scope_key(scope_key: str) -> bool:
    """Whether this key addresses a shared generation rather than an account's scope."""
    return scope_key.startswith(f"{CONTENT_SCOPE_OWNER}#")


class ArtifactStorageRef(BaseModel):
    bucket: str
    key: str
    content_type: str = "application/json"
    content_sha256: Optional[str] = None


class ArtifactSource(BaseModel):
    """One entry of an artifact's immutable source snapshot.

    ``transcript_s3_key`` is the key the model read: the source's **original**
    transcript, since a generation never reads a translated one (task-398). So the
    snapshot designates the exact text the model saw. ``language`` is that text's
    own language, not the artifact's — the output language lives in
    ``parameters["language"]``. ``excluded`` marks a source that carried no usable
    transcript: it is recorded rather than dropped, so the artifact stays honest
    about what it could not read.
    """

    media_item_id: str
    title: Optional[str] = None
    transcript_s3_key: Optional[str] = None
    language: Optional[str] = None
    excluded: bool = False
    excluded_reason: Optional[str] = None
    #: Set **only** while the entry is waiting for this source to become
    #: readable, and only ever ``"transcription"``. It is the third state
    #: of a snapshot line, next to read and excluded, and the reason a completion
    #: event can tell whether a waiting entry is waiting on *its* media without a
    #: second index: the entry names the sources it is still expecting.
    #: ``None`` on every other line, so ``exclude_none`` keeps it out of the item
    #: entirely once the generation actually runs.
    preparation: Optional[str] = None


class ArtifactLlmUsage(BaseModel):
    """What the generation actually consumed, read off the provider response."""

    prompt_tokens: int = 0
    cached_tokens: int = 0
    completion_tokens: int = 0
    cost_eur: float = 0.0


class MediaArtifactRecord(BaseModel):
    # Deterministic, derived from (user, scope, scope_id, type, parameters,
    # sorted source ids) by ``artifact_service.build_artifact_id`` — never random,
    # and carrying no time component: the same request always lands on this id.
    # A shared generation drops the user from that material
    # (``build_shared_artifact_id``), which is the whole of cross-account reuse.
    artifact_id: str
    #: Who this row belongs to. On a **pointer** it is the account that asked, and
    #: the only thing ownership is checked against. On a **shared generation** it is
    #: merely the account whose request triggered it — kept for cost attribution and
    #: for the log line, never an ownership claim: a shared row is not addressable
    #: through the API at all.
    user_id: str
    scope: ArtifactScope
    scope_id: str
    scope_key: str
    #: Set on a **pointer**: the content-addressed generation that answers it. All
    #: the mutable state of that generation (status, storage, title, usage) lives on
    #: the shared row, and a pointer mirrors it once it is terminal; while it is in
    #: flight, a read resolves the shared row. ``None`` on a shared generation, on
    #: every folder artifact, and on an artifact over a file the account sent — that
    #: content id belongs to one account, so the row *is* the generation.
    shared_artifact_id: Optional[str] = None
    artifact_type: MediaArtifactType
    status: MediaArtifactStatus = MediaArtifactStatus.QUEUED
    parameters: Dict[str, Any] = Field(default_factory=dict)
    # Traceability only — which prompt produced this content. Deliberately absent
    # from ``artifact_id``, so bumping a prompt does not hand back a right to
    # regenerate what is already generated.
    generator_version: str
    title: Optional[str] = None
    source_count: int = 0
    sources: List[ArtifactSource] = Field(default_factory=list)
    storage: Optional[ArtifactStorageRef] = None
    llm_usage: Optional[ArtifactLlmUsage] = None
    # Worker lease, so a generation abandoned mid-flight becomes recoverable
    # instead of pinning the entry in ``generating`` forever.
    lease_expires_at: Optional[datetime] = None
    # Set on a ``queued`` entry whose sources are not all readable yet: the
    # request was honoured and persisted, but nothing has been enqueued and no
    # worker will pick it up until a completion event resumes it. It is therefore
    # the marker that tells the two kinds of ``queued`` apart — waiting for a
    # source vs waiting for the generator — and the deadline past which the wait
    # becomes a ``failed`` entry instead of a spinner nobody ends.
    awaiting_expires_at: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=_now_utc)
    updated_at: datetime = Field(default_factory=_now_utc)
    completed_at: Optional[datetime] = None

    @property
    def is_shared_generation(self) -> bool:
        """Whether this row is the content-addressed generation, not an account's.

        Read off ``scope_key`` rather than off a flag: the key is the one attribute
        the GSI projects, so a row obtained from a listing page can be recognised
        without a read of the base table.
        """
        return is_content_scope_key(self.scope_key)

    def to_dynamodb_item(self) -> Dict[str, Any]:
        item: Dict[str, Any] = {
            "artifact_id": self.artifact_id,
            "user_id": self.user_id,
            "scope": self.scope.value,
            "scope_id": self.scope_id,
            "scope_key": self.scope_key,
            "artifact_type": self.artifact_type.value,
            "status": self.status.value,
            "parameters": self.parameters,
            "generator_version": self.generator_version,
            "source_count": self.source_count,
            "sources": [
                source.model_dump(exclude_none=True) for source in self.sources
            ],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if self.shared_artifact_id:
            item["shared_artifact_id"] = self.shared_artifact_id
        if self.title:
            item["title"] = self.title
        if self.storage is not None:
            item["storage"] = self.storage.model_dump(exclude_none=True)
        if self.llm_usage is not None:
            usage = self.llm_usage.model_dump()
            # DynamoDB deliberately rejects binary floats. Keep the application
            # model convenient for pricing arithmetic and convert only at the
            # persistence boundary, through str so the decimal value matches the
            # rounded amount rather than the float's binary representation.
            usage["cost_eur"] = Decimal(str(self.llm_usage.cost_eur))
            item["llm_usage"] = usage
        if self.lease_expires_at is not None:
            item["lease_expires_at"] = self.lease_expires_at.isoformat()
        if self.awaiting_expires_at is not None:
            item["awaiting_expires_at"] = self.awaiting_expires_at.isoformat()
        if self.error_code:
            item["error_code"] = self.error_code
        if self.error_message:
            item["error_message"] = self.error_message
        if self.completed_at is not None:
            item["completed_at"] = self.completed_at.isoformat()
        return item

    @classmethod
    def from_dynamodb_item(cls, item: Dict[str, Any]) -> "MediaArtifactRecord":
        payload = dict(item)
        payload["scope"] = ArtifactScope(payload["scope"])
        payload["artifact_type"] = MediaArtifactType(payload["artifact_type"])
        payload["status"] = MediaArtifactStatus(payload["status"])
        payload["created_at"] = datetime.fromisoformat(payload["created_at"])
        payload["updated_at"] = datetime.fromisoformat(payload["updated_at"])
        for optional_timestamp in (
            "completed_at",
            "lease_expires_at",
            "awaiting_expires_at",
        ):
            if payload.get(optional_timestamp):
                payload[optional_timestamp] = datetime.fromisoformat(
                    payload[optional_timestamp]
                )
            else:
                payload.pop(optional_timestamp, None)
        payload["source_count"] = int(payload.get("source_count") or 0)
        storage = payload.get("storage")
        if storage is not None:
            payload["storage"] = ArtifactStorageRef(**storage)
        usage = payload.get("llm_usage")
        if usage is not None:
            payload["llm_usage"] = ArtifactLlmUsage(
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                cached_tokens=int(usage.get("cached_tokens") or 0),
                completion_tokens=int(usage.get("completion_tokens") or 0),
                cost_eur=float(usage.get("cost_eur") or 0.0),
            )
        payload["sources"] = [
            ArtifactSource(**source) for source in (payload.get("sources") or [])
        ]
        return cls(**payload)
