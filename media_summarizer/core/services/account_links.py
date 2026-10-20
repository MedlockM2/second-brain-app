"""A second sign-in method joins an account only when both identities are proven.

The Cognito session proves the existing account. A fresh provider proof, obtained
after that session opened a one-use intent, proves the new identity. The address
alone never links anything: AWS reserves AdminLinkProviderForUser for trusted
attributes, and linking on a shared email is the nOAuth class of takeover.

Hosted UI providers (Google, Apple on Android/web): the pre sign-up trigger lets
Cognito create the federated profile only while an intent of the account holding
its address is alive. That profile is then deleted and linked to the session's
account, as AWS requires for a federated user who has already signed in. It never
gets an application profile of its own (cognito_auth.profile refuses it).
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from botocore.exceptions import ClientError

from media_summarizer.core.services import apple_native_auth
from media_summarizer.core.services import cognito_auth as cognito
from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env

INTENT_SECONDS = 600


def intent_key(username: str, provider: str) -> str:
    """Same derivation in infrastructure/lambda/apple_auth.py, which reads the intent."""
    return "link#" + hashlib.sha256(f"{username}#{provider}".encode()).hexdigest()


async def start(username: str, provider: str) -> None:
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        await table.put_item(Item={
            "pk": intent_key(username, provider), "username": username, "provider": provider,
            "expires_at": int(time.time()) + INTENT_SECONDS,
        })


async def _consume(username: str, provider: str) -> None:
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        try:
            await table.delete_item(
                Key={"pk": intent_key(username, provider)},
                ConditionExpression="#u = :u AND expires_at > :now",
                ExpressionAttributeNames={"#u": "username"},
                ExpressionAttributeValues={":u": username, ":now": int(time.time())},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise cognito.refuse("AUTH_LINK_EXPIRED") from None
            raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None


async def _admin(operation: str, **kwargs: Any) -> dict[str, Any]:
    try:
        async with database_async.get_session().client("cognito-idp", region_name=database_async.AWS_REGION) as client:
            result: dict[str, Any] = await getattr(client, operation)(UserPoolId=required_env("COGNITO_USER_POOL_ID"), **kwargs)
            return result
    except ClientError:
        raise cognito.refuse("AUTH_UNAVAILABLE", 503) from None


async def _retire(user: dict[str, Any]) -> None:
    """Delete a federated profile before linking it, unless it already owns a library."""
    attributes = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
    if user.get("UserStatus") != "EXTERNAL_PROVIDER" or await database_async.get_user_by_id(attributes.get("sub", "")):
        raise cognito.refuse("AUTH_PROVIDER_IN_USE", 409)
    await _admin("admin_delete_user", Username=user["Username"])


async def _link(username: str, provider: str, subject: str) -> None:
    destination = await _admin("admin_get_user", Username=username)
    if destination.get("UserStatus") == "EXTERNAL_PROVIDER":
        attributes = {a["Name"]: a["Value"] for a in destination.get("UserAttributes", [])}
        primary = json.loads(attributes.get("identities", "[]"))[0]
        target = {"ProviderName": primary["providerName"], "ProviderAttributeValue": primary["userId"]}
    else:
        target = {"ProviderName": "Cognito", "ProviderAttributeValue": username}
    await _admin(
        "admin_link_provider_for_user", DestinationUser=target,
        SourceUser={"ProviderName": provider, "ProviderAttributeName": "Cognito_Subject", "ProviderAttributeValue": subject},
    )
    if provider == "SignInWithApple":
        async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
            table = await db.Table(required_env("APPLE_AUTH_TABLE"))
            await table.put_item(Item={"pk": apple_native_auth.subject_key(subject), "username": username})


async def complete_oauth(username: str, web: bool, code: str, verifier: str) -> None:
    tokens = await cognito.exchange_code(web, code, verifier)
    _, attributes, linked = await cognito.identity(tokens["AccessToken"])
    if linked == username:
        return  # This provider already signs in to the account.
    identities = json.loads(attributes.get("identities", "[]"))
    if len(identities) != 1 or identities[0].get("providerName") not in cognito.PROVIDER_METHODS:
        raise cognito.refuse("AUTH_PROVIDER_IN_USE", 409)
    provider, subject = identities[0]["providerName"], identities[0]["userId"]
    await _consume(username, provider)
    await _retire(await _admin("admin_get_user", Username=linked))
    await _link(username, provider, subject)


async def link_apple(username: str, identity_token: str, authorization_code: str, nonce: str) -> None:
    claims = await apple_native_auth.verified_identity(identity_token, nonce)
    subject = claims["sub"]
    await apple_native_auth.redeem_code(authorization_code, nonce, subject)
    async with database_async.get_session().resource("dynamodb", region_name=database_async.AWS_REGION) as db:
        table = await db.Table(required_env("APPLE_AUTH_TABLE"))
        mapping = (await table.get_item(Key={"pk": apple_native_auth.subject_key(subject)}, ConsistentRead=True)).get("Item")
    if mapping:
        if mapping["username"] == username:
            return
        raise cognito.refuse("AUTH_PROVIDER_IN_USE", 409)
    federated = await apple_native_auth.get_user(f"SignInWithApple_{subject}")
    if federated is not None:
        if federated["Username"] == username:
            return
        await _retire(federated)
    await _link(username, "SignInWithApple", subject)
