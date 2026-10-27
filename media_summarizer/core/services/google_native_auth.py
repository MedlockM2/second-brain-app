"""Android Credential Manager proofs; account subjects, never emails, identify users."""

from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
import time
from functools import lru_cache
from typing import Any

import jwt
from botocore.exceptions import ClientError

from media_summarizer.core.services import cognito_auth as cognito
from media_summarizer.core.services import native_cognito
from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env


@lru_cache(maxsize=1)
def google_keys() -> jwt.PyJWKClient:
    return jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", cache_keys=True, lifespan=3600, timeout=5)


def subject_key(subject: str) -> str:
    return "google#" + hashlib.sha256(subject.encode()).hexdigest()


def proof_key(nonce: str) -> str:
    return "google-proof#" + hashlib.sha256(nonce.encode()).hexdigest()


async def challenge(username: str = "") -> dict[str, str]:
    client_id = required_env("GOOGLE_NATIVE_CLIENT_ID")
    nonce = secrets.token_urlsafe(32)
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        await table.put_item(Item={"pk": proof_key(nonce), "username": username, "expires_at": int(time.time()) + 600})
    return {"client_id": client_id, "nonce": nonce}


async def verified_identity(token: str, nonce: str, username: str = "") -> dict[str, Any]:
    try:
        key = await asyncio.to_thread(google_keys().get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token, key.key, algorithms=["RS256"], issuer=["https://accounts.google.com", "accounts.google.com"],
            audience=required_env("GOOGLE_NATIVE_CLIENT_ID"),
            options={"require": ["iss", "sub", "aud", "exp", "iat", "nonce", "email", "email_verified"]},
        )
        if (
            not isinstance(claims["sub"], str) or not claims["sub"]
            or not isinstance(claims["nonce"], str) or not secrets.compare_digest(claims["nonce"], nonce)
            or claims["email_verified"] is not True
            or not isinstance(claims["email"], str) or not claims["email"]
        ):
            raise cognito.refuse("AUTH_GOOGLE_INVALID", 401)
    except jwt.PyJWKClientConnectionError:
        raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None
    except jwt.PyJWTError:
        raise cognito.refuse("AUTH_GOOGLE_INVALID", 401) from None
    # Consumed only after signature validation; binds sign-in (empty username) or
    # linking to the authenticated account. TTL merely cleans abandoned pickers.
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        try:
            await table.delete_item(
                Key={"pk": proof_key(nonce)}, ConditionExpression="#u = :u AND expires_at > :now",
                ExpressionAttributeNames={"#u": "username"},
                ExpressionAttributeValues={":u": username, ":now": int(time.time())},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise cognito.refuse("AUTH_GOOGLE_INVALID", 401) from None
            raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None
    return claims


def matches(user: dict[str, Any], subject: str) -> bool:
    attributes = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
    return attributes.get("custom:google_subject") == subject or any(
        i.get("providerName") == "Google" and i.get("userId") == subject
        for i in json.loads(attributes.get("identities", "[]"))
    )


async def owner(subject: str, email: str) -> dict[str, Any] | None:
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        mapping = (await table.get_item(Key={"pk": subject_key(subject)}, ConsistentRead=True)).get("Item")
    user = await native_cognito.get_user(mapping["username"] if mapping else f"Google_{subject}")
    if user is not None:
        if not matches(user, subject):
            raise cognito.refuse("AUTH_GOOGLE_INVALID", 401)
        return user
    # A previously linked Hosted UI identity may live on a local/Apple username.
    # The address narrows the search; only its exact Google subject proves ownership.
    for holder in await cognito.account_holders(email):
        candidate = {"UserAttributes": [{"Name": k, "Value": v} for k, v in holder["attributes"].items()]}
        if matches(candidate, subject):
            return await native_cognito.get_user(holder["Username"])
    return None


async def sign_in(identity_token: str, nonce: str) -> dict[str, Any]:
    # Import here: linking also verifies Google proofs through this module.
    from media_summarizer.core.services import account_links

    claims = await verified_identity(identity_token, nonce)
    subject, email = claims["sub"], claims["email"]
    user = await owner(subject, email)
    if user is None:
        holders = await cognito.account_holders(email)
        if cognito.confirmed(holders):
            raise cognito.account_exists(cognito.confirmed(holders))
        await cognito.purge_unconfirmed(holders)
        try:
            async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as client:
                created = await client.admin_create_user(
                    UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=email,
                    MessageAction="SUPPRESS", ForceAliasCreation=False,
                    UserAttributes=[{"Name": "email", "Value": email}, {"Name": "email_verified", "Value": "true"},
                                    {"Name": "custom:google_subject", "Value": subject}],
                )
            user = await native_cognito.get_user(created["User"]["Username"])
        except ClientError as exc:
            if exc.response["Error"]["Code"] not in {"UsernameExistsException", "AliasExistsException"}:
                raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None
            user = await owner(subject, email)
            if user is None:
                raise cognito.account_exists(cognito.confirmed(await cognito.account_holders(email))) from None
    if user is None or not matches(user, subject):
        raise cognito.refuse("AUTH_GOOGLE_INVALID", 401)
    username = user["Username"]
    if user.get("UserStatus") == "EXTERNAL_PROVIDER":
        # Cognito rejects CUSTOM_AUTH while a profile is EXTERNAL_PROVIDER. Keep
        # its sub/library and federated identities; mark it social-only before
        # enabling API authentication with an unknowable random password.
        await cognito.call(
            "admin_update_user_attributes", UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=username,
            UserAttributes=[{"Name": "custom:google_subject", "Value": subject}],
        )
    if user.get("UserStatus") in {"FORCE_CHANGE_PASSWORD", "EXTERNAL_PROVIDER"}:
        await cognito.call(
            "admin_set_user_password", UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=username,
            Password="aA1!" + secrets.token_urlsafe(48), Permanent=True,
        )
    # Also link newly created native profiles to Google's Hosted UI identity, so
    # the same subject opens the same account from iOS and the web.
    await account_links.link_subject(username, "Google", subject)
    return await native_cognito.session(username)
