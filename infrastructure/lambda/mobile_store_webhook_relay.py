"""Relay EAS and App Store Connect webhooks to the mobile CI workflows (TASK-635).

Two workflows used to poll EAS and the stores every 30 minutes for events that
exist as webhooks. This function receives them, checks their signature, and asks
GitHub to run the workflow concerned:

- ``mobile-beta-distribute.yml``, for the platform concerned, when an EAS build or
  submission finishes, when Apple finishes processing an upload, and when Apple
  ends the external beta review;
- ``mobile-build-watch.yml`` when an EAS **build** errors (the build was started
  with ``--no-wait``, so no job is left to fail) or an EAS **submission** errors
  (the store never got the build, and the distribution only waits for it). The
  watcher opens the issue; for a submission, the fields it shows come from this
  webhook, since EAS has no read-only command for a submission.

Both workflows keep one safety run a day: Google Play sends no webhook when a
track review ends, and a webhook can be lost.

Every request is authenticated before anything else happens: an unsigned or badly
signed body is refused with 401 and never reaches GitHub. The GitHub token and both
webhook secrets come from one Secrets Manager secret, re-read at most every
``SECRET_TTL_SECONDS``: a warm instance picks up a filled-in or rotated secret
within minutes instead of keeping the value it started with.

Entry point: an API Gateway HTTP API (payload format 2.0), see
infrastructure/terraform/envs/dev/mobile_store_webhook_relay.tf.
"""

import base64
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any

import boto3

SECRET_ID = os.environ["RELAY_SECRET_ID"]
REPOSITORY = os.environ["GITHUB_REPOSITORY"]
DISTRIBUTE_WORKFLOW = os.environ.get("GITHUB_DISTRIBUTE_WORKFLOW", "mobile-beta-distribute.yml")
BUILD_WATCH_WORKFLOW = os.environ.get("GITHUB_BUILD_WATCH_WORKFLOW", "mobile-build-watch.yml")
REF = os.environ.get("GITHUB_REF", "main")

# App Store Connect events that change what the distribution script can do next.
ASC_EVENTS = {"buildUploadStateUpdated", "buildBetaDetailExternalBuildStateUpdated"}

SECRET_TTL_SECONDS = 300

_secrets: dict[str, str] = {}
_secrets_read_at = 0.0


def _load_secrets() -> dict[str, str]:
    global _secrets, _secrets_read_at
    if not _secrets_read_at or time.monotonic() - _secrets_read_at > SECRET_TTL_SECONDS:
        value = boto3.client("secretsmanager").get_secret_value(SecretId=SECRET_ID)["SecretString"]
        _secrets = {k: v for k, v in json.loads(value).items() if isinstance(v, str)}
        _secrets_read_at = time.monotonic()
    return _secrets


def _response(status: int, message: str) -> dict[str, Any]:
    return {"statusCode": status, "headers": {"content-type": "text/plain"}, "body": message}


def _signed(body: bytes, secret: str | None, received: str, algorithm: str, prefix: str) -> bool:
    if not secret or not received:
        return False
    expected = prefix + hmac.new(secret.encode(), body, algorithm).hexdigest()
    return hmac.compare_digest(expected, received.strip())


def _eas_target(payload: dict[str, Any]) -> tuple[str, dict[str, str]] | None:
    """The workflow an EAS build or submission event wakes, with its inputs.

    ``finished`` (build or submission): the distribution, for that platform.
    ``errored``: the watcher, which opens the issue. A build payload has
    ``buildDetailsPageUrl`` and the watcher lists errored builds itself; a
    submission payload has ``submissionDetailsPageUrl`` and its fields travel as
    inputs. ``canceled`` wakes nothing: cancelling is the owner's own act.
    """
    status = payload.get("status")
    platform = payload.get("platform")
    if status == "finished" and platform in {"ios", "android"}:
        return DISTRIBUTE_WORKFLOW, {"platform": str(platform)}
    if status == "errored" and "buildDetailsPageUrl" in payload:
        return BUILD_WATCH_WORKFLOW, {}
    if status == "errored" and "submissionDetailsPageUrl" in payload:
        info = payload.get("submissionInfo")
        info = info if isinstance(info, dict) else {}
        error = info.get("error")
        error = error if isinstance(error, dict) else {}
        return BUILD_WATCH_WORKFLOW, {
            "submission_id": _field(payload.get("id")),
            "submission_platform": _field(platform),
            "submission_build_id": _field(payload.get("turtleBuildId")),
            "submission_error_code": _field(error.get("errorCode")),
            "submission_error_message": _field(error.get("message"), limit=1000),
            "submission_logs_url": _field(info.get("logsUrl")),
            "submission_page_url": _field(payload.get("submissionDetailsPageUrl")),
        }
    return None


def _field(value: Any, *, limit: int = 300) -> str:
    """A webhook value as a workflow input: a string, bounded."""
    return value.strip()[:limit] if isinstance(value, str) else ""


def _asc_target(payload: dict[str, Any]) -> tuple[str, dict[str, str]] | None:
    data = payload.get("data")
    if isinstance(data, dict) and data.get("type") in ASC_EVENTS:
        return DISTRIBUTE_WORKFLOW, {"platform": "ios"}
    return None


def _dispatch(token: str, workflow: str, inputs: dict[str, str]) -> int:
    request = urllib.request.Request(
        f"https://api.github.com/repos/{REPOSITORY}/actions/workflows/{workflow}/dispatches",
        data=json.dumps({"ref": REF, "inputs": inputs}).encode(),
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mobile-store-webhook-relay",
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

    target = _eas_target(payload) if source == "eas" else _asc_target(payload)
    if target is None:
        # Pings, canceled builds or submissions, events no workflow needs:
        # acknowledged so the sender does not retry them.
        print(json.dumps({"event": "ignored", "source": source}))
        return _response(200, "ignored")

    token = secrets.get("github_token")
    if not token:
        print(json.dumps({"event": "no_github_token", "source": source}))
        return _response(503, "relay not configured")
    workflow, inputs = target
    status = _dispatch(token, workflow, inputs)
    logged = {key: value for key, value in inputs.items() if key in ("platform", "submission_id", "submission_error_code")}
    print(json.dumps({"event": "dispatched", "source": source, "workflow": workflow, **logged, "github_status": status}))
    # 204 is GitHub's success. Anything else is answered 502 so the sender retries.
    return _response(202, "dispatched") if status == 204 else _response(502, "dispatch failed")
