"""
Browser extension tokens (task-485): a session of its own for the extension.

The extension never signs in. It is *paired* with an account that is already
signed in on the web app, and gets the refresh token of a lineage of its own, of
kind ``browser_extension``:

- **Reduced scope.** Opaque ``ext_a_`` access tokens refer to the parent grant,
  which the authentication dependency confines to saving a page, saving a selection,
  listing the folders and signing the extension out (``EXTENSION_ROUTES`` in
  api/dependencies/auth.py). Everything else answers 403.
- **Durations.** Renewed at every /refresh, dead after 90 days without one, and
  a year after the pairing at the latest (``EXTENSION_REFRESH_*`` in
  utils/auth_utils.py). Then the extension asks to be paired again.
- **Transport.** The refresh token travels in the JSON body, like the mobile
  app's: the extension keeps it in its own storage and posts it to /refresh.

Pairing, two ways:

- **One click** (the usual way): the web app, signed in, asks
  ``POST /api/auth/extension-tokens`` and hands the refresh token to the
  extension through ``externally_connectable``.
- **Rescue code**, when that message cannot pass (another browser profile, a
  browser without ``externally_connectable``): the web app asks
  ``POST /api/auth/extension-tokens/pairing-code`` and shows six digits; the
  extension's popup claims them with ``POST .../pairing-code/claim``. A code is
  single use, lives five minutes and dies at the third wrong guess. The claim
  names the account by its email so that a wrong guess counts against that
  account's code: a counter carried by the code itself is what stops a brute
  force over a million combinations (the throttling of API Gateway alone does
  not). Every failure answers the same 400, so the claim tells nobody whether an
  email has an account.

Revocation: the list of linked extensions and ``DELETE /{lineage_id}`` (from the
web app), or ``/logout`` from the extension itself. Signing out of the web app
does not unlink an extension — they are different lineages — and deleting the
account erases every lineage with the rest of the account.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from media_summarizer.api.dependencies.auth import get_current_user
from media_summarizer.core.models.auth import AuthToken, AuthUser, LineageKind, TokenType
from media_summarizer.utils import database_async
from media_summarizer.utils.auth_utils import get_refresh_token_expires_at
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

router = APIRouter()

PAIRING_CODE_DIGITS = 6
PAIRING_CODE_TTL = timedelta(minutes=5)
PAIRING_CODE_MAX_FAILURES = 3

# One answer for every way a claim can fail: unknown email, no live code, wrong
# code, code destroyed. A distinct answer would turn the claim into an oracle.
INVALID_PAIRING_CODE = "invalid_pairing_code"


class ExtensionTokenRequest(BaseModel):
    client_label: Optional[str] = Field(
        default=None,
        max_length=80,
        description="What the extension runs in, e.g. 'Chrome on macOS', shown in the list of linked extensions",
    )


class ExtensionTokenResponse(BaseModel):
    lineage_id: str
    refresh_token: str = Field(..., description="Refresh token of the new browser_extension lineage")
    expires_at: datetime = Field(..., description="When this refresh token expires unless used")


class LinkedExtension(BaseModel):
    lineage_id: str
    client_label: Optional[str] = None
    paired_at: datetime
    last_used_at: datetime
    expires_at: datetime


class LinkedExtensionsResponse(BaseModel):
    extensions: List[LinkedExtension]


class PairingCodeResponse(BaseModel):
    code: str = Field(..., description="Six digits to type in the extension's popup")
    expires_at: datetime


class PairingCodeClaim(BaseModel):
    email: str = Field(..., max_length=320, description="Email of the account showing the code")
    code: str = Field(..., min_length=PAIRING_CODE_DIGITS, max_length=PAIRING_CODE_DIGITS)
    client_label: Optional[str] = Field(default=None, max_length=80)


def _code_digest(user_id: str, code: str) -> str:
    """What is stored for a code: never the digits themselves."""
    return hashlib.sha256(f"{user_id}:{code}".encode()).hexdigest()


async def _open_extension_lineage(user_id: str, email: str, client_label: Optional[str]) -> ExtensionTokenResponse:
    refresh = AuthToken.create_refresh_token(
        user_id=user_id,
        email=email,
        expires_at=get_refresh_token_expires_at(LineageKind.BROWSER_EXTENSION),
        lineage_kind=LineageKind.BROWSER_EXTENSION,
        client_label=(client_label or "").strip() or None,
    )
    refresh = await database_async.create_auth_token(refresh)
    log_event(
        logger,
        logging.INFO,
        "auth.extension.paired",
        "Opened a browser extension lineage",
        user_id=user_id,
        lineage_id=refresh.lineage_id,
    )
    return ExtensionTokenResponse(
        lineage_id=refresh.lineage_id,
        refresh_token=refresh.token,
        expires_at=refresh.expires_at,
    )


@router.post("", response_model=ExtensionTokenResponse, status_code=status.HTTP_201_CREATED)
async def issue_extension_token(
    request: ExtensionTokenRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> ExtensionTokenResponse:
    """One-click pairing: a new extension lineage for the signed-in web session."""
    return await _open_extension_lineage(current_user.id, current_user.email, request.client_label)


@router.get("", response_model=LinkedExtensionsResponse)
async def list_extension_tokens(
    current_user: AuthUser = Depends(get_current_user),
) -> LinkedExtensionsResponse:
    """The extensions linked to the account: one entry per live lineage, newest pairing first.

    A lineage holds one stable refresh grant; last_used_at records its renewal.
    """
    now = datetime.now(timezone.utc)
    tokens = await database_async.get_auth_tokens_by_user_id(current_user.id, TokenType.REFRESH_TOKEN)
    heads = [
        token
        for token in tokens
        if token.lineage_kind == LineageKind.BROWSER_EXTENSION and token.is_active and token.expires_at > now
    ]
    heads.sort(key=lambda token: token.lineage_started_at, reverse=True)
    return LinkedExtensionsResponse(
        extensions=[
            LinkedExtension(
                lineage_id=token.lineage_id,
                client_label=token.client_label,
                paired_at=token.lineage_started_at,
                last_used_at=token.last_used_at,
                expires_at=token.expires_at,
            )
            for token in heads
        ]
    )


@router.delete("/{lineage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_extension_token(
    lineage_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> Response:
    """Unlink one extension. Only an extension lineage of the caller's own account."""
    tokens = await database_async.get_auth_tokens_by_user_id(current_user.id, TokenType.REFRESH_TOKEN)
    if not any(
        token.lineage_id == lineage_id and token.lineage_kind == LineageKind.BROWSER_EXTENSION for token in tokens
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension not found")
    revoked = await database_async.revoke_refresh_token_lineage(current_user.id, lineage_id)
    log_event(
        logger,
        logging.INFO,
        "auth.extension.revoked",
        "Unlinked a browser extension",
        user_id=current_user.id,
        lineage_id=lineage_id,
        tokens_revoked=revoked,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/pairing-code", response_model=PairingCodeResponse, status_code=status.HTTP_201_CREATED)
async def issue_pairing_code(
    current_user: AuthUser = Depends(get_current_user),
) -> PairingCodeResponse:
    """A rescue code for the extension's popup. Asking again replaces the previous one."""
    for previous in await database_async.get_auth_tokens_by_user_id(current_user.id, TokenType.EXTENSION_PAIRING_CODE):
        await database_async.delete_auth_token(previous.id)

    code = f"{secrets.randbelow(10**PAIRING_CODE_DIGITS):0{PAIRING_CODE_DIGITS}d}"
    pairing = AuthToken(
        user_id=current_user.id,
        email=current_user.email,
        token=_code_digest(current_user.id, code),
        token_type=TokenType.EXTENSION_PAIRING_CODE,
        expires_at=datetime.now(timezone.utc) + PAIRING_CODE_TTL,
    )
    pairing = await database_async.create_auth_token(pairing)
    return PairingCodeResponse(code=code, expires_at=pairing.expires_at)


@router.post("/pairing-code/claim", response_model=ExtensionTokenResponse, status_code=status.HTTP_201_CREATED)
async def claim_pairing_code(claim: PairingCodeClaim) -> ExtensionTokenResponse:
    """The extension's popup trades a rescue code for its own lineage. Unauthenticated."""
    refused = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_PAIRING_CODE)
    if not claim.code.isdigit():
        raise refused

    users = await database_async.get_users_by_email(claim.email.lower().strip())
    now = datetime.now(timezone.utc)
    live: List[AuthToken] = []
    for user in users:
        if not user.cognito_sub:
            continue
        codes = [
            token for token in await database_async.get_auth_tokens_by_user_id(user.id, TokenType.EXTENSION_PAIRING_CODE)
            if token.expires_at > now and token.failed_attempts < PAIRING_CODE_MAX_FAILURES
        ]
        if codes:
            live.append(max(codes, key=lambda token: token.created_at))
    if not live:
        raise refused

    matches = [token for token in live if secrets.compare_digest(token.token, _code_digest(token.user_id, claim.code))]
    if len(matches) != 1:
        # An email may locate multiple separate Cognito profiles. Wrong guesses
        # count against every outstanding code; index order never picks an owner.
        for pairing in live:
            await database_async.record_extension_pairing_failure(pairing.id, PAIRING_CODE_MAX_FAILURES)
        raise refused

    pairing = matches[0]
    owner = await database_async.get_user_by_id(pairing.user_id)
    if owner is None or not owner.cognito_sub:
        raise refused
    if not await database_async.consume_extension_pairing_code(pairing.id, PAIRING_CODE_MAX_FAILURES):
        raise refused
    return await _open_extension_lineage(owner.id, owner.email, claim.client_label)
