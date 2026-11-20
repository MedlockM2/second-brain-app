"""Cognito refresh transport: mobile secure store or browser HttpOnly cookie."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from media_summarizer.core.models.auth import (
    TokenVerificationResponse,
    WebSessionResponse,
)

SESSION_TRANSPORT_HEADER = "X-Session-Transport"
COOKIE_TRANSPORT = "cookie"

# ``__Secure-`` makes the browser refuse the cookie unless it is Secure and set over
# HTTPS. ``__Host-`` would also forbid a Domain attribute, but it requires Path=/,
# and the cookie must only ride on /api/auth requests.
REFRESH_COOKIE_NAME = "__Secure-refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"
# Who is signed in on the web, for the extension's other-account banner (TASK-638):
# the Cognito ID token of the session. Its signature makes it unforgeable, and the
# API never accepts it as a bearer (``cognito.identity`` wants ``token_use=access``).
# It rides with the refresh cookie, on the same path, and lives and dies with it.
ACCOUNT_COOKIE_NAME = "__Secure-web_account"


def is_web_session(request: Request) -> bool:
    """Whether the caller asked for the web (cookie) transport."""
    return request.headers.get(SESSION_TRANSPORT_HEADER, "").strip().lower() == COOKIE_TRANSPORT


def presented_refresh_token(request: Request, body_token: Optional[str]) -> str:
    """The refresh token of the request: the cookie in web mode, the body otherwise."""
    token = request.cookies.get(REFRESH_COOKIE_NAME) if is_web_session(request) else body_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    return token


def _set_session_cookie(response: JSONResponse, name: str, value: str, expires_at: datetime) -> None:
    max_age = max(0, int((expires_at - datetime.now(timezone.utc)).total_seconds()))
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
        secure=True,
        httponly=True,
        samesite="strict",
    )


def _clear_session_cookie(response: JSONResponse, name: str) -> None:
    # Attributes must match the ones the cookie was set with.
    response.delete_cookie(key=name, path=REFRESH_COOKIE_PATH, secure=True, httponly=True, samesite="strict")


def clear_session_cookies(response: JSONResponse) -> None:
    """Drop the refresh cookie and the account cookie that goes with it."""
    _clear_session_cookie(response, REFRESH_COOKIE_NAME)
    _clear_session_cookie(response, ACCOUNT_COOKIE_NAME)


def session_response(
    request: Request,
    *,
    access_token: str,
    expires_in: int,
    user: Dict[str, Any],
    refresh_token: str,
    refresh_expires_at: datetime,
    id_token: Optional[str],
    status_code: int = status.HTTP_200_OK,
) -> JSONResponse:
    """The answer of every route that opens or rotates a session.

    Mobile gets both tokens in the body. Web gets the access token in the body and
    the refresh token in the cookie, and nothing else. The ID token goes beside it,
    in the account cookie only the extension's other-account check reads.
    """
    body: Union[TokenVerificationResponse, WebSessionResponse]
    if not is_web_session(request):
        body = TokenVerificationResponse(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in, user=user)
    else:
        body = WebSessionResponse(access_token=access_token, expires_in=expires_in, user=user)
    response = JSONResponse(
        content=body.model_dump(), status_code=status_code, headers={"Cache-Control": "no-store", "Pragma": "no-cache"}
    )
    if is_web_session(request):
        _set_session_cookie(response, REFRESH_COOKIE_NAME, refresh_token, refresh_expires_at)
        # Never leave the previous account's cookie behind a session that has none.
        if id_token:
            _set_session_cookie(response, ACCOUNT_COOKIE_NAME, id_token, refresh_expires_at)
        else:
            _clear_session_cookie(response, ACCOUNT_COOKIE_NAME)
    return response
