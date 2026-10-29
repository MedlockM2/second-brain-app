#!/usr/bin/env python3
"""Read, pause or resume the operator spend control (TASK-566).

Runbook: docs/OPERATOR_SPEND_CONTROL.md. Every command names its table explicitly;
nothing here reads a credential, a balance or an account identity.

    .venv/bin/python scripts/operator_control.py --profile second-brain-app --table beta_budget-dev status
    .venv/bin/python scripts/operator_control.py ... suspend --scope deepgram --note "incident"
    .venv/bin/python scripts/operator_control.py ... resume --scope deepgram

``resume`` of a provider sets it ``half_open``: the next real request probes it and
three successes close it. ``resume --scope all`` lifts the manual pause at once.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SCOPES = ("all", "openai", "deepgram", "llamaparse", "unstructured", "apify", "x_api")


async def _status() -> dict:
    from media_summarizer.core.services import operator_guard
    from media_summarizer.utils import beta_budget_db

    state = await operator_guard.read_state(datetime.now(timezone.utc))
    circuits = {}
    for scope in SCOPES:
        item = await beta_budget_db.get_item(beta_budget_db.OPERATOR_PARTITION, beta_budget_db.circuit_sk(scope))
        if item:
            circuits[scope] = {
                key: item.get(key)
                for key in (
                    "state", "suspension_kind", "suspension_reason", "owner_note",
                    "opened_at", "open_until", "consecutive_failures", "probe_successes",
                )
                if item.get(key) is not None
            }
    eur = 10**9
    return {
        "open_commitments_eur": state.held_nano_eur / eur,
        "month_delivered_eur": state.delivered_month_nano_eur / eur,
        "month_failed_eur": state.failed_month_nano_eur / eur,
        "day_failed_eur": state.failed_day_nano_eur / eur,
        "month_exposure_eur": state.exposure_month_nano_eur / eur,
        "circuits": circuits,
    }


async def _run(args: argparse.Namespace) -> None:
    from media_summarizer.core.services import operator_guard

    if args.command == "suspend":
        await operator_guard.suspend(args.scope, note=args.note)
    elif args.command == "resume":
        await operator_guard.resume(args.scope)
    print(json.dumps(await _status(), indent=2, default=str, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--table", required=True, help="Explicit beta_budget-<env> table")
    parser.add_argument("--profile", help="Named AWS profile; no credentials in arguments")
    parser.add_argument("--region", default="eu-west-3")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status")
    suspend = commands.add_parser("suspend")
    suspend.add_argument("--scope", choices=SCOPES, required=True)
    suspend.add_argument("--note", default="", help="Why, in a few words; no account identity")
    resume = commands.add_parser("resume")
    resume.add_argument("--scope", choices=SCOPES, required=True)
    args = parser.parse_args()

    os.environ["BETA_BUDGET_TABLE"] = args.table
    os.environ["AWS_REGION"] = args.region
    if args.profile:
        os.environ["AWS_PROFILE"] = args.profile
    asyncio.run(_run(args))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
