"""
In-app digest API endpoints.

Provides:
- GET /api/digest/daily - get daily digest for the authenticated user
- GET /api/digest/weekly - get weekly digest for the authenticated user
- GET /api/digest/settings - get user digest settings
- PATCH /api/digest/settings - update user digest settings (toggle on/off)
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from media_summarizer.api.dependencies.auth import get_current_user
from media_summarizer.core.models.auth import AuthUser
from media_summarizer.core.models.digest import DigestType
from media_summarizer.core.services import digest_service
from media_summarizer.utils import user_media
from media_summarizer.utils.logging_config import bind_log_context, log_event, reset_log_context

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------- Request/Response Models ----------


class DigestResponse(BaseModel):
    """A digest as the client consumes it: which period, and which media.

    The whole payload is an ordered list of media ids, because the client renders
    the media page of each one. Anything this response could say about a media
    (its title, its cover, an excerpt of a summary) that page already says, from
    ``GET /api/media/{id}`` — and would say better, since it cannot go stale
    against a rename.
    """

    digest_type: str
    period_key: str
    #: The media of the period, oldest first.
    media_item_ids: List[str]


class DigestSettingsResponse(BaseModel):
    user_id: str
    digest_enabled: bool
    daily_digest_enabled: bool
    weekly_digest_enabled: bool


class DigestSettingsUpdateRequest(BaseModel):
    digest_enabled: Optional[bool] = None
    daily_digest_enabled: Optional[bool] = None
    weekly_digest_enabled: Optional[bool] = None


# ---------- Endpoints ----------


@router.get("/digest/daily", response_model=DigestResponse)
async def get_daily_digest(
    current_user: AuthUser = Depends(get_current_user),
):
    """Read the current local day, independently of notification times."""
    token = bind_log_context(user_id=current_user.id)
    try:
        digest = await digest_service.get_current_digest(
            current_user.id, DigestType.DAILY, iana_timezone=current_user.iana_timezone
        )

        visible = await user_media.visible_media_ids(
            current_user.id, [item.media_item_id for item in digest.media_items]
        )
        media_ids = [item.media_item_id for item in digest.media_items if item.media_item_id in visible]

        log_event(
            logger,
            logging.INFO,
            "digest.daily.retrieved",
            "Daily digest retrieved",
            user_id=current_user.id,
            period_key=digest.period_key,
            item_count=len(media_ids),
        )

        return DigestResponse(
            digest_type=digest.digest_type.value,
            period_key=digest.period_key,
            media_item_ids=media_ids,
        )

    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "digest.daily.failed",
            "Failed to retrieve daily digest",
            user_id=current_user.id,
            error_type=type(exc).__name__,
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve daily digest",
        )
    finally:
        reset_log_context(token)


@router.get("/digest/weekly", response_model=DigestResponse)
async def get_weekly_digest(
    current_user: AuthUser = Depends(get_current_user),
):
    """Read the current local ISO week, independently of notification times."""
    token = bind_log_context(user_id=current_user.id)
    try:
        digest = await digest_service.get_current_digest(
            current_user.id, DigestType.WEEKLY, iana_timezone=current_user.iana_timezone
        )

        visible = await user_media.visible_media_ids(
            current_user.id, [item.media_item_id for item in digest.media_items]
        )
        media_ids = [item.media_item_id for item in digest.media_items if item.media_item_id in visible]

        log_event(
            logger,
            logging.INFO,
            "digest.weekly.retrieved",
            "Weekly digest retrieved",
            user_id=current_user.id,
            period_key=digest.period_key,
            item_count=len(media_ids),
        )

        return DigestResponse(
            digest_type=digest.digest_type.value,
            period_key=digest.period_key,
            media_item_ids=media_ids,
        )

    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "digest.weekly.failed",
            "Failed to retrieve weekly digest",
            user_id=current_user.id,
            error_type=type(exc).__name__,
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve weekly digest",
        )
    finally:
        reset_log_context(token)


@router.get("/digest/settings", response_model=DigestSettingsResponse)
async def get_digest_settings(
    current_user: AuthUser = Depends(get_current_user),
):
    """Get digest settings for the authenticated user."""
    token = bind_log_context(user_id=current_user.id)
    try:
        settings = await digest_service.get_user_digest_settings(current_user.id)
        return DigestSettingsResponse(
            user_id=settings.user_id,
            digest_enabled=settings.digest_enabled,
            daily_digest_enabled=settings.daily_digest_enabled,
            weekly_digest_enabled=settings.weekly_digest_enabled,
        )
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "digest.settings.get.failed",
            "Failed to get digest settings",
            user_id=current_user.id,
            error_type=type(exc).__name__,
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get digest settings",
        )
    finally:
        reset_log_context(token)


@router.patch("/digest/settings", response_model=DigestSettingsResponse)
async def update_digest_settings(
    payload: DigestSettingsUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
):
    """Update digest settings for the authenticated user (toggle digest on/off)."""
    token = bind_log_context(user_id=current_user.id)
    try:
        settings = await digest_service.update_user_digest_settings(
            current_user.id,
            digest_enabled=payload.digest_enabled,
            daily_digest_enabled=payload.daily_digest_enabled,
            weekly_digest_enabled=payload.weekly_digest_enabled,
        )

        log_event(
            logger,
            logging.INFO,
            "digest.settings.updated",
            "Digest settings updated",
            user_id=current_user.id,
            digest_enabled=settings.digest_enabled,
            daily_digest_enabled=settings.daily_digest_enabled,
            weekly_digest_enabled=settings.weekly_digest_enabled,
        )

        return DigestSettingsResponse(
            user_id=settings.user_id,
            digest_enabled=settings.digest_enabled,
            daily_digest_enabled=settings.daily_digest_enabled,
            weekly_digest_enabled=settings.weekly_digest_enabled,
        )

    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "digest.settings.update.failed",
            "Failed to update digest settings",
            user_id=current_user.id,
            error_type=type(exc).__name__,
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update digest settings",
        )
    finally:
        reset_log_context(token)
