"""Explicit activity on artifacts and conversations, and the recent target list.

GETs are side-effect-free. Only user-requested generations, accepted chat turns
and explicit client POSTs record activity; reads and background completions do not.
"""

from __future__ import annotations

import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from media_summarizer.api.dependencies.auth import get_current_user
from media_summarizer.core.models.auth import AuthUser
from media_summarizer.core.services import engagement_service
from media_summarizer.core.services.engagement_service import (
    DEFAULT_RECENT_LIMIT,
    MAX_RECENT_LIMIT,
    EngagementSubjectNotFoundError,
)
from media_summarizer.utils.logging_config import bind_log_context, log_event, reset_log_context

router = APIRouter()
logger = logging.getLogger(__name__)


class EngagementCreateRequest(BaseModel):
    kind: Literal["artifact", "conversation"] = Field(..., description="The artifact or conversation opened")
    id: str = Field(..., description="Artifact id or conversation id")


class RecentEngagementResponse(BaseModel):
    """One target with current title, state and accessible parent metadata."""

    kind: Literal["artifact", "conversation"]
    id: str
    scope: Literal["media", "folder"]
    scope_id: str
    title: Optional[str] = None
    artifact_type: Optional[str] = None
    state: Literal["pending", "ready", "failed"]
    engaged_at: str
    scope_title: Optional[str] = None
    scope_title_label_key: Optional[str] = None
    scope_created_at: Optional[str] = None
    creator_name: Optional[str] = None
    image_url: Optional[str] = None
    media_type: Optional[str] = None
    item_count: Optional[int] = None
    preview_images: List[str] = Field(default_factory=list)


class RecentEngagementListResponse(BaseModel):
    status: str = "success"
    items: List[RecentEngagementResponse]


@router.post("/engagements", status_code=status.HTTP_204_NO_CONTENT)
async def create_engagement(
    payload: EngagementCreateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    """Record that the user just opened and read one artifact.

    Answers ``204`` even when the underlying write is refused or fails: a 4xx here is
    reserved for a subject that is not the caller's. The client fires this without
    awaiting it, so nothing about the artifact it is reading can depend on the answer.
    """
    token = bind_log_context(user_id=current_user.id, kind=payload.kind, subject_id=payload.id)
    try:
        await engagement_service.record_engagement(
            user_id=current_user.id,
            kind=payload.kind,
            subject_id=payload.id,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except EngagementSubjectNotFoundError as exc:
        # The exception distinguishes "unknown kind" from "not the caller's" — a
        # distinction about our data model that nobody reads: the client fires this
        # without awaiting it, so the answer never reaches a screen (task-397).
        logger.warning(f"Rejected engagement: {exc}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "engagement.stamp_failed",
            "Could not record an engagement",
            user_id=current_user.id,
            kind=payload.kind,
            subject_id=payload.id,
            error_type=type(exc).__name__,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    finally:
        reset_log_context(token)


@router.get("/engagements/recent", response_model=RecentEngagementListResponse)
async def list_recent_engagements(
    limit: int = Query(DEFAULT_RECENT_LIMIT, ge=1, le=MAX_RECENT_LIMIT),
    current_user: AuthUser = Depends(get_current_user),
) -> RecentEngagementListResponse:
    """The "Continue learning" row: artifacts and conversations merged, newest first.

    An empty list is a normal answer, not a degraded one — a brand-new account has
    engaged with nothing, and a row whose entries all aged out of the freshness
    window empties itself. The client hides the section.
    """
    token = bind_log_context(user_id=current_user.id)
    try:
        entries = await engagement_service.list_recent(current_user.id, limit=limit)
        log_event(
            logger,
            logging.INFO,
            "engagement.recent.succeeded",
            "Recent engagements retrieved",
            item_count=len(entries),
        )
        return RecentEngagementListResponse(
            status="success",
            items=[RecentEngagementResponse(**entry.to_dict()) for entry in entries],
        )
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "engagement.recent.failed",
            "Failed to retrieve recent engagements",
            error_type=type(exc).__name__,
            error_code="ENGAGEMENT_RECENT_FAILED",
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recent engagements",
        )
    finally:
        reset_log_context(token)
