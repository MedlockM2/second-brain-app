"""Artifact routes, scope-addressed.

One set of routes serves both scopes (task-269 §9.1): a media artifact is
requested with ``scope="media"``, a folder artifact with ``scope="folder"``.
The per-media routes are gone, with no alias and no deprecation window.

Ownership is a comparison, not a query: the record carries ``user_id``, and the
listing index is keyed on it. The previous check resolved the artifact's media
item, which cannot work for a folder artifact — it has no media.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from media_summarizer.api.dependencies.auth import get_current_user
from media_summarizer.core.models.auth import AuthUser
from media_summarizer.core.models.media_artifact import ArtifactScope, MediaArtifactStatus
from media_summarizer.core.services import budget_guard, engagement_service
from media_summarizer.core.services.artifact_service import (
    INTERNAL_ARTIFACT_TYPES,
    ArtifactGenerationDisabledError,
    ArtifactGenerationOutcome,
    ArtifactParametersInvalidError,
    ArtifactScopeEmptyError,
    ArtifactScopeTooLargeError,
    ArtifactTypeNotEnabledError,
    commit_artifact_generation,
    enforce_scope_ceilings,
    get_media_artifact_record,
    list_scope_artifacts,
    plan_artifact_generation,
    request_parameters_of,
    resolve_request_options,
    resolve_scope_sources,
    resolve_source_selection,
)
from media_summarizer.core.services.budget_guard import BudgetRefusedError
from media_summarizer.utils import s3
from media_summarizer.utils.language_codes import normalize_language_code
from media_summarizer.utils.logging_config import bind_log_context, log_event, reset_log_context

router = APIRouter()
logger = logging.getLogger(__name__)

DEFAULT_LIST_LIMIT = 50
MAX_LIST_LIMIT = 100

#: The two reasons ``GET /artifacts/{id}/content`` has nothing to hand back, told
#: apart in the contract rather than in the prose of a message (task-328). A
#: client polls on the first and stops on the second: ``queued``/``generating``
#: resolves on its own, whereas ``failed`` is terminal — no worker will pick the
#: entry up again unless someone asks for a new generation.
CONTENT_NOT_READY_ERROR_CODE = "artifact_not_ready"
CONTENT_FAILED_ERROR_CODE = "artifact_failed"

#: A ``POST /artifacts`` whose ``parameters`` cannot be honoured (task-531). The
#: refusal names the key in ``parameter`` and why in ``reason`` — an unknown key, a
#: key the client may not set, an option the type (or, for ``source_ids``, the
#: scope) does not take, a value outside its list (a ``language`` that is not a
#: reading language, task-533), a selected source that is not in the folder
#: (task-532) — so a client tells its own bug apart from a contract it misread.
INVALID_PARAMETERS_ERROR_CODE = "invalid_artifact_parameters"

# One message per outcome: a log line that says "queued" for a reuse would hide
# exactly the fact this endpoint is now built around.
_CREATE_LOG_MESSAGES = {
    ArtifactGenerationOutcome.CREATED: "Artifact generation queued",
    ArtifactGenerationOutcome.RETRIED: "Failed artifact reclaimed and requeued",
    ArtifactGenerationOutcome.REUSED: "Existing artifact reused, nothing queued",
    ArtifactGenerationOutcome.COLLAPSED: "Concurrent identical request collapsed",
}


class ArtifactCreateRequest(BaseModel):
    scope: str = Field(..., description="Scope of the generation: 'media' or 'folder'")
    scope_id: str = Field(..., description="Media item id, or folder id")
    artifact_type: str = Field(
        ...,
        description="Type of artifact: summary_short, notes, quiz, flashcards",
    )
    parameters: Optional[dict] = Field(
        default=None,
        description=(
            "Generation options (task-531): 'length' (summary_short: short, medium, "
            "long), 'count' (quiz, flashcards: fewer, standard, more), 'difficulty' "
            "(quiz, flashcards: easy, medium, hard), 'focus' (every type: free text, "
            "300 characters at most), 'language' (every type, task-533: one of the "
            "reading languages; defaults to the reader's, and another one is kept "
            "as is and never translated), 'source_ids' (folder scope, every type: a "
            "non-empty list of distinct media ids of the folder, task-532). Anything "
            "else is refused with a 422."
        ),
    )

    @field_validator("artifact_type")
    @classmethod
    def _reject_internal_type(cls, value: str) -> str:
        """An internal type is not a request anyone may make.

        Rejected at the request boundary rather than in the service: this endpoint
        is where the quota is debited and the entitlement checked, so naming an
        internal type here would otherwise get as far as spending a user's
        allowance on an artifact no screen will ever show them.

        Only internal types are rejected here. A typo or an unknown type keeps its
        existing 400 from ``ArtifactTypeNotEnabledError`` — turning those into 422s
        would change the contract of every existing client for no reason.
        """
        if value.strip() in {
            artifact_type.value for artifact_type in INTERNAL_ARTIFACT_TYPES
        }:
            raise ValueError(
                f"'{value}' is generated by the backend and cannot be requested"
            )
        return value


class ArtifactSourceResponse(BaseModel):
    media_item_id: str
    title: Optional[str] = None
    language: Optional[str] = None
    excluded: bool = False
    excluded_reason: Optional[str] = None


class ArtifactSummaryResponse(BaseModel):
    """One history row. These are exactly the attributes the GSI projects."""

    artifact_id: str
    artifact_type: str
    status: str
    title: Optional[str] = None
    source_count: int
    created_at: str
    completed_at: Optional[str] = None
    error_code: Optional[str] = None


class ArtifactDetailResponse(ArtifactSummaryResponse):
    scope: str
    scope_id: str
    sources: List[ArtifactSourceResponse] = Field(default_factory=list)
    s3_key: Optional[str] = None
    request_parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "The 'parameters' of a POST /api/artifacts that asks for this entry "
            "again (task-535): its options, its language when the request pinned "
            "one, its chosen sources as 'source_ids'. Empty for an entry at the "
            "defaults. What a client sends to rerun a failed entry unchanged."
        ),
    )


class ArtifactCreateResponse(ArtifactDetailResponse):
    """The answer to a generation request, plus what the request actually did.

    ``generation_outcome`` exists because the four cases are not interchangeable
    and a client that only saw the entry could not tell them apart:

    - ``created`` — a generation was queued for these sources.
    - ``retried`` — a previously failed entry for the same sources was rerun.
    - ``reused`` — a generation already covered these sources, so nothing was
      queued. The normal answer for a second request on a media item, for a folder
      whose sources have not changed, and — since task-394 — for the first request
      of an account over content another account already generated this artifact
      for. It says nothing about the allowance: only an entry this account already
      held consumes none of it.
    - ``collapsed`` — two concurrent taps, and this one lost the write; the entry
      returned is the one already in flight.
    """

    generation_outcome: str


class ArtifactListResponse(BaseModel):
    scope: str
    scope_id: str
    artifacts: List[ArtifactSummaryResponse]
    next_cursor: Optional[str] = None


class ArtifactContentResponse(BaseModel):
    artifact_id: str
    artifact_type: str
    scope: str
    scope_id: str
    status: str
    language: Optional[str] = Field(
        ..., description="Stored output language of this generation, independent of the profile"
    )
    content: Dict[str, Any] = Field(
        ..., description="Parsed JSON content of the artifact (summary, notes, quiz, flashcards)"
    )


def _parse_scope(value: str) -> ArtifactScope:
    try:
        return ArtifactScope(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope must be 'media' or 'folder'",
        )


def _summary(record: Any) -> ArtifactSummaryResponse:
    return ArtifactSummaryResponse(
        artifact_id=record.artifact_id,
        artifact_type=record.artifact_type.value,
        status=record.status.value,
        title=record.title,
        source_count=record.source_count,
        created_at=record.created_at.isoformat(),
        completed_at=record.completed_at.isoformat() if record.completed_at else None,
        error_code=record.error_code,
    )


def _detail(record: Any) -> ArtifactDetailResponse:
    return ArtifactDetailResponse(
        **_summary(record).model_dump(),
        scope=record.scope.value,
        scope_id=record.scope_id,
        sources=[
            ArtifactSourceResponse(
                media_item_id=source.media_item_id,
                title=source.title,
                language=source.language,
                excluded=source.excluded,
                excluded_reason=source.excluded_reason,
            )
            for source in record.sources
        ],
        s3_key=record.storage.key if record.storage is not None else None,
        request_parameters=request_parameters_of(record),
    )


async def _assert_scope_owned(
    *,
    scope: ArtifactScope,
    scope_id: str,
    user_id: str,
) -> str:
    from media_summarizer.utils import database_async
    from media_summarizer.utils import user_media as user_media_store

    if scope == ArtifactScope.MEDIA:
        record = await user_media_store.get_user_media(user_id, scope_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found"
            )
        return record.media_key

    folder = await database_async.get_folder_by_id(scope_id)
    if folder is None or folder.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found"
        )
    return scope_id


@router.post(
    "/artifacts",
    response_model=ArtifactCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_artifact(
    payload: ArtifactCreateRequest,
    request: Request,
    response: Response,
    current_user: AuthUser = Depends(get_current_user),
):
    """Request a generation over a scope.

    Not every request generates: an artifact already covering the same set of
    sources answers as-is (task-316 owner decision), which is why a media item
    yields one artifact per type for good and a folder only regenerates once
    its sources have changed. Since task-394 that also holds *across accounts* for a
    media scope — the second account to ask for the same type in the same language
    over the same content is served by the generation the first one paid for.

    What decides the debit is therefore not whether a generation ran, but whether
    this account gains an entry it did not have. It is charged for an artifact
    another account's generation answers: the request was honoured, the account now
    holds the artifact, and the avoided provider call is the operator's saving rather
    than free allowance. Only an entry the account *already holds* consumes nothing.

    The order of the checks still matters, for the other reason: a denied request must
    leave no entry, so the quota is checked after planning and before the write
    (task-269 §10.3).
    """
    scope = _parse_scope((payload.scope or "").strip().lower())
    artifact_type = (payload.artifact_type or "").strip().lower()
    scope_id = (payload.scope_id or "").strip()
    token = bind_log_context(
        user_id=current_user.id,
        scope=scope.value,
        scope_id=scope_id,
        artifact_type=artifact_type,
    )
    try:
        # First, before any read: a request whose options cannot be honoured is
        # refused without resolving a single transcript, and therefore without an
        # entry or a debit.
        options = resolve_request_options(
            artifact_type=artifact_type, parameters=payload.parameters
        )
        source_ids = resolve_source_selection(scope=scope, parameters=payload.parameters)

        content_scope_id = await _assert_scope_owned(
            scope=scope, scope_id=scope_id, user_id=current_user.id
        )

        # A selection is checked against the folder here, once it is listed and
        # before any transcript is read: an id that is not one of its media is the
        # same typed 422 as a malformed option. Everything after — ceilings, ids,
        # the minutes checked and debited — counts the chosen sources only.
        resolution = await resolve_scope_sources(
            user_id=current_user.id,
            scope=scope,
            scope_id=scope_id,
            reading_language=current_user.reading_language,
            source_ids=source_ids,
        )
        enforce_scope_ceilings(resolution)

        plan = await plan_artifact_generation(
            user_id=current_user.id,
            scope=scope,
            scope_id=scope_id,
            content_scope_id=content_scope_id,
            artifact_type=artifact_type,
            resolution=resolution,
            options=options,
        )

        # The budget comes after planning and before the write: an account already
        # holding this entry asks for nothing new, and a refused request must
        # leave no entry behind. This only refuses a month with nothing left: the
        # generation is admitted by the worker, from the request it is about to
        # send (task-549, rules 1 and 4 of the task-547 decision).
        if not plan.already_owned:
            try:
                await budget_guard.precheck(current_user.id)
            except BudgetRefusedError as refusal:
                log_event(
                    logger,
                    logging.WARNING,
                    "artifact.create.budget_refused",
                    "Artifact generation refused by the beta budget",
                    error_code=refusal.error_code,
                )
                raise HTTPException(
                    status_code=refusal.http_status,
                    detail=refusal.error_body(),
                    headers=refusal.headers(),
                ) from refusal

        record, outcome = await commit_artifact_generation(plan)

        if outcome in (
            ArtifactGenerationOutcome.REUSED,
            ArtifactGenerationOutcome.COLLAPSED,
        ):
            # Nothing was queued, so nothing is charged: the generation's provider
            # call is what the budget pays for, and a reuse makes none (R.2).
            response.status_code = status.HTTP_200_OK

        # E1 of task-303: launching a generation is the strongest intent signal the
        # app has, and the wait is precisely when the user needs a way back — so the
        # scope enters "Continue learning" here, reuse included (the user asked, and
        # that is what the signal measures). The ownership assertion above is what
        # lets this skip its own check. Swallows everything by contract: a recency
        # stamp must never fail a generation the user asked for.
        # `ArtifactScope` and the engagement kinds are the same two words
        # (`media`, `folder`), so the scope *is* the kind.
        await engagement_service.stamp(
            user_id=current_user.id,
            kind=scope.value,
            subject_id=scope_id,
        )

        log_event(
            logger,
            logging.INFO,
            "artifact.create.requested",
            _CREATE_LOG_MESSAGES[outcome],
            artifact_id=record.artifact_id,
            artifact_type=artifact_type,
            source_count=record.source_count,
            generation_outcome=outcome.value,
        )
        return ArtifactCreateResponse(
            **_detail(record).model_dump(),
            generation_outcome=outcome.value,
        )

    except ArtifactTypeNotEnabledError as exc:
        log_event(
            logger,
            logging.WARNING,
            "artifact.create.invalid_type",
            "Invalid artifact type requested",
            artifact_type=artifact_type,
            error_code="INVALID_ARTIFACT_TYPE",
            error_message=str(exc),
        )
        # The exception names the internal enum member and the scope it was aimed
        # at — a developer's sentence about a caller's mistake, and one no reader
        # can act on. It stays in the log line above (task-397).
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_ARTIFACT_TYPE",
                "message": "This kind of artifact cannot be generated",
            },
        )
    except ArtifactGenerationDisabledError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Artifact generation is currently disabled",
        )
    except ArtifactParametersInvalidError as exc:
        log_event(
            logger,
            logging.WARNING,
            "artifact.create.invalid_parameters",
            "Artifact requested with options it cannot carry",
            artifact_type=artifact_type,
            parameter=exc.parameter,
            reason=exc.reason,
            error_code=INVALID_PARAMETERS_ERROR_CODE,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": INVALID_PARAMETERS_ERROR_CODE,
                "message": str(exc),
                "parameter": exc.parameter,
                "reason": exc.reason,
            },
        )
    except ArtifactScopeEmptyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "scope_empty",
                "message": str(exc),
            },
        )
    except ArtifactScopeTooLargeError as exc:
        # The four numbers travel with the refusal so the mobile has nothing to
        # compute to render it (task-272 AC#9).
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "scope_too_large",
                "message": str(exc),
                "source_count": exc.source_count,
                "max_sources": exc.max_sources,
                "estimated_tokens": exc.estimated_tokens,
                "max_tokens": exc.max_tokens,
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "artifact.create.failed",
            "Failed to queue artifact generation",
            scope=scope.value,
            scope_id=scope_id,
            artifact_type=artifact_type,
            error_type=type(exc).__name__,
            error_code="ARTIFACT_CREATE_FAILED",
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue artifact generation",
        )
    finally:
        reset_log_context(token)


@router.get("/artifacts", response_model=ArtifactListResponse)
async def list_artifacts(
    request: Request,
    scope: str = Query(..., description="'media' or 'folder'"),
    scope_id: str = Query(..., description="Media item id, or folder id"),
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=MAX_LIST_LIMIT),
    cursor: Optional[str] = Query(None),
    current_user: AuthUser = Depends(get_current_user),
):
    """A scope's whole history, newest first, every type mixed.

    This is also the progress endpoint: in-flight entries appear here with status
    ``queued`` or ``generating``, so the mobile polls once per scope rather than
    once per artifact type.

    Listing an existing entry never translates or regenerates it. The media's
    saved language and every artifact's output language survive profile changes.
    """
    resolved_scope = _parse_scope((scope or "").strip().lower())
    token = bind_log_context(
        user_id=current_user.id, scope=resolved_scope.value, scope_id=scope_id
    )
    try:
        content_scope_id = await _assert_scope_owned(
            scope=resolved_scope, scope_id=scope_id, user_id=current_user.id
        )

        records, next_cursor = await list_scope_artifacts(
            user_id=current_user.id,
            scope=resolved_scope,
            scope_id=scope_id,
            content_scope_id=content_scope_id,
            limit=limit,
            cursor=cursor,
        )

        log_event(
            logger,
            logging.INFO,
            "artifact.list.succeeded",
            "Artifact history retrieved",
            scope=resolved_scope.value,
            scope_id=scope_id,
            artifact_count=len(records),
        )

        return ArtifactListResponse(
            scope=resolved_scope.value,
            scope_id=scope_id,
            artifacts=[_summary(record) for record in records],
            next_cursor=next_cursor,
        )

    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "artifact.list.failed",
            "Failed to list artifacts",
            scope=resolved_scope.value,
            scope_id=scope_id,
            error_type=type(exc).__name__,
            error_code="ARTIFACT_LIST_FAILED",
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list artifacts",
        )
    finally:
        reset_log_context(token)


@router.get("/artifacts/{artifact_id}", response_model=ArtifactDetailResponse)
async def get_artifact(
    artifact_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
):
    """One entry with its full source snapshot."""
    token = bind_log_context(user_id=current_user.id, artifact_id=artifact_id)
    try:
        record = await get_media_artifact_record(artifact_id)
        if record is None or record.user_id != current_user.id:
            log_event(
                logger,
                logging.WARNING,
                "artifact.get.not_found",
                "Artifact not found",
                artifact_id=artifact_id,
                error_code="ARTIFACT_NOT_FOUND",
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

        log_event(
            logger,
            logging.INFO,
            "artifact.get.succeeded",
            "Artifact retrieved",
            artifact_id=artifact_id,
            artifact_type=record.artifact_type.value,
            scope=record.scope.value,
            scope_id=record.scope_id,
            status=record.status.value,
        )
        return _detail(record)

    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "artifact.get.failed",
            "Failed to retrieve artifact",
            artifact_id=artifact_id,
            error_type=type(exc).__name__,
            error_code="ARTIFACT_GET_FAILED",
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve artifact",
        )
    finally:
        reset_log_context(token)


@router.get("/artifacts/{artifact_id}/content", response_model=ArtifactContentResponse)
async def get_artifact_content(
    artifact_id: str,
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
):
    """Return the JSON payload an artifact resolved to.

    The worker pipeline writes each artifact as a JSON blob in its dedicated
    S3 bucket (one bucket per artifact type). This endpoint resolves the
    record, verifies ownership, downloads the blob and inlines the parsed
    content in the response so the mobile client doesn't need to deal with
    presigned URLs.

    An entry with no payload answers ``409`` with a typed refusal, and the type is
    what separates the two cases a client has to treat differently:
    ``artifact_not_ready`` for an entry still being produced, ``artifact_failed``
    for one that has terminally failed. Neither is readable from the message text,
    on purpose (task-328).

    Side-effect-free, and it must stay that way: the "artifact opened" engagement
    (task-303 §5.2) is reported by an explicit ``POST /api/engagements`` from the
    viewer, not stamped here. This route is replayed by the client after a 401
    refresh and can be run by a router preload for a screen the user never opens, so
    a write on this path would record engagements nobody made.
    """
    token = bind_log_context(user_id=current_user.id, artifact_id=artifact_id)
    try:
        record = await get_media_artifact_record(artifact_id)
        if record is None or record.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Artifact not found",
            )

        if record.status is MediaArtifactStatus.FAILED:
            # Terminal, and said as such: nothing is running any more, so telling
            # the caller to come back once generation completes would describe a
            # completion that will never happen and keep a client polling an entry
            # that can only ever answer this. What a new generation needs travels
            # with the refusal, so the failure state can offer one without a
            # second round-trip: the scope, the type, and the parameters the entry
            # was asked with, so that the new request reruns this very entry
            # instead of the one at the defaults (task-535).
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": CONTENT_FAILED_ERROR_CODE,
                    "message": (
                        "Artifact generation failed and will not resume on its "
                        "own. Request a new generation for this scope and type."
                    ),
                    "status": record.status.value,
                    "artifact_error_code": record.error_code,
                    "scope": record.scope.value,
                    "scope_id": record.scope_id,
                    "artifact_type": record.artifact_type.value,
                    "request_parameters": request_parameters_of(record),
                },
            )

        if record.storage is None:
            # Still being produced (queued / generating): this one does resolve on
            # its own, so coming back later is the right advice here and only here.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": CONTENT_NOT_READY_ERROR_CODE,
                    "message": (
                        f"Artifact is still being generated (status: "
                        f"{record.status.value}). Try again once generation completes."
                    ),
                    "status": record.status.value,
                },
            )

        try:
            payload_bytes = await s3.download_file_to_memory(
                bucket=record.storage.bucket,
                key=record.storage.key,
            )
        except Exception as exc:
            log_event(
                logger,
                logging.ERROR,
                "artifact.content.download_failed",
                "Failed to download artifact payload from S3",
                artifact_id=artifact_id,
                bucket=record.storage.bucket,
                key=record.storage.key,
                error_type=type(exc).__name__,
                error_code="ARTIFACT_CONTENT_DOWNLOAD_FAILED",
                exc_info=exc,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Artifact storage is currently unreachable",
            )

        try:
            content = json.loads(payload_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            log_event(
                logger,
                logging.ERROR,
                "artifact.content.parse_failed",
                "Failed to parse artifact payload as JSON",
                artifact_id=artifact_id,
                error_type=type(exc).__name__,
                error_code="ARTIFACT_CONTENT_PARSE_FAILED",
                exc_info=exc,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Artifact payload is malformed",
            )

        if not isinstance(content, dict):
            content = {"value": content}

        log_event(
            logger,
            logging.INFO,
            "artifact.content.succeeded",
            "Artifact content retrieved",
            artifact_id=artifact_id,
            artifact_type=record.artifact_type.value,
            scope=record.scope.value,
            scope_id=record.scope_id,
            content_size=len(payload_bytes),
        )

        return ArtifactContentResponse(
            artifact_id=record.artifact_id,
            artifact_type=record.artifact_type.value,
            scope=record.scope.value,
            scope_id=record.scope_id,
            status=record.status.value,
            language=normalize_language_code(record.parameters.get("language")),
            content=content,
        )

    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "artifact.content.failed",
            "Failed to retrieve artifact content",
            artifact_id=artifact_id,
            error_type=type(exc).__name__,
            error_code="ARTIFACT_CONTENT_FAILED",
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve artifact content",
        )
    finally:
        reset_log_context(token)
