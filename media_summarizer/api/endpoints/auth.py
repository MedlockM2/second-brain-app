"""Cognito authentication facade; profiles/preferences remain in the application."""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from media_summarizer.api.dependencies.auth import get_current_user
from media_summarizer.api.dependencies.session import clear_refresh_cookie, is_web_session, presented_refresh_token, session_response
from media_summarizer.core.models.auth import (
    AuthToken,
    AuthUser,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenType,
)
from media_summarizer.core.services import apple_native_auth
from media_summarizer.core.services import cognito_auth as cognito
from media_summarizer.utils import database_async
from media_summarizer.utils.auth_utils import get_refresh_token_expires_at
from media_summarizer.utils.database_async import DynamoDBConnection, get_db
from media_summarizer.utils.logging_config import log_event
from media_summarizer.utils.timezones import normalize_iana_timezone

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class CodeRequest(EmailRequest):
    code: str = Field(min_length=1, max_length=2048)


class ResetRequest(CodeRequest):
    password: str = Field(min_length=1, max_length=256)


class OAuthCodeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=4096)
    code_verifier: str = Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9._~-]+$")


class AppleNativeRequest(BaseModel):
    identity_token: str = Field(min_length=1, max_length=8192)
    authorization_code: str = Field(min_length=1, max_length=4096)
    nonce: str = Field(min_length=32, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")


@router.post("/apple/native")
async def apple_native(body: AppleNativeRequest, request: Request):
    if is_web_session(request):
        raise cognito.refuse("AUTH_INVALID_REQUEST")
    try:
        tokens = await apple_native_auth.sign_in(body.identity_token, body.authorization_code, body.nonce)
        return await answer_session(request, tokens, provision=True)
    except HTTPException as exc:
        if exc.status_code == 401:
            raise cognito.refuse("AUTH_APPLE_INVALID", 401) from None
        raise


async def answer_session(request: Request, tokens: dict[str, Any], *, provision: bool = False):
    user = await cognito.profile(tokens["AccessToken"], provision=provision)
    return session_response(
        request,
        access_token=tokens["AccessToken"],
        refresh_token=tokens["RefreshToken"],
        expires_in=tokens["ExpiresIn"],
        refresh_expires_at=datetime.now(timezone.utc) + timedelta(days=7 if is_web_session(request) else 365),
        user=AuthUser.from_user(user).model_dump(),
    )


@router.get("/oauth/config")
async def oauth_configuration(request: Request):
    return JSONResponse(
        cognito.oauth_config(is_web_session(request)), headers={"Cache-Control": "no-store", "Vary": "X-Session-Transport"}
    )


@router.post("/oauth/token")
async def oauth_token(body: OAuthCodeRequest, request: Request):
    tokens = await cognito.exchange_code(is_web_session(request), body.code, body.code_verifier)
    return await answer_session(request, tokens, provision=True)


@router.post("/register", status_code=202)
async def register(body: RegisterRequest, request: Request):
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as client:
            await client.sign_up(
                ClientId=cognito.client_id(is_web_session(request)),
                Username=body.email,
                Password=body.password,
                UserAttributes=[{"Name": "email", "Value": body.email}],
            )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "InvalidPasswordException":
            raise cognito.refuse("AUTH_PASSWORD_POLICY") from None
        if exc.response["Error"]["Code"] != "UsernameExistsException":
            raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None
    return {"status": "verification_required"}


@router.post("/confirm-registration")
async def confirm_registration(body: CodeRequest, request: Request):
    await cognito.call(
        "confirm_sign_up",
        ClientId=cognito.client_id(is_web_session(request)),
        Username=body.email.strip().lower(),
        ConfirmationCode=body.code,
    )
    return {"status": "confirmed"}


@router.post("/resend-confirmation", status_code=202)
async def resend_confirmation(body: EmailRequest, request: Request):
    try:
        await cognito.call(
            "resend_confirmation_code", ClientId=cognito.client_id(is_web_session(request)), Username=body.email.strip().lower()
        )
    except HTTPException as exc:
        if exc.status_code in (429, 503):
            raise
    return {"status": "accepted"}


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: EmailRequest, request: Request):
    email = body.email.strip().lower()
    if await cognito.password_account(email):
        try:
            await cognito.call("forgot_password", ClientId=cognito.client_id(is_web_session(request)), Username=email)
        except HTTPException as exc:
            # A delivery error must not reveal that this account exists. The
            # generic acknowledgement deliberately promises no actual delivery.
            if exc.status_code not in (400, 401, 429, 503):
                raise
    return {"status": "accepted"}


