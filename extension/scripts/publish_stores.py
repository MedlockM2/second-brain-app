"""Submit a distribution package to the Chrome Web Store and Edge Add-ons, when it changed.

Run by .github/workflows/deploy-extension.yml after `npm run zip`. For each store,
the package is compared with the last one that store accepted, by a fingerprint of
its contents without the manifest's version (a version bump alone is not a change).
Nothing is sent when they match.

Versions: the build keeps package.json's placeholder version; this script numbers
the package when it sends it. A content gets the next patch number the first time
it is sent (state "release"), and keeps it for every store and retry, so both
stores show the same number for the same content and numbers have no gaps. A
content that comes back after a newer one gets a new number: the stores refuse a
version lower than one they already have. When a store still has a submission in review, it
is skipped, its fingerprint is left as it was, and it is marked "pending": the next
push, or a scheduled run (which goes on only when a store is pending), sends
everything that piled up meanwhile.

State: the SSM parameter given by --state, on dev:
{"release": {"fingerprint", "version"}, "chrome": {...}, "edge": {...}}.

Credentials, from the environment (GitHub secrets):
- CWS_SERVICE_ACCOUNT_JSON: JSON key of the service account added to the Chrome
  Web Store publisher (Account › Service account), API v2.
- EDGE_CLIENT_ID, EDGE_API_KEY: Partner Center › Edge › Publish API. The key
  expires after 72 days; a 401 says so.

Edge wants certification notes with every submission: the template
store-review-notes.txt, filled with the `edge` demo account of the dev secret
`deepn-review-accounts` (scripts/create_review_account.py edge …).

Usage:
    python extension/scripts/publish_stores.py --package <zip> --commit <sha> \
        [--store chrome --store edge] [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path

import boto3
import requests

REGION = "eu-west-3"
CWS_PUBLISHER = "9b244133-da3c-4694-b982-3022c770191c"
CWS_ITEM = "enhnhoogannfcbfbchjdbidjkhlefadd"
CWS_API = "https://chromewebstore.googleapis.com"
EDGE_PRODUCT = "cf86fb2d-eef7-4b39-bedd-17ddd853af51"
EDGE_API = "https://api.addons.microsoftedge.microsoft.com/v1"
REVIEW_SECRET = "deepn-review-accounts"
NOTES = Path(__file__).with_name("store-review-notes.txt")
POLL_SECONDS, POLL_TRIES = 5, 60


class Busy(Exception):
    """The store still reviews an earlier submission: try again on the next push."""


def fingerprint(package: Path) -> tuple[str, str]:
    """Content hash of the package, the manifest's version left out; and that version."""
    digest = hashlib.sha256()
    with zipfile.ZipFile(package) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        version = manifest.pop("version")
        for name in sorted(archive.namelist()):
            data = (
                json.dumps(manifest, sort_keys=True).encode()
                if name == "manifest.json"
                else archive.read(name)
            )
            digest.update(name.encode() + b"\0" + hashlib.sha256(data).digest())
    return digest.hexdigest(), version


def next_version(state: dict, digest: str) -> str:
    """The number of this content: the last one sent if it is the same, else the next patch."""
    release = state.get("release", {})
    if release.get("fingerprint") == digest:
        return release["version"]
    major, minor, patch = (int(part) for part in release.get("version", "1.0.0").split("."))
    return f"{major}.{minor}.{patch + 1}"


def stamp(package: Path, version: str) -> Path:
    """Copy of the package with this version in its manifest, the other entries untouched."""
    target = package.with_name(re.sub(r"-\d+\.\d+\.\d+-", f"-{version}-", package.name))
    if target == package:
        target = package.with_name(f"{package.stem}-{version}.zip")
    with zipfile.ZipFile(package) as source, zipfile.ZipFile(target, "w") as copy:
        for entry in source.infolist():
            data = source.read(entry)
            if entry.filename == "manifest.json":
                data, count = re.subn(
                    rb'("version"\s*:\s*")[^"]*"', lambda m: m.group(1) + version.encode() + b'"', data, count=1
                )
                if count != 1:
                    raise SystemExit("manifest.json has no version to set")
            copy.writestr(entry, data)
    return target


def fail(response: requests.Response, what: str) -> None:
    if response.status_code == 401:
        raise SystemExit(f"{what}: 401, credentials refused or expired (Edge API keys last 72 days).")
    if not response.ok:
        raise SystemExit(f"{what}: HTTP {response.status_code} {response.text[:500]}")


