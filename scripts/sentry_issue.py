import argparse
import json
import os
import sys
from typing import Any

import boto3
import requests
from botocore.exceptions import ClientError


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read Sentry issues and display their latest events with tags and breadcrumbs."
    )
    parser.add_argument(
        "--issue-id",
        help="Sentry issue ID or short-ID to fetch (e.g., SECOND-BRAIN-APP-2Q).",
    )
    parser.add_argument(
        "--query",
        help="Sentry search query (e.g., 'is:unresolved').",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_DEFAULT_REGION", "eu-west-3"),
        help="AWS region for Secrets Manager (default: eu-west-3).",
    )
    parser.add_argument(
        "--profile",
        default=os.environ.get("AWS_PROFILE", "second-brain-app"),
        help="AWS profile for Secrets Manager (default: second-brain-app).",
    )
    return parser.parse_args()


def _load_sentry_config(region: str, profile: str) -> dict[str, str]:
    """
    Load Sentry configuration from environment variables or AWS Secrets Manager.

    Priority:
    1. Environment variables (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)
    2. AWS Secrets Manager secret 'media-summarizer-devbox'

    Returns a dict with keys: auth_token, org, project.
    """
    auth_token = os.environ.get("SENTRY_AUTH_TOKEN")
    org = os.environ.get("SENTRY_ORG")
    project = os.environ.get("SENTRY_PROJECT")

    if auth_token and org and project:
        return {"auth_token": auth_token, "org": org, "project": project}

    # Fall back to AWS Secrets Manager
    try:
        session = boto3.Session(profile_name=profile)
        secrets_client = session.client("secretsmanager", region_name=region)
        response = secrets_client.get_secret_value(SecretId="media-summarizer-devbox")
        secret = json.loads(response["SecretString"])

        auth_token = secret.get("SENTRY_AUTH_TOKEN")
        org = secret.get("SENTRY_ORG")
        project = secret.get("SENTRY_PROJECT")

        if not auth_token or not org or not project:
            print(
                "Error: SENTRY_AUTH_TOKEN, SENTRY_ORG, or SENTRY_PROJECT missing from secret.",
                file=sys.stderr,
            )
            sys.exit(1)

        return {"auth_token": auth_token, "org": org, "project": project}
    except ClientError as exc:
        print(f"Failed to read secret from Secrets Manager: {exc}", file=sys.stderr)
        sys.exit(1)


def _fetch_issue(
    issue_id: str, org: str, project: str, auth_token: str
) -> dict[str, Any] | None:
    """Fetch a single issue by ID or short-ID."""
    url = f"https://sentry.io/api/0/projects/{org}/{project}/issues/{issue_id}/"
    headers = {"Authorization": f"Bearer {auth_token}"}

    response = requests.get(url, headers=headers, timeout=30)
    if response.status_code == 404:
        print(f"Issue {issue_id} not found.", file=sys.stderr)
        return None
    if response.status_code != 200:
        print(
            f"Failed to fetch issue {issue_id}: HTTP {response.status_code}",
            file=sys.stderr,
        )
        return None

    return response.json()


def _fetch_issues(
    query: str, org: str, project: str, auth_token: str
) -> list[dict[str, Any]]:
    """Fetch issues matching a search query."""
    url = f"https://sentry.io/api/0/projects/{org}/{project}/issues/"
    headers = {"Authorization": f"Bearer {auth_token}"}
    params: dict[str, str | int] = {"query": query, "limit": 10}

    response = requests.get(url, headers=headers, params=params, timeout=30)
    if response.status_code != 200:
        print(
            f"Failed to fetch issues: HTTP {response.status_code}", file=sys.stderr
        )
        sys.exit(1)

    return response.json()


def _fetch_latest_event(
    issue_id: str, org: str, project: str, auth_token: str
) -> dict[str, Any] | None:
    """Fetch the latest event for an issue."""
    url = f"https://sentry.io/api/0/projects/{org}/{project}/issues/{issue_id}/events/latest/"
    headers = {"Authorization": f"Bearer {auth_token}"}

    response = requests.get(url, headers=headers, timeout=30)
    if response.status_code == 404:
        print(f"No events found for issue {issue_id}.", file=sys.stderr)
        return None
    if response.status_code != 200:
        print(
            f"Failed to fetch latest event for issue {issue_id}: HTTP {response.status_code}",
            file=sys.stderr,
        )
        return None

    return response.json()