@router.post("/confirm-password")
async def confirm_password(body: ResetRequest, request: Request):
    email = body.email.strip().lower()
    if not await cognito.password_account(email):
        raise cognito.refuse("AUTH_CODE_INVALID")
    try:
        await cognito.call(
            "confirm_forgot_password",
            ClientId=cognito.client_id(is_web_session(request)),
            Username=email,
            ConfirmationCode=body.code,
            Password=body.password,
        )
    except HTTPException as exc:
        if exc.status_code == 401:
            raise cognito.refuse("AUTH_CODE_INVALID") from None
        raise
    return {"status": "password_changed"}


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    result = await cognito.call(
        "initiate_auth",
        ClientId=cognito.client_id(is_web_session(request)),
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": body.email, "PASSWORD": body.password},
    )
    tokens = result.get("AuthenticationResult")
    if tokens is None:
        raise cognito.refuse("AUTH_RESET_REQUIRED")
    return await answer_session(request, tokens, provision=True)


@router.post("/refresh")
async def refresh_token(request: Request, body: Optional[RefreshRequest] = None):
    token = presented_refresh_token(request, body.refresh_token if body else None)
    if token.startswith("ext_r_"):
        if is_web_session(request):
            raise cognito.refuse("INVALID_CREDENTIALS", 401)
        parent = await database_async.get_auth_token_by_token(token)
        if parent is None or parent.token_type != TokenType.REFRESH_TOKEN or not parent.is_valid():
            raise cognito.refuse("INVALID_CREDENTIALS", 401)
        user = await database_async.get_user_by_id(parent.user_id)
        if user is None or not user.cognito_sub:
            raise cognito.refuse("INVALID_CREDENTIALS", 401)
        parent.expires_at = get_refresh_token_expires_at(parent.lineage_kind, parent.lineage_started_at)
        try:
            await database_async.renew_extension_grant(parent)
        except ClientError:
            raise cognito.refuse("INVALID_CREDENTIALS", 401) from None
        access = AuthToken(
            user_id=user.id,
            email=user.email,
            token="ext_a_" + secrets.token_urlsafe(32),
            token_type=TokenType.ACCESS_TOKEN,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            lineage_id=parent.id,
            lineage_started_at=parent.lineage_started_at,
        )
        await database_async.create_auth_token(access)
        return {
            "access_token": access.token,
            "refresh_token": token,
            "token_type": "bearer",
            "expires_in": 300,
            "user": AuthUser.from_user(user).model_dump(),
        }
    result = await cognito.call(
        "get_tokens_from_refresh_token", ClientId=cognito.client_id(is_web_session(request)), RefreshToken=token
    )
    return await answer_session(request, result["AuthenticationResult"])


@router.post("/logout")
async def logout(request: Request, body: Optional[LogoutRequest] = None):
    response = JSONResponse({"status": "signed_out"})
    if is_web_session(request):
        clear_refresh_cookie(response)
    try:
        token = presented_refresh_token(request, body.refresh_token if body else None)
    except HTTPException:
        return response
    if token.startswith("ext_r_"):
        if is_web_session(request):
            return response
        grant = await database_async.get_auth_token_by_token(token)
        if grant and grant.token_type == TokenType.REFRESH_TOKEN:
            await database_async.revoke_refresh_token_lineage(grant.user_id, grant.lineage_id)
    else:
        try:
            await cognito.call("revoke_token", ClientId=cognito.client_id(is_web_session(request)), Token=token)
        except HTTPException as exc:
            if exc.status_code in (429, 503):
                response = JSONResponse({"detail": {"error_code": "AUTH_UNAVAILABLE"}}, status_code=503)
                if is_web_session(request):
                    clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=AuthUser)
