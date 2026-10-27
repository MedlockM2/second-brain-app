"""Shared Cognito session issuance after an API-verified native provider proof."""

from __future__ import annotations

import hashlib
import secrets
import time
from typing import Any

from botocore.exceptions import ClientError

from media_summarizer.core.services import cognito_auth as cognito
from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env


async def get_user(username: str) -> dict[str, Any] | None:
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as client:
            return await client.admin_get_user(UserPoolId=required_env("COGNITO_USER_POOL_ID"), Username=username)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "UserNotFoundException":
            return None
        raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None


async def session(username: str) -> dict[str, Any]:
    app_client = cognito.client_id(False)
    challenge = await cognito.call(
        "initiate_auth", ClientId=app_client, AuthFlow="CUSTOM_AUTH", AuthParameters={"USERNAME": username},
    )
    if challenge.get("ChallengeName") != "CUSTOM_CHALLENGE" or not challenge.get("Session"):
        raise cognito.refuse("AUTH_UNAVAILABLE", 503)
    challenge_nonce = challenge.get("ChallengeParameters", {}).get("nonce")
    if not challenge_nonce:
        raise cognito.refuse("AUTH_UNAVAILABLE", 503)
    grant = secrets.token_urlsafe(48)
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        await table.put_item(Item={
            "pk": "grant#" + hashlib.sha256(grant.encode()).hexdigest(),
            "username": username, "client_id": app_client, "challenge": challenge_nonce,
            "expires_at": int(time.time()) + 90,
        })
    result = await cognito.call(
        "respond_to_auth_challenge", ClientId=app_client, ChallengeName="CUSTOM_CHALLENGE", Session=challenge["Session"],
        ChallengeResponses={"USERNAME": username, "ANSWER": grant},
    )
    if not result.get("AuthenticationResult"):
        raise cognito.refuse("AUTH_UNAVAILABLE", 503)
    return result["AuthenticationResult"]
