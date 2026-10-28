#!/usr/bin/env python3
"""Read the real beta ledger and export a private JSON report and account-month CSV."""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from media_summarizer.core.services.budget_report import ACCOUNT_MONTH_FIELDS, build_report  # noqa: E402


def month(value: str) -> str:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        raise argparse.ArgumentTypeError("Use YYYY-MM")
    return value


def private_output(path: str) -> Path:
    directory = Path(path).expanduser().resolve()
    ancestor = directory
    while not ancestor.exists():
        ancestor = ancestor.parent
    inside = subprocess.run(["git", "-C", str(ancestor), "rev-parse", "--is-inside-work-tree"], capture_output=True, text=True)
    if inside.returncode == 0 and inside.stdout.strip() == "true":
        raise ValueError("Reports must be outside every Git checkout, including ignored directories")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    return directory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", required=True, help="Explicit beta_budget-<env> table")
    parser.add_argument("--profile", help="Named AWS profile; no credentials in arguments")
    parser.add_argument("--region", default="eu-west-3")
    parser.add_argument("--from", dest="first", type=month, required=True)
    parser.add_argument("--through", type=month, required=True)
    parser.add_argument("--cohort-file", help="Private JSON object mapping user IDs to beta or fixture; absent IDs remain unknown")
    parser.add_argument("--cohort", choices=["all", "beta", "fixture", "unknown"], default="all")
    parser.add_argument("--output-dir", required=True, help="Private destination outside any Git checkout")
    args = parser.parse_args()
    if args.first > args.through:
        parser.error("--from must not be after --through")
    destination = private_output(args.output_dir)
    cohorts = json.loads(Path(args.cohort_file).read_text()) if args.cohort_file else {}
    if not isinstance(cohorts, dict) or any(value not in {"beta", "fixture"} for value in cohorts.values()):
        parser.error("Cohort file must map account IDs to beta or fixture, without account identities")
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    table = session.resource("dynamodb").Table(args.table)
    items: List[Dict[str, Any]] = []
    options: Dict[str, Any] = {"ConsistentRead": True}
    while True:
        page = table.scan(**options)
        # Filter locally: attempts, observations and counters use the same period
        # attribute. Scanning is intentional for an internal, operator-run report.
        items.extend(page.get("Items", []))
        key = page.get("LastEvaluatedKey")
        if not key:
            break
        options["ExclusiveStartKey"] = key
    report = build_report(items, first_month=args.first, last_month=args.through, cohorts=cohorts, selected_cohort=args.cohort)
    report["source_table"] = args.table
    for name in ["report.json", "account-months.csv"]:
        output = destination / name
        # Symlinks must not redirect a report back into a checkout or another file.
        if output.is_symlink():
            raise ValueError("Report destination must not be a symbolic link")
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", dir=destination, delete=False) as stream:
                temporary = Path(stream.name)
                os.fchmod(stream.fileno(), 0o600)
                if name.endswith(".json"):
                    json.dump(report, stream, indent=2, ensure_ascii=False)
                else:
                    writer = csv.DictWriter(stream, fieldnames=ACCOUNT_MONTH_FIELDS)
                    writer.writeheader()
                    for row in report["rows"]:
                        writer.writerow({key: json.dumps(value) if isinstance(value, dict) else value for key, value in row.items()})
            # Replacing the directory entry avoids following symlinks/hard links
            # and leaves either the old complete export or the new complete one.
            os.replace(temporary, output)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
    print(f"Exported {report['account_months']} account-months; private files written outside Git.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
