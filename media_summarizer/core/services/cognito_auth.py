"""Cognito owns credentials, federation, verification, recovery and user sessions.

No token or password is persisted by this service. Application profiles are
addressed by pool subject, never merged by email. An admin-only custom attribute
can explicitly attach a protected development fixture to a new Cognito identity.

One verified address belongs to one account. Federated profiles do not reserve
their address in an email-username pool, so every holder is looked up explicitly;
a second identity joins an account only through a proven link (account_links).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import httpx
import jwt
from botocore.exceptions import ClientError
from fastapi import HTTPException

from media_summarizer.core.models import User
from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env


def issuer() -> str:
    return f"https://cognito-idp.{database_async.AWS_REGION}.amazonaws.com/{required_env('COGNITO_USER_POOL_ID')}"


def client_id(web: bool) -> str:
    return required_env("COGNITO_WEB_CLIENT_ID" if web else "COGNITO_MOBILE_CLIENT_ID")


def oauth_config(web: bool) -> dict[str, str]:
    return {
        "domain": required_env("COGNITO_DOMAIN"),
        "client_id": client_id(web),
        "redirect_uri": required_env("COGNITO_WEB_CALLBACK" if web else "COGNITO_MOBILE_CALLBACK"),
    }


def refuse(code: str, status: int = 400, **details: Any) -> HTTPException:
    return HTTPException(status_code=status, detail={"error_code": code, **details})


async def call(operation: str, **kwargs: Any) -> dict[str, Any]:
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as cognito:
            result: dict[str, Any] = await getattr(cognito, operation)(**kwargs)
            return result
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        mapping = {
            "NotAuthorizedException": ("INVALID_CREDENTIALS", 401),
            # Rotation already spent this refresh token: it is dead, not the service.
            "RefreshTokenReuseException": ("INVALID_CREDENTIALS", 401),
            "UserNotFoundException": ("INVALID_CREDENTIALS", 401),
            "UserNotConfirmedException": ("EMAIL_NOT_VERIFIED", 400),
            "CodeMismatchException": ("AUTH_CODE_INVALID", 400),
            "ExpiredCodeException": ("AUTH_CODE_EXPIRED", 400),
            "InvalidPasswordException": ("AUTH_PASSWORD_POLICY", 400),
            "PasswordResetRequiredException": ("AUTH_RESET_REQUIRED", 400),
            "TooManyRequestsException": ("AUTH_RATE_LIMITED", 429),
            "LimitExceededException": ("AUTH_RATE_LIMITED", 429),
            "InvalidParameterException": ("AUTH_INVALID_REQUEST", 400),
        }
        error, status = mapping.get(code, ("AUTH_UNAVAILABLE", 503))
        raise refuse(error, status) from None


@lru_cache(maxsize=1)
def keys() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{issuer()}/.well-known/jwks.json", cache_keys=True, lifespan=3600, timeout=5)


async def identity(access_token: str) -> tuple[dict[str, Any], dict[str, str], str]:
    """Verify RS256/iss/exp/client/token_use, then check revocation with GetUser."""
    try:
        key = await asyncio.to_thread(keys().get_signing_key_from_jwt, access_token)
        claims = jwt.decode(
            access_token,
            key.key,
            algorithms=["RS256"],
            issuer=issuer(),
            options={"verify_aud": False, "require": ["exp", "iat", "iss", "sub", "client_id", "token_use"]},
        )
        if claims["token_use"] != "access" or claims["client_id"] not in {
            client_id(False),
            os.environ.get("COGNITO_WEB_CLIENT_ID", ""),
        }:
            raise refuse("INVALID_CREDENTIALS", 401)
    except jwt.PyJWKClientConnectionError:
        raise refuse("AUTH_UNAVAILABLE", 503) from None
    except jwt.PyJWTError:
        raise refuse("INVALID_CREDENTIALS", 401) from None
    user = await call("get_user", AccessToken=access_token)
    attributes = {a["Name"]: a["Value"] for a in user["UserAttributes"]}
    if attributes.get("sub") != claims["sub"] or attributes.get("email_verified") != "true" or not attributes.get("email"):
        raise refuse("EMAIL_NOT_VERIFIED", 401)
    return claims, attributes, user["Username"]


async def profile(access_token: str, *, provision: bool = False) -> User:
    claims, attributes, username = await identity(access_token)
    subject = claims["sub"]
    # Only administrators can write app_user_id; it is excluded from both clients'
    # write_attributes. The address never selects a profile and never links providers.
    user_id = attributes.get("custom:app_user_id") or subject
    user = await database_async.get_user_by_id(user_id)
    if user:
        if user.cognito_sub != subject:
            if user.cognito_sub is not None or not provision or attributes.get("custom:app_user_id") != user.id:
                raise refuse("INVALID_CREDENTIALS", 401)
            await database_async.bind_cognito_profile(user.id, subject, username)
            user = await database_async.get_user_by_id(user_id)
            if user is None or user.cognito_sub != subject:
                raise refuse("INVALID_CREDENTIALS", 401)
        return user
    if not provision or user_id != subject:
        raise refuse("INVALID_CREDENTIALS", 401)
    # A federated identity left over from an unfinished link, or one Cognito
    # created before the pre sign-up check, never opens a second library.
    others = [h for h in confirmed(await account_holders(attributes["email"])) if h["Username"] != username]
    if others:
        raise account_exists(others)
    user = User(
        id=subject,
        email=attributes["email"],
        cognito_sub=subject,
        cognito_username=username,
        email_verified_at=datetime.now(timezone.utc),
    )
    try:
        return await database_async.create_user(user)
    except ValueError:
        existing = await database_async.get_user_by_id(subject)
        if existing is None or existing.cognito_sub != subject:
            raise refuse("INVALID_CREDENTIALS", 401) from None
        return existing


PROVIDER_METHODS = {"Google": "google", "SignInWithApple": "apple"}
METHOD_ORDER = ("password", "apple", "google")


async def account_holders(email: str) -> list[dict[str, Any]]:
    """Every pool user carrying this address, federated profiles included."""
    value = email.strip().lower().replace("\\", "\\\\").replace('"', '\\"')
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as cognito:
            result = await cognito.list_users(
                UserPoolId=required_env("COGNITO_USER_POOL_ID"), Filter=f'email = "{value}"', Limit=60
            )
    except ClientError:
        raise refuse("AUTH_UNAVAILABLE", 503) from None
    return [
        {"Username": u["Username"], "UserStatus": u.get("UserStatus"),
         "attributes": {a["Name"]: a["Value"] for a in u.get("Attributes", [])}}
        for u in result.get("Users", [])
    ]


def confirmed(holders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Holders who proved the address. An UNCONFIRMED sign-up never did."""
    return [h for h in holders if h["UserStatus"] != "UNCONFIRMED" and h["attributes"].get("email_verified") == "true"]


