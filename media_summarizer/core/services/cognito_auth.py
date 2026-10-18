"""Cognito owns credentials, federation, verification, recovery and user sessions.

No token or password is persisted by this service. Application profiles are
addressed by pool subject, never merged by email. An admin-only custom attribute
can explicitly attach a protected development fixture to a new Cognito identity.
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


def refuse(code: str, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail={"error_code": code})


async def call(operation: str, **kwargs: Any) -> dict[str, Any]:
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as cognito:
            result: dict[str, Any] = await getattr(cognito, operation)(**kwargs)
            return result
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        mapping = {
            "NotAuthorizedException": ("INVALID_CREDENTIALS", 401),
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
    # write_attributes. No email lookup and no automatic provider linking.
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


async def password_account(email: str) -> bool:
    """Never let recovery set a password on a federated-only identity."""
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as cognito:
            user = await cognito.admin_get_user(UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=email)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "UserNotFoundException":
            return False
        raise refuse("AUTH_UNAVAILABLE", 503) from None
    attrs = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
    return not attrs.get("custom:apple_subject") and user.get("UserStatus") in {"CONFIRMED", "RESET_REQUIRED"}


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
