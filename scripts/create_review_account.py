"""Create a ready-to-use demo account for App Store or Google Play review, on dev.

Apple (guideline 2.1) and Google (App access declaration) both want working
sign-in credentials, even though anyone can register in the app. This script
builds one account the way the app would, then skips what a reviewer must never
hit:

1. registers through the dev API (`POST /api/auth/register`);
2. confirms it in Cognito with the admin API, so no e-mail code is needed;
3. signs in, sets the reading language to English;
4. saves a few public items and generates a summary of each, plus flashcards
   of the talk, so the reviewer sees content without waiting for a generation.

One account per store: a reviewer may test Delete Account, which must not break
the other store's credentials. After a review that deleted it, run the script
again with the same store and e-mail.

The password is generated here and stored, with the e-mail, under the store's key
of the dev secret `deepn-review-accounts` -- the place to read the credentials
from when filling App Store Connect or the Play Console. Never in a tracked file.

Usage (dev credentials):
    AWS_PROFILE=second-brain-app uv run python scripts/create_review_account.py <apple|google> <e-mail>

Use a "+" alias of the project mailbox, one per store, so the address really
receives mail. The addresses themselves stay out of tracked files, like the
passwords.
"""

from __future__ import annotations

import argparse
import json
import secrets
import string
import sys

import boto3
import requests

API = "https://jji077bi8e.execute-api.eu-west-3.amazonaws.com"
USER_POOL_ID = "eu-west-3_kvjrhVwnV"
REGION = "eu-west-3"
SECRET_ID = "deepn-review-accounts"

#: Public pages and a public talk: nothing a reviewer could read as private data.
DEMO_URLS = (
    "https://en.wikipedia.org/wiki/Spaced_repetition",
    "https://en.wikipedia.org/wiki/Forgetting_curve",
    "https://www.youtube.com/watch?v=arj7oStGLkU",
)


def generate_password() -> str:
    # Typed by hand by a reviewer: no look-alike characters, and the shape the
    # Cognito policy requires (upper, lower, digit, symbol).
    letters = string.ascii_letters.translate(str.maketrans("", "", "lIO"))
    return "Deepn-" + "".join(secrets.choice(letters) for _ in range(6)) + "-" + "".join(
        secrets.choice("23456789") for _ in range(4)
    )


def seed_artifacts(headers: dict[str, str], media_ids: list[str]) -> None:
    """Request a summary of every item and flashcards of the last one (the talk).

    An item still being transcribed answers with a refusal: the reviewer can then
    generate it from the app, nothing else depends on it.
    """
    requests_ = [(media_id, "summary_short") for media_id in media_ids] + [(media_ids[-1], "flashcards")]
    for media_id, artifact_type in requests_:
        response = requests.post(
            f"{API}/api/artifacts",
            json={"scope": "media", "scope_id": media_id, "artifact_type": artifact_type},
            headers=headers,
            timeout=60,
        )
        print(f"{artifact_type} of {media_id} -> HTTP {response.status_code}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("store", choices=("apple", "google"))
    parser.add_argument("email")
    args = parser.parse_args()
    email = args.email.strip().lower()
    password = generate_password()

    response = requests.post(f"{API}/api/auth/register", json={"email": email, "password": password}, timeout=30)
    if response.status_code != 202:
        sys.exit(f"register: HTTP {response.status_code} {response.text[:200]}")

    cognito = boto3.client("cognito-idp", region_name=REGION)
    users = cognito.list_users(UserPoolId=USER_POOL_ID, Filter=f'email = "{email}"')["Users"]
    username = next(u["Username"] for u in users if u["UserStatus"] == "UNCONFIRMED")
    cognito.admin_confirm_sign_up(UserPoolId=USER_POOL_ID, Username=username)
    cognito.admin_update_user_attributes(
        UserPoolId=USER_POOL_ID, Username=username, UserAttributes=[{"Name": "email_verified", "Value": "true"}]
    )

    response = requests.post(f"{API}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    response.raise_for_status()
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    requests.patch(f"{API}/api/auth/me", json={"reading_language": "en"}, headers=headers, timeout=30).raise_for_status()
    media_ids = []
    for url in DEMO_URLS:
        item = requests.post(f"{API}/api/media/ingest-url", json={"url": url, "locale": "en"}, headers=headers, timeout=60)
        print(f"{url} -> HTTP {item.status_code} {item.json().get('status')}")
        media_ids.append(item.json()["media_item_id"])
    seed_artifacts(headers, media_ids)

    secrets_manager = boto3.client("secretsmanager", region_name=REGION)
    accounts = json.loads(secrets_manager.get_secret_value(SecretId=SECRET_ID)["SecretString"])
    accounts[args.store] = {"email": email, "password": password}
    secrets_manager.put_secret_value(SecretId=SECRET_ID, SecretString=json.dumps(accounts))
    print(f"\n{args.store} account stored in {SECRET_ID}. Update the password in the store console.")


if __name__ == "__main__":
    main()
