"""Cognito hooks. Only the API can mint native grants; no provider token is logged."""

import hashlib
import json
import os
import secrets
import time

import boto3
from botocore.exceptions import ClientError

TABLE = boto3.resource("dynamodb").Table(os.environ["APPLE_AUTH_TABLE"])
COGNITO = boto3.client("cognito-idp")
METADATA = "APPLE_NATIVE_V1"


PROVIDERS = {"google": "Google", "signinwithapple": "SignInWithApple"}
METHODS = {"Google": "google", "SignInWithApple": "apple"}


def holders(pool, email):
    """Same rules as cognito_auth.account_holders/confirmed: federated profiles included."""
    if not email:
        return []
    value = email.strip().lower().replace("\\", "\\\\").replace('"', '\\"')
    users = COGNITO.list_users(UserPoolId=pool, Filter=f'email = "{value}"', Limit=60).get("Users", [])
    for user in users:
        user["attributes"] = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
    return users


def confirmed(users):
    return [u for u in users if u.get("UserStatus") != "UNCONFIRMED" and u["attributes"].get("email_verified") == "true"]


def methods(users):
    found = set()
    for user in users:
        attributes = user["attributes"]
        if (
            not any(attributes.get(f"custom:{p}_subject") for p in ("apple", "google"))
            and user.get("UserStatus") in {"CONFIRMED", "RESET_REQUIRED"}
        ):
            found.add("password")
        for provider in ("apple", "google"):
            if attributes.get(f"custom:{provider}_subject"):
                found.add(provider)
        found.update(METHODS.get(i.get("providerName"), "") for i in json.loads(attributes.get("identities", "[]")))
    return ",".join(m for m in ("password", "apple", "google") if m in found)


def link_intent(username, provider):
    """Opened by an authenticated session through /api/auth/link/start (account_links.intent_key)."""
    key = "link#" + hashlib.sha256(f"{username}#{provider}".encode()).hexdigest()
    item = TABLE.get_item(Key={"pk": key}, ConsistentRead=True).get("Item")
    return bool(item) and item["username"] == username and int(item["expires_at"]) > time.time()


def handler(event, context):
    source = event["triggerSource"]
    request = event["request"]
    response = event["response"]
    pool = event["userPoolId"]
    if source == "PreSignUp_ExternalProvider":
        # Cognito derives this username from the verified provider subject. Never
        # link a local account merely because the provider reports the same email.
        prefix, separator, subject = event["userName"].partition("_")
        provider = PROVIDERS.get(prefix.lower()) if separator else None
        if provider == "SignInWithApple":
            key = "apple#" + hashlib.sha256(subject.encode()).hexdigest()
            item = TABLE.get_item(Key={"pk": key}, ConsistentRead=True).get("Item")
            if item and not item["username"].lower().startswith("signinwithapple_"):
                COGNITO.admin_link_provider_for_user(
                    UserPoolId=pool,
                    DestinationUser={"ProviderName": "Cognito", "ProviderAttributeValue": item["username"]},
                    SourceUser={"ProviderName": "SignInWithApple", "ProviderAttributeName": "Cognito_Subject",
                                "ProviderAttributeValue": subject},
                )
                return event
        users = holders(pool, request.get("userAttributes", {}).get("email", ""))
        for user in users:
            if user.get("UserStatus") == "UNCONFIRMED":
                # A pending sign-up never proved the address (pre-hijacking).
                COGNITO.admin_delete_user(UserPoolId=pool, Username=user["Username"])
        owners = confirmed(users)
        if owners and not any(link_intent(u["Username"], provider) for u in owners):
            # One address, one account. The app reads this code and offers the link.
            raise Exception(f"AUTH_ACCOUNT_EXISTS:{methods(owners)}")
        return event
    if source == "PreSignUp_SignUp":
        # Public clients can call SignUp directly: enforce the rule here, not only in the API.
        if confirmed(holders(pool, request.get("userAttributes", {}).get("email", ""))):
            raise Exception("AUTH_ACCOUNT_EXISTS")
        return event
    if source.startswith("PreSignUp_"):
        return event
    session = request.get("session", [])
    if source == "DefineAuthChallenge_Authentication":
        success = (
            not request.get("userNotFound", False) and len(session) == 1
            and session[0].get("challengeName") == "CUSTOM_CHALLENGE"
            and session[0].get("challengeMetadata") == METADATA
            and session[0].get("challengeResult") is True
        )
        response.update(issueTokens=success, failAuthentication=bool(session) and not success)
        if not session:
            response["challengeName"] = "CUSTOM_CHALLENGE"
    elif source == "CreateAuthChallenge_Authentication":
        nonce = secrets.token_urlsafe(32)
        response.update(publicChallengeParameters={"nonce": nonce}, privateChallengeParameters={"nonce": nonce},
                        challengeMetadata=METADATA)
    elif source == "VerifyAuthChallengeResponse_Authentication":
        response["answerCorrect"] = False
        answer = request.get("challengeAnswer", "")
        nonce = request.get("privateChallengeParameters", {}).get("nonce", "")
        if not isinstance(answer, str) or not 32 <= len(answer) <= 128 or not nonce or request.get("userNotFound"):
            return event
        try:
            # Delete + condition is atomic. TTL is cleanup, never the expiry check.
            TABLE.delete_item(
                Key={"pk": "grant#" + hashlib.sha256(answer.encode()).hexdigest()},
                ConditionExpression="#u = :u AND client_id = :c AND challenge = :n AND expires_at > :now",
                ExpressionAttributeNames={"#u": "username"},
                ExpressionAttributeValues={":u": event["userName"], ":c": event["callerContext"]["clientId"],
                                           ":n": nonce, ":now": int(time.time())},
            )
            response["answerCorrect"] = True
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
    else:
        raise ValueError("Unsupported Cognito trigger")
    return event
