"""Cognito user authentication and independently scoped extension authorization."""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from media_summarizer.core.models.auth import AuthUser, TokenType
from media_summarizer.core.services import cognito_auth
from media_summarizer.utils import database_async
from media_summarizer.utils.database_async import DynamoDBConnection, get_db

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
EXTENSION_ROUTES = frozenset(
    {
        ("POST", "/api/media/ingest-url"),
        ("POST", "/api/media/ingest-shared-content"),
        ("GET", "/api/folders"),
        ("POST", "/api/auth/logout"),
    }
)


async def get_current_user(
    request: Request, token: Optional[str] = Depends(oauth2_scheme), db: DynamoDBConnection = Depends(get_db)
) -> AuthUser:
    if not token:
        raise cognito_auth.refuse("INVALID_CREDENTIALS", 401)
    if token.startswith("ext_a_"):
        grant = await database_async.get_auth_token_by_token(token)
        if grant is None or grant.token_type != TokenType.ACCESS_TOKEN or not grant.is_valid():
            raise cognito_auth.refuse("INVALID_CREDENTIALS", 401)
        parent = await database_async.get_auth_token_by_id(grant.lineage_id)
        if parent is None or parent.token_type != TokenType.REFRESH_TOKEN or not parent.is_valid() or parent.user_id != grant.user_id:
            raise cognito_auth.refuse("INVALID_CREDENTIALS", 401)
        if (request.method, request.url.path.rstrip("/")) not in EXTENSION_ROUTES:
            raise HTTPException(status_code=403, detail="This token cannot be used here")
        user = await database_async.get_user_by_id(grant.user_id)
        if user is None or not user.cognito_sub:
            raise cognito_auth.refuse("INVALID_CREDENTIALS", 401)
    else:
        user = await cognito_auth.profile(token)
    request.state.user_id = user.id
    return AuthUser.from_user(user)


async def get_optional_user(
    request: Request, token: Optional[str] = Depends(oauth2_scheme), db: DynamoDBConnection = Depends(get_db)
) -> Optional[AuthUser]:
    if not token:
        return None
    try:
        return await get_current_user(request, token, db)
    except HTTPException:
        return None


async def require_user_access(resource_user_id: str, current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """
    Require that the current user has access to a specific user's resources.

    This ensures that users can only access their own data.

    Args:
        resource_user_id: The user ID of the resource being accessed
        current_user: The current authenticated user

    Returns:
        The current user if access is allowed

    Raises:
        HTTPException: If the user doesn't have access to the resource
    """
    if current_user.id != resource_user_id:
        logger.warning(f"User {current_user.id} attempted to access resources for user {resource_user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only access your own resources",
        )

    return current_user


# Every Cognito profile requires a verified email before it is provisioned.
require_verified_email = get_current_user


RequireAuth = Depends(get_current_user)
OptionalAuth = Depends(get_optional_user)