def publish_chrome(package: Path) -> str:
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    info = json.loads(os.environ["CWS_SERVICE_ACCOUNT_JSON"])
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/chromewebstore"]
    )
    credentials.refresh(Request())
    headers = {"Authorization": f"Bearer {credentials.token}"}
    name = f"publishers/{CWS_PUBLISHER}/items/{CWS_ITEM}"

    status = requests.get(f"{CWS_API}/v2/{name}:fetchStatus", headers=headers, timeout=60)
    fail(status, "Chrome fetchStatus")
    body = status.json()
    submitted = (body.get("submittedItemRevisionStatus") or {}).get("state")
    published = (body.get("publishedItemRevisionStatus") or {}).get("state")
    print(f"Chrome before upload: submitted {submitted}, published {published}")
    if submitted == "PENDING_REVIEW":
        raise Busy("a submission is pending review")

    upload = requests.post(
        f"{CWS_API}/upload/v2/{name}:upload",
        headers={**headers, "Content-Type": "application/zip"},
        data=package.read_bytes(),
        timeout=300,
    )
    fail(upload, "Chrome upload")
    state = upload.json().get("uploadState")
    for _ in range(POLL_TRIES):
        if state != "IN_PROGRESS":
            break
        time.sleep(POLL_SECONDS)
        status = requests.get(f"{CWS_API}/v2/{name}:fetchStatus", headers=headers, timeout=60)
        fail(status, "Chrome fetchStatus")
        state = status.json().get("lastAsyncUploadState")
    if state != "SUCCEEDED":
        raise SystemExit(f"Chrome upload ended in {state}: {upload.text[:500]}")

    publish = requests.post(
        f"{CWS_API}/v2/{name}:publish",
        headers=headers,
        json={"publishType": "DEFAULT_PUBLISH"},
        timeout=60,
    )
    fail(publish, "Chrome publish")
    return publish.json().get("state", "submitted")


def edge_operation(url: str, headers: dict[str, str], what: str) -> dict:
    for _ in range(POLL_TRIES):
        response = requests.get(url, headers=headers, timeout=60)
        fail(response, what)
        body = response.json()
        if body.get("status") != "InProgress":
            return body
        time.sleep(POLL_SECONDS)
    raise SystemExit(f"{what}: still in progress after {POLL_SECONDS * POLL_TRIES}s")


def review_notes() -> str:
    secret = boto3.client("secretsmanager", region_name=REGION).get_secret_value(SecretId=REVIEW_SECRET)
    account = json.loads(secret["SecretString"])["edge"]
    return NOTES.read_text().format(email=account["email"], password=account["password"])


def publish_edge(package: Path) -> str:
    headers = {"Authorization": f"ApiKey {os.environ['EDGE_API_KEY']}", "X-ClientID": os.environ["EDGE_CLIENT_ID"]}
    product = f"{EDGE_API}/products/{EDGE_PRODUCT}"

    upload = requests.post(
        f"{product}/submissions/draft/package",
        headers={**headers, "Content-Type": "application/zip"},
        data=package.read_bytes(),
        timeout=300,
    )
    if upload.status_code == 409 or "InProgressSubmission" in upload.text:
        raise Busy("a submission is in review")
    fail(upload, "Edge upload")
    result = edge_operation(
        f"{product}/submissions/draft/package/operations/{upload.headers['Location']}", headers, "Edge upload"
    )
    if result.get("status") != "Succeeded":
        if result.get("errorCode") == "InProgressSubmission":
            raise Busy("a submission is in review")
        raise SystemExit(f"Edge upload failed: {json.dumps(result)[:800]}")

    publish = requests.post(f"{product}/submissions", headers=headers, data=review_notes().encode(), timeout=60)
    fail(publish, "Edge publish")
    result = edge_operation(
        f"{product}/submissions/operations/{publish.headers['Location']}", headers, "Edge publish"
    )
    if result.get("status") != "Succeeded":
        if result.get("errorCode") in {"InProgressSubmission", "UnpublishInProgress"}:
            raise Busy(result.get("message", "a submission is in progress"))
        raise SystemExit(f"Edge publish failed: {json.dumps(result)[:800]}")
    return "in review"


PUBLISHERS = {"chrome": publish_chrome, "edge": publish_edge}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--state", default="/deepn/extension/store-state")
    parser.add_argument("--store", action="append", choices=sorted(PUBLISHERS))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ssm = boto3.client("ssm", region_name=REGION)
    try:
        state = json.loads(ssm.get_parameter(Name=args.state)["Parameter"]["Value"])
    except ssm.exceptions.ParameterNotFound:
        state = {}

    digest, _ = fingerprint(args.package)
    version = next_version(state, digest)
    summary = [f"Package {version}, fingerprint {digest[:12]}"]
    changed = False
    package: Path | None = None
    for store in args.store or sorted(PUBLISHERS):
        previous = state.get(store, {})
        if previous.get("fingerprint") == digest:
            summary.append(f"- {store}: unchanged since {previous.get('version')}, nothing sent")
            continue
        if args.dry_run:
            summary.append(f"- {store}: would submit {version} (last: {previous.get('version', 'none')})")
            continue
        package = package or stamp(args.package, version)
        try:
            outcome = PUBLISHERS[store](package)
        except Busy as busy:
            # Marks the store as owed a submission: a scheduled run of
            # deploy-extension.yml goes on only when some store carries this mark.
            if previous.get("pending") != digest:
                state[store] = {**previous, "pending": digest}
                changed = True
            summary.append(f"- {store}: skipped, {busy}; retried by the next run")
            continue
        state[store] = {"fingerprint": digest, "version": version, "commit": args.commit, "outcome": outcome}
        state["release"] = {"fingerprint": digest, "version": version}
        changed = True
        summary.append(f"- {store}: submitted {version} ({outcome})")

    if changed:
        ssm.put_parameter(Name=args.state, Value=json.dumps(state), Type="String", Overwrite=True)
    print("\n".join(summary))
    if summary_file := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary_file, "a") as handle:
            handle.write("\n".join(summary) + "\n")


if __name__ == "__main__":
    sys.exit(main())
