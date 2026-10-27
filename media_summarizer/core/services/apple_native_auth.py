"""Native Apple credentials become a one-use, challenge-bound Cognito grant.

Apple subjects, never email addresses, identify accounts. Provider credentials
stay in memory; Cognito remains the sole issuer of application session tokens.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
import time
from functools import lru_cache
from typing import Any

import httpx
import jwt
from botocore.exceptions import ClientError

from media_summarizer.core.services import cognito_auth as cognito
from media_summarizer.core.services import native_cognito
from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env

APPLE_ISSUER = "https://appleid.apple.com"


def subject_key(subject: str) -> str:
    return "apple#" + hashlib.sha256(subject.encode()).hexdigest()


@lru_cache(maxsize=1)
def apple_keys() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{APPLE_ISSUER}/auth/keys", cache_keys=True, lifespan=3600, timeout=5)


async def verified_identity(token: str, nonce: str) -> dict[str, Any]:
    try:
        key = await asyncio.to_thread(apple_keys().get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token, key.key, algorithms=["RS256"], issuer=APPLE_ISSUER,
            audience=required_env("APPLE_NATIVE_CLIENT_ID"),
            options={"require": ["iss", "sub", "aud", "exp", "iat", "nonce", "email", "email_verified"]},
        )
        if (
            not isinstance(claims["sub"], str) or not claims["sub"]
            or not isinstance(claims["nonce"], str) or not secrets.compare_digest(claims["nonce"], nonce)
            or claims["email_verified"] not in (True, "true")
            or not isinstance(claims["email"], str) or not claims["email"]
        ):
            raise cognito.refuse("AUTH_APPLE_INVALID", 401)
        return claims
    except jwt.PyJWKClientConnectionError:
        raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None
    except jwt.PyJWTError:
        raise cognito.refuse("AUTH_APPLE_INVALID", 401) from None


async def redeem_code(code: str, nonce: str, subject: str) -> None:
    """Apple consumes the code once. A JWT alone is never sufficient to log in."""
    now = int(time.time())
    native_id = required_env("APPLE_NATIVE_CLIENT_ID")
    client_secret = jwt.encode(
        {"iss": required_env("APPLE_TEAM_ID"), "iat": now, "exp": now + 120,
         "aud": APPLE_ISSUER, "sub": native_id},
        required_env("APPLE_PRIVATE_KEY").replace("\\n", "\n"), algorithm="ES256",
        headers={"kid": required_env("APPLE_KEY_ID")},
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{APPLE_ISSUER}/auth/token", data={
                "client_id": native_id, "client_secret": client_secret,
                "grant_type": "authorization_code", "code": code,
            })
        if response.status_code >= 500:
            raise cognito.refuse("AUTH_UNAVAILABLE", 503)
        if response.status_code != 200:
            raise cognito.refuse("AUTH_APPLE_INVALID", 401)
        claims = await verified_identity(response.json()["id_token"], nonce)
        if claims["sub"] != subject:
            raise cognito.refuse("AUTH_APPLE_INVALID", 401)
    except (httpx.HTTPError, ValueError, KeyError):
        raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None


def _attributes(user: dict[str, Any]) -> dict[str, str]:
    return {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}


def _is_apple_user(user: dict[str, Any], subject: str) -> bool:
    attrs = _attributes(user)
    if attrs.get("custom:apple_subject") == subject:
        return True
    return any(
        identity.get("providerName") == "SignInWithApple" and identity.get("userId") == subject
        for identity in json.loads(attrs.get("identities", "[]"))
    )


async def apple_username(claims: dict[str, Any]) -> str:
    subject = claims["sub"]
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        mapping = (await table.get_item(Key={"pk": subject_key(subject)}, ConsistentRead=True)).get("Item")
        user = await native_cognito.get_user(mapping["username"] if mapping else f"SignInWithApple_{subject}")
        if user is not None and not _is_apple_user(user, subject):
            raise cognito.refuse("AUTH_APPLE_INVALID", 401)
        if user is None:
            # Federated profiles do not reserve their address: look for every holder,
            # never reuse one on the address alone, and drop pending sign-ups.
            holders = await cognito.account_holders(claims["email"])
            if cognito.confirmed(holders):
                raise cognito.account_exists(cognito.confirmed(holders))
            await cognito.purge_unconfirmed(holders)
            # Email-only Cognito pools require an email for AdminCreateUser.
            try:
                async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as client:
                    created = await client.admin_create_user(
                        UserPoolId=required_env("COGNITO_USER_POOL_ID"),
                        Username=claims["email"], MessageAction="SUPPRESS", ForceAliasCreation=False,
                        UserAttributes=[{"Name": "email", "Value": claims["email"]},
                                        {"Name": "email_verified", "Value": "true"},
                                        {"Name": "custom:apple_subject", "Value": subject}],
                    )
                user = await native_cognito.get_user(created["User"]["Username"])
            except ClientError as exc:
                if exc.response["Error"]["Code"] not in {"UsernameExistsException", "AliasExistsException"}:
                    raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None
                # A concurrent creation is safe only with the same Apple subject.
                user = await native_cognito.get_user(claims["email"])
                if user is None or _attributes(user).get("custom:apple_subject") != subject:
                    raise cognito.account_exists(cognito.confirmed(await cognito.account_holders(claims["email"]))) from None
        if user is None or not _is_apple_user(user, subject):
            raise cognito.refuse("AUTH_APPLE_INVALID", 401)
        username = user["Username"]
        if _attributes(user).get("custom:apple_subject") == subject and user.get("UserStatus") == "FORCE_CHANGE_PASSWORD":
            # Complete an admin-created account. This random password never leaves
            # memory; password recovery is forbidden for this Apple-only profile.
            await cognito.call(
                "admin_set_user_password", UserPoolId=required_env("COGNITO_USER_POOL_ID"),
                Username=username, Password="aA1!" + secrets.token_urlsafe(48), Permanent=True,
            )
        await table.put_item(Item={"pk": subject_key(subject), "username": username})
        return username


async def sign_in(identity_token: str, authorization_code: str, nonce: str) -> dict[str, Any]:
    claims = await verified_identity(identity_token, nonce)
    await redeem_code(authorization_code, nonce, claims["sub"])
    username = await apple_username(claims)
    return await native_cognito.session(username)
