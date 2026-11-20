"""Relay EAS and App Store Connect webhooks to the Mobile Beta Distribution workflow.

mobile-beta-distribute.yml used to poll every 30 minutes for the three events that
move a beta forward: an EAS build or submission finishing, Apple finishing to
process an upload, and Apple ending the external beta review. All three exist as
webhooks, so this function receives them, checks their signature, and asks GitHub
to run the workflow for the platform concerned (TASK-635). Google Play has no such
webhook; the workflow's daily safety run covers it.

Every request is authenticated before anything else happens: an unsigned or badly
signed body is refused with 401 and never reaches GitHub. The GitHub token and both
webhook secrets come from one Secrets Manager secret, read once per cold start.

Entry point: an API Gateway HTTP API (payload format 2.0), see
infrastructure/terraform/envs/dev/mobile_beta_relay.tf.
"""

import base64
import hmac
import json
import os
import urllib.error
import urllib.request
from typing import Any

import boto3

SECRET_ID = os.environ["RELAY_SECRET_ID"]
REPOSITORY = os.environ["GITHUB_REPOSITORY"]
WORKFLOW = os.environ.get("GITHUB_WORKFLOW_FILE", "mobile-beta-distribute.yml")
REF = os.environ.get("GITHUB_REF", "main")

# EAS: build or submission reached its end. "errored" and "canceled" leave nothing
# to distribute, so they wake nothing up.
EAS_DONE = {"finished"}
# App Store Connect events that change what the distribution script can do next.
ASC_EVENTS = {"buildUploadStateUpdated", "buildBetaDetailExternalBuildStateUpdated"}

_secrets: dict[str, str] | None = None


def _load_secrets() -> dict[str, str]:
    global _secrets
    if _secrets is None:
        value = boto3.client("secretsmanager").get_secret_value(SecretId=SECRET_ID)["SecretString"]
        _secrets = {k: v for k, v in json.loads(value).items() if isinstance(v, str)}
    return _secrets


def _response(status: int, message: str) -> dict[str, Any]:
    return {"statusCode": status, "headers": {"content-type": "text/plain"}, "body": message}


def _signed(body: bytes, secret: str | None, received: str, algorithm: str, prefix: str) -> bool:
    if not secret or not received:
        return False
    expected = prefix + hmac.new(secret.encode(), body, algorithm).hexdigest()
    return hmac.compare_digest(expected, received.strip())


def _eas_platform(payload: dict[str, Any]) -> str | None:
    platform = payload.get("platform")
    if payload.get("status") in EAS_DONE and platform in {"ios", "android"}:
        return str(platform)
    return None


def _asc_platform(payload: dict[str, Any]) -> str | None:
    data = payload.get("data")
    if isinstance(data, dict) and data.get("type") in ASC_EVENTS:
        return "ios"
    return None


def _dispatch(token: str, platform: str) -> int:
    request = urllib.request.Request(
        f"https://api.github.com/repos/{REPOSITORY}/actions/workflows/{WORKFLOW}/dispatches",
        data=json.dumps({"ref": REF, "inputs": {"platform": platform}}).encode(),
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mobile-beta-relay",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as reply:
            return int(reply.status)
    except urllib.error.HTTPError as error:
        return int(error.code)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if event.get("requestContext", {}).get("http", {}).get("method") != "POST":
        return _response(405, "POST only")

    raw = event.get("body") or ""
    body = base64.b64decode(raw) if event.get("isBase64Encoded") else raw.encode()
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}

    secrets = _load_secrets()
    if "expo-signature" in headers:
        source = "eas"
        valid = _signed(body, secrets.get("eas_webhook_secret"), headers["expo-signature"], "sha1", "sha1=")
    elif "x-apple-signature" in headers:
        source = "asc"
        valid = _signed(body, secrets.get("asc_webhook_secret"), headers["x-apple-signature"], "sha256", "hmacsha256=")
    else:
        source, valid = "unknown", False
    if not valid:
        print(json.dumps({"event": "rejected", "source": source}))
        return _response(401, "invalid signature")

    try:
        payload = json.loads(body)
    except ValueError:
        return _response(400, "invalid JSON")
    if not isinstance(payload, dict):
        return _response(400, "invalid JSON")

    platform = _eas_platform(payload) if source == "eas" else _asc_platform(payload)
    if platform is None:
        # Pings, failed builds, events of no use to the distribution: acknowledged so
        # the sender does not retry them.
        print(json.dumps({"event": "ignored", "source": source}))
        return _response(200, "ignored")

    token = secrets.get("github_token")
    if not token:
        print(json.dumps({"event": "no_github_token", "source": source}))
        return _response(503, "relay not configured")
    status = _dispatch(token, platform)
    print(json.dumps({"event": "dispatched", "source": source, "platform": platform, "github_status": status}))
    # 204 is GitHub's success. Anything else is answered 502 so the sender retries.
    return _response(202, "dispatched") if status == 204 else _response(502, "dispatch failed")