async def get_current_user_info(current_user: AuthUser = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return current_user


# V1 supported reading languages (ISO 639-1 codes)
V1_READING_LANGUAGES = {"fr", "en", "es", "de", "it", "pt", "nl", "ja", "zh", "ar", "hi"}

# The stable identifier of a reading-language change refused by the once-a-month
# guard-rail (see ``READING_LANGUAGE_CHANGE_INTERVAL``). The response carries this
# code and the date the guard lifts, never a sentence: the app words the refusal
# from its own catalogue, in the reader's interface language (task-359 convention).
READING_LANGUAGE_CHANGE_TOO_SOON = "reading_language_change_too_soon"


class UpdateMeRequest(BaseModel):
    """Request model for updating the current user's preferences."""

    reading_language: Optional[str] = Field(default=None, description="Preferred reading language (ISO 639-1 code)")
    iana_timezone: Optional[str] = Field(
        default=None,
        description=(
            "IANA zone name of the device, e.g. 'Europe/Paris'. Never a UTC offset: "
            "a stored '+02:00' is wrong six months a year. Sent by the app on every "
            "return to the foreground, and only when it differs from what is stored."
        ),
    )


@router.patch("/me", response_model=AuthUser)
async def update_current_user(
    request: UpdateMeRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: DynamoDBConnection = Depends(get_db),
):
    """Update the current user's preferences (reading language, device time zone).

    The reading language is rate-limited to one change per month, per account —
    it is the only preference here whose move costs money, since it re-translates
    every media the reader opens next. Setting a first language is not a change
    and is never refused; a second move inside the window answers 429 with
    ``reading_language_change_too_soon`` and the date the guard lifts.
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = await database_async.get_user_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data: Dict[str, Any] = {}

    if request.reading_language is not None:
        lang = request.reading_language.lower().strip()
        if lang not in V1_READING_LANGUAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                # The supported set used to travel as `sorted(...)`, i.e. a Python
                # list repr with its brackets and quotes. Joined instead: the app
                # picks from a fixed list and cannot reach this, but a refusal that
                # prints `['ar', 'de', …]` is not a sentence (task-397).
                detail=(f"Unsupported reading language: {lang}. Supported: {', '.join(sorted(V1_READING_LANGUAGES))}"),
            )
        # Re-sending the language already stored is not a change: it must neither
        # spend the monthly allowance nor be refused. The app does exactly that on
        # a Save it did not need to make.
        if lang != user.reading_language:
            if user.reading_language is None:
                # First setting of the account — the onboarding pick, or a first
                # visit to the setting. Never limited, and it does not start the
                # clock either: the guard-rail counts *changes*.
                update_data["reading_language"] = lang
            else:
                available_at = user.reading_language_change_available_at()
                if available_at is not None:
                    log_event(
                        logger,
                        logging.WARNING,
                        "auth.reading_language.change_refused",
                        "Reading language change refused: one change per month",
                        user_id=user.id,
                        error_code=READING_LANGUAGE_CHANGE_TOO_SOON,
                        available_at=available_at.isoformat(),
                    )
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error_code": READING_LANGUAGE_CHANGE_TOO_SOON,
                            "message": "The reading language can only be changed once a month",
                            "available_at": available_at.isoformat(),
                        },
                    )
                update_data["reading_language"] = lang
                update_data["reading_language_changed_at"] = datetime.now(timezone.utc)

    if request.iana_timezone is not None:
        zone = normalize_iana_timezone(request.iana_timezone)
        if zone is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Unsupported time zone: {request.iana_timezone}. "
                    "Expected an IANA zone name such as 'Europe/Paris', not a UTC offset."
                ),
            )
        update_data["iana_timezone"] = zone

    # Only write when a value actually moves. The app re-reads the device zone on
    # every return to the foreground, so without this a user who never travels
    # would pay a DynamoDB write per app opening for a value that never changes.
    changed = {field: value for field, value in update_data.items() if getattr(user, field) != value}
    if changed:
        user.update(**changed)
        user = await database_async.update_user(user)

    return AuthUser.from_user(user)