def _extract_media_item_id(breadcrumbs: list[dict[str, Any]]) -> str | None:
    """
    Extract mediaItemId from a 'save.created' breadcrumb.

    Returns the mediaItemId if found, otherwise None.
    """
    for crumb in breadcrumbs:
        if crumb.get("category") == "save.created":
            data = crumb.get("data", {})
            media_item_id = data.get("mediaItemId")
            if media_item_id:
                return media_item_id
    return None


def _format_cloudwatch_insights_query(media_item_id: str) -> str:
    """Generate a CloudWatch Insights query for a given media_item_id (== job_id)."""
    return f'filter job_id = "{media_item_id}"'


def _display_issue(
    issue: dict[str, Any], event: dict[str, Any] | None, show_insights_query: bool
) -> None:
    """Display an issue with its latest event details."""
    issue_id = issue.get("id", "unknown")
    short_id = issue.get("shortId", "unknown")
    title = issue.get("title", "No title")
    culprit = issue.get("culprit", "No culprit")

    print(f"\n{'=' * 80}")
    print(f"Issue: {short_id} (ID: {issue_id})")
    print(f"Title: {title}")
    print(f"Culprit: {culprit}")
    print(f"{'=' * 80}")

    if not event:
        print("No event data available.")
        return

    # Extract and display tags
    tags = event.get("tags", [])
    relevant_tag_keys = [
        "release",
        "dist",
        "ota.update_id",
        "ota.embedded_launch",
        "api.host",
        "environment",
    ]

    print("\n--- Tags ---")
    for tag in tags:
        key = tag.get("key")
        value = tag.get("value")
        if key in relevant_tag_keys:
            print(f"  {key}: {value}")

    # Extract and display breadcrumbs
    breadcrumbs_data = event.get("entries", [])
    breadcrumbs = []
    for entry in breadcrumbs_data:
        if entry.get("type") == "breadcrumbs":
            breadcrumbs = entry.get("data", {}).get("values", [])
            break

    print("\n--- Breadcrumbs ---")
    pipeline_categories = ["share.", "save.", "processing.", "translation."]
    if breadcrumbs:
        for crumb in breadcrumbs:
            category = crumb.get("category", "")
            message = crumb.get("message", "")
            level = crumb.get("level", "")
            timestamp = crumb.get("timestamp", "")

            # Highlight pipeline breadcrumbs
            is_pipeline = any(category.startswith(prefix) for prefix in pipeline_categories)
            marker = " [PIPELINE]" if is_pipeline else ""

            print(f"  [{timestamp}] [{level}] {category}{marker}: {message}")
            if crumb.get("data"):
                print(f"    Data: {json.dumps(crumb['data'], indent=6)}")
    else:
        print("  No breadcrumbs found.")

    # Extract mediaItemId from save.created breadcrumb
    media_item_id = _extract_media_item_id(breadcrumbs)
    if media_item_id and show_insights_query:
        print("\n--- CloudWatch Insights Query ---")
        print(f"  Media Item ID: {media_item_id}")
        print(f"  Query: {_format_cloudwatch_insights_query(media_item_id)}")
        print("  Run this query on the Lambda log groups to trace backend processing.")


def main() -> int:
    args = _parse_args()

    if not args.issue_id and args.query is None:
        print("Error: Must provide either --issue-id or --query.", file=sys.stderr)
        return 1

    config = _load_sentry_config(args.region, args.profile)
    auth_token = config["auth_token"]
    org = config["org"]
    project = config["project"]

    issues = []
    if args.issue_id:
        issue = _fetch_issue(args.issue_id, org, project, auth_token)
        if issue:
            issues = [issue]
    else:
        issues = _fetch_issues(args.query or "", org, project, auth_token)

    if not issues:
        print("No issues found.")
        return 0

    for issue in issues:
        issue_id = issue.get("id")
        if not issue_id:
            continue
        event = _fetch_latest_event(str(issue_id), org, project, auth_token)
        _display_issue(issue, event, show_insights_query=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
