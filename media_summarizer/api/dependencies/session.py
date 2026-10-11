"""
Session transport: where the refresh token travels, mobile body or web cookie.

The mobile app keeps its refresh token in its secure store and sends it in the JSON
body. The web app (task-473) cannot hold a refresh token safely in a browser, so for
it the token lives in a cookie its scripts cannot read:
``HttpOnly; Secure; SameSite=Strict; Path=/api/auth``, host-only on ``api.<domain>``.
The web app keeps only the access token, in memory.

A request opts into the web mode with the header ``X-Session-Transport: cookie``. A
header rather than a body field because /refresh and /logout carry no body in web
mode, and because a custom header cannot be sent cross-site without a CORS
preflight: a page on another origin can neither forge a cookie-authenticated
/refresh nor read its answer. ``SameSite=Strict`` is the second lock on the same
door.

The mode chosen at sign-in fixes the lineage kind: web mode opens a ``browser``
lineage, capped in time; the body mode opens a ``mobile`` one. Each transport only
accepts the lineages it opened, so a browser refresh token can never be replayed
through the body, nor a mobile one through the cookie.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from media_summarizer.core.models import User
from media_summarizer.core.models.auth import (
    AuthToken,
    AuthUser,
    LineageKind,
    TokenVerificationResponse,
    WebSessionResponse,
)
from media_summarizer.utils import database_async
from media_summarizer.utils.auth_utils import (
    access_token_payload,
    create_access_token,
    get_access_token_expires_seconds,
    get_refresh_token_expires_at,
)

SESSION_TRANSPORT_HEADER = "X-Session-Transport"
COOKIE_TRANSPORT = "cookie"

# ``__Secure-`` makes the browser refuse the cookie unless it is Secure and set over
# HTTPS. ``__Host-`` would also forbid a Domain attribute, but it requires Path=/,
# and the cookie must only ride on /api/auth requests.
REFRESH_COOKIE_NAME = "__Secure-refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"


def is_web_session(request: Request) -> bool:
    """Whether the caller asked for the web (cookie) transport."""
    return (
        request.headers.get(SESSION_TRANSPORT_HEADER, "").strip().lower()
        == COOKIE_TRANSPORT
    )


def lineage_kind_for(request: Request) -> LineageKind:
    """Kind of the lineage a sign-in on this request opens."""
    return LineageKind.BROWSER if is_web_session(request) else LineageKind.MOBILE


def presented_refresh_token(request: Request, body_token: Optional[str]) -> str:
    """The refresh token of the request: the cookie in web mode, the body otherwise."""
    token = request.cookies.get(REFRESH_COOKIE_NAME) if is_web_session(request) else body_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    return token


def transport_accepts(request: Request, token: AuthToken) -> bool:
    """Whether this transport may present a token of this lineage kind."""
    return (token.lineage_kind == LineageKind.BROWSER) == is_web_session(request)


def _set_refresh_cookie(response: JSONResponse, value: str, expires_at: datetime) -> None:
    max_age = max(0, int((expires_at - datetime.now(timezone.utc)).total_seconds()))
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=value,
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )


def clear_refresh_cookie(response: JSONResponse) -> None:
    """Drop the refresh cookie; attributes must match the ones it was set with."""
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )


def session_response(
    request: Request,
    *,
    access_token: str,
    expires_in: int,
    user: Dict[str, Any],
    refresh_token: str,
    refresh_expires_at: datetime,
    status_code: int = status.HTTP_200_OK,
) -> Union[TokenVerificationResponse, JSONResponse]:
    """The answer of every route that opens or rotates a session.

    Mobile gets both tokens in the body. Web gets the access token in the body and
    the refresh token in the cookie, and nothing else.
    """
    if not is_web_session(request):
        return TokenVerificationResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=expires_in,
            user=user,
        )
    body = WebSessionResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=user,
    )
    response = JSONResponse(content=body.model_dump(), status_code=status_code)
    _set_refresh_cookie(response, refresh_token, refresh_expires_at)
    return response


async def open_session(
    http_request: Request, user: User, status_code: int = status.HTTP_200_OK
) -> Union[TokenVerificationResponse, JSONResponse]:
    """Open a new device-session lineage for ``user`` and answer with its tokens.

    Shared by every sign-in route, local and social: the transport of the request
    decides the lineage kind and where the refresh token goes.
    """
    kind = lineage_kind_for(http_request)
    refresh = AuthToken.create_refresh_token(
        user_id=user.id,
        email=user.email,
        expires_at=get_refresh_token_expires_at(kind),
        lineage_kind=kind,
    )
    refresh = await database_async.create_auth_token(refresh)

    access_seconds = get_access_token_expires_seconds()
    access_token = create_access_token(
        data=access_token_payload(user.id, user.email, kind),
        expires_delta=timedelta(seconds=access_seconds),
    )
    return session_response(
        http_request,
        access_token=access_token,
        expires_in=access_seconds,
        user=AuthUser.from_user(user).model_dump(),
        refresh_token=refresh.token,
        refresh_expires_at=refresh.expires_at,
        status_code=status_code,
    )