async def purge_unconfirmed(holders: list[dict[str, Any]]) -> None:
    """Drop pending sign-ups for an address: whoever owns it now must not inherit one (pre-hijacking)."""
    for holder in holders:
        if holder["UserStatus"] == "UNCONFIRMED":
            try:
                async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as cognito:
                    await cognito.admin_delete_user(UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=holder["Username"])
            except ClientError as exc:
                if exc.response["Error"]["Code"] != "UserNotFoundException":
                    raise refuse("AUTH_UNAVAILABLE", 503) from None


def has_password(holder: dict[str, Any]) -> bool:
    """A password the person chose. Native Apple profiles carry a random one nobody knows."""
    return not holder["attributes"].get("custom:apple_subject") and holder["UserStatus"] in {"CONFIRMED", "RESET_REQUIRED"}


def sign_in_methods(holder: dict[str, Any]) -> list[str]:
    attributes = holder["attributes"]
    methods = {"password"} if has_password(holder) else set()
    if attributes.get("custom:apple_subject"):
        methods.add("apple")
    methods.update(PROVIDER_METHODS.get(i.get("providerName"), "") for i in json.loads(attributes.get("identities", "[]")))
    return [m for m in METHOD_ORDER if m in methods]


def account_exists(holders: list[dict[str, Any]]) -> HTTPException:
    methods = {m for h in holders for m in sign_in_methods(h)}
    return refuse("AUTH_ACCOUNT_EXISTS", 409, methods=[m for m in METHOD_ORDER if m in methods])


async def credential_kind(email: str) -> str | None:
    """Return "password" when a holder chose one, "social" when only providers hold the address."""
    holders = confirmed(await account_holders(email))
    if any(has_password(h) for h in holders):
        return "password"
    return "social" if holders else None


async def exchange_code(web: bool, code: str, verifier: str) -> dict[str, Any]:
    config = oauth_config(web)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{config['domain']}/oauth2/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": config["client_id"],
                    "redirect_uri": config["redirect_uri"],
                    "code": code,
                    "code_verifier": verifier,
                },
            )
        if response.status_code >= 500:
            raise refuse("AUTH_UNAVAILABLE", 503)
        if response.status_code != 200:
            raise refuse("INVALID_CREDENTIALS", 401)
        payload = response.json()
        return {"AccessToken": payload["access_token"], "RefreshToken": payload["refresh_token"], "ExpiresIn": payload["expires_in"]}
    except (httpx.HTTPError, ValueError, KeyError):
        raise refuse("AUTH_UNAVAILABLE", 503) from None


async def delete_identity(username: str) -> None:
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as cognito:
            user = await cognito.admin_get_user(UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=username)
            attributes = {a["Name"]: a["Value"] for a in user["UserAttributes"]}
            subjects = [attributes["custom:apple_subject"]] if attributes.get("custom:apple_subject") else []
            subjects += [i["userId"] for i in json.loads(attributes.get("identities", "[]"))
                         if i.get("providerName") == "SignInWithApple"]
            async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
                table = await db.Table(required_env("APPLE_AUTH_TABLE"))
                for subject in set(subjects):
                    try:
                        await table.delete_item(
                            Key={"pk": "apple#" + hashlib.sha256(subject.encode()).hexdigest()},
                            ConditionExpression="#u = :u", ExpressionAttributeNames={"#u": "username"},
                            ExpressionAttributeValues={":u": user["Username"]},
                        )
                    except ClientError as exc:
                        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
                            raise
            await cognito.admin_delete_user(UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=username)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "UserNotFoundException":
            raise
