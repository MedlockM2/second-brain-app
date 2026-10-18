"""Cognito hooks. Only the API can mint native grants; no provider token is logged."""

import hashlib
import os
import secrets
import time

import boto3
from botocore.exceptions import ClientError

TABLE = boto3.resource("dynamodb").Table(os.environ["APPLE_AUTH_TABLE"])
COGNITO = boto3.client("cognito-idp")
METADATA = "APPLE_NATIVE_V1"


def handler(event, context):
    source = event["triggerSource"]
    request = event["request"]
    response = event["response"]
    if source == "PreSignUp_ExternalProvider":
        # Cognito derives this username from the verified provider subject. Never
        # link a local account merely because the provider reports the same email.
        prefix, separator, subject = event["userName"].partition("_")
        if separator and prefix.lower() == "signinwithapple":
            key = "apple#" + hashlib.sha256(subject.encode()).hexdigest()
            item = TABLE.get_item(Key={"pk": key}, ConsistentRead=True).get("Item")
            if item and not item["username"].lower().startswith("signinwithapple_"):
                COGNITO.admin_link_provider_for_user(
                    UserPoolId=event["userPoolId"],
                    DestinationUser={"ProviderName": "Cognito", "ProviderAttributeValue": item["username"]},
                    SourceUser={"ProviderName": "SignInWithApple", "ProviderAttributeName": "Cognito_Subject",
                                "ProviderAttributeValue": subject},
                )
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
