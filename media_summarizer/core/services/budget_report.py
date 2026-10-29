"""Internal projections of the existing ledger, never another financial counter."""

from collections import Counter, defaultdict
from datetime import datetime, timezone
from math import ceil
from typing import Any, Dict, List, Mapping, Optional, Sequence

ACCOUNT_MONTH_FIELDS = (
    "user_id",
    "period",
    "cohort",
    "operations",
    "attempts",
    "automatic_attempts",
    "retries",
    "failed_attempts",
    "reuses_charged",
    "reuses_without_call_observed",
    "consumed_nano_eur",
    "held_nano_eur",
    "available_nano_eur",
    "returned_capacity_nano_eur",
    "operator_failure_cost_nano_eur",
    "provider_measured_nano_eur",
    "provider_estimated_nano_eur",
    "provider_unknown_cost_attempts",
    "provider_valued_total_nano_eur",
    "capped_by_settled_usage",
    "refused_budget_events",
    "automatic_refusal_events",
    "refusal_reasons",
    "observed_blocked_days",
    "total_blocked_duration",
    "active_after_prior_month_refusal",
    "counter_equation_matches",
    "settled_attempt_sum_matches",
    "open_attempt_sum_matches",
)

AUTOMATIC = {"review_blurb", "translation"}


def _amount(row: Mapping[str, Any], key: str) -> Optional[int]:
    value = row.get(key)
    return int(value) if value is not None else None


def _distribution(values: Sequence[int]) -> Dict[str, Optional[int]]:
    ordered = sorted(values)
    return {f"p{p}": ordered[max(0, ceil(len(ordered) * p / 100) - 1)] if ordered else None for p in [50, 90, 95, 99, 100]}


def build_report(
    items: Sequence[Mapping[str, Any]],
    *,
    first_month: str,
    last_month: str,
    cohorts: Mapping[str, str],
    selected_cohort: str = "all",
) -> Dict[str, Any]:
    groups: Dict[tuple[str, str], List[Mapping[str, Any]]] = defaultdict(list)
    for item in items:
        period = str(item.get("period_key", ""))
        user = str(item.get("user_id", ""))
        cohort = cohorts.get(user, "unknown")
        if first_month <= period <= last_month and user and (selected_cohort == "all" or cohort == selected_cohort):
            groups[(user, period)].append(item)

    rows: List[Dict[str, Any]] = []
    breakdown: Dict[tuple[str, str, str], Dict[str, Any]] = {}
    prior_refusals: Dict[str, List[str]] = defaultdict(list)
    for (user, period), entries in sorted(groups.items(), key=lambda pair: (pair[0][1], pair[0][0])):
        attempts = [item for item in entries if item.get("item_type") == "attempt"]
        observations = [item for item in entries if item.get("item_type") == "observation"]
        counter = next((item for item in entries if item.get("item_type") == "period"), {})
        refused = [item for item in observations if item.get("outcome") == "refused"]
        exhausted = [item for item in refused if item.get("refusal") == "budget_exhausted"]
        settled = [item for item in attempts if item.get("status") == "settled"]
        released = [item for item in attempts if item.get("status") == "released"]
        opened = [item for item in attempts if item.get("status") in {"held", "sending"}]
        measured, estimated, unknown = 0, 0, 0
        for item in attempts:
            if item.get("kind") == "reuse":
                # Capacity transferred to another account is not another paid call.
                continue
            status = item.get("status")
            value = _amount(item, "consumed_nano_eur" if status == "settled" else "operator_cost_nano_eur")
            if status not in {"settled", "released"}:
                value = None
            basis = item.get("cost_basis")
            if basis not in {"measured", "bound", "not_sent"} or (status == "settled" and not item.get("metric_source")):
                value = None
            is_estimated = basis == "bound" or item.get("metric_source") == "estimated"
            if value is None:
                unknown += 1
            elif is_estimated:
                estimated += value
            else:
                measured += value
            key = (cohorts.get(user, "unknown"), str(item.get("provider", "unknown")), str(item.get("component", "unknown")))
            group = breakdown.setdefault(
                key,
                {
                    "attempts": 0,
                    "measured_nano_eur": 0,
                    "estimated_nano_eur": 0,
                    "unknown_cost_attempts": 0,
                    "usage": Counter(),
                    "missing_usage_attempts": 0,
                },
            )
            group["attempts"] += 1
            if value is None:
                group["unknown_cost_attempts"] += 1
            else:
                group["estimated_nano_eur" if is_estimated else "measured_nano_eur"] += value
            usage = item.get("usage")
            if isinstance(usage, Mapping):
                group["usage"].update({str(k): int(v) for k, v in usage.items()})
            elif basis != "not_sent":
                group["missing_usage_attempts"] += 1
        consumed = _amount(counter, "consumed_nano_eur")
        budget = _amount(counter, "budget_nano_eur")
        held = _amount(counter, "held_nano_eur")
        available = _amount(counter, "available_nano_eur")
        rows.append(
            {
                "user_id": user,
                "period": period,
                "cohort": cohorts.get(user, "unknown"),
                "operations": len({item.get("operation_id") for item in attempts}),
                "attempts": len(attempts),
                "automatic_attempts": sum(str(item.get("component", "")).split(".")[0] in AUTOMATIC for item in attempts),
                "retries": sum(int(item.get("try_number", 1)) > 1 for item in attempts),
                "failed_attempts": sum(item.get("release_reason") in {"failed", "lost_in_flight", "expired"} for item in released),
                "reuses_charged": sum(item.get("kind") == "reuse" for item in attempts),
                "reuses_without_call_observed": sum(item.get("outcome") == "reused" for item in observations),
                "consumed_nano_eur": consumed,
                "held_nano_eur": held,
                "available_nano_eur": available,
                "returned_capacity_nano_eur": _amount(counter, "released_nano_eur"),
                "operator_failure_cost_nano_eur": _amount(counter, "operator_spend_nano_eur"),
                "provider_measured_nano_eur": measured,
                "provider_estimated_nano_eur": estimated,
                "provider_unknown_cost_attempts": unknown,
                "provider_valued_total_nano_eur": measured + estimated if not unknown else None,
                "capped_by_settled_usage": consumed >= budget if consumed is not None and budget is not None else None,
                "refused_budget_events": len(exhausted),
                "automatic_refusal_events": sum(item.get("automatic") is True for item in refused),
                "refusal_reasons": dict(Counter(str(item.get("refusal")) for item in refused)),
                "observed_blocked_days": len({str(item.get("created_at", ""))[:10] for item in exhausted}),
                "total_blocked_duration": None,
                "active_after_prior_month_refusal": bool(attempts) if prior_refusals[user] else None,
                "counter_equation_matches": available == budget - consumed - held
                if available is not None and budget is not None and consumed is not None and held is not None
                else None,
                "settled_attempt_sum_matches": consumed == sum(int(item.get("consumed_nano_eur", 0)) for item in settled)
                if consumed is not None and all(item.get("consumed_nano_eur") is not None for item in settled)
                else None,
                "open_attempt_sum_matches": held == sum(int(item.get("reserved_nano_eur", 0)) for item in opened)
                if held is not None and all(item.get("reserved_nano_eur") is not None for item in opened)
                else None,
            }
        )
        if exhausted:
            prior_refusals[user].append(period)
    recharges: List[Dict[str, Any]] = []
    for row in rows:
        if not row["refused_budget_events"]:
            continue
        year, month = (int(part) for part in row["period"].split("-"))
        following = f"{year + (month == 12):04d}-{1 if month == 12 else month + 1:02d}"
        observable = following <= last_month
        next_attempts = [item for item in groups.get((row["user_id"], following), []) if item.get("item_type") == "attempt"]
        recharges.append(
            {
                "user_id": row["user_id"],
                "refused_period": row["period"],
                "next_period": following,
                "window_contains_next_period": observable,
                "operations_observed": len({item.get("operation_id") for item in next_attempts}) if observable else None,
            }
        )
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "from": first_month,
        "through": last_month,
        "cohort": selected_cohort,
        "measurement_notes": [
            "All costs are normal-tariff valuations from the common ledger, not provider invoices or cash balances.",
            "Provider cost excludes charged reuse. Open/missing cost metrics remain unknown; estimated costs stay separate.",
            "Blocked days count UTC dates with an observed budget refusal, never inferred days without demand.",
            "No refused rows does not prove no refusals: persistence is best-effort; inspect observation_failed alarms.",
            "Recharge activity is observed only inside the report window; no prior refusal means unknown, not false.",
            "Snapshots are not transactional. Recent activity and TTL/account erasure can explain reconciliation gaps.",
        ],
        "accounts": len({row["user_id"] for row in rows}),
        "account_months": len(rows),
        "cohorts": dict(Counter(row["cohort"] for row in rows)),
        "capped_account_months": sum(row["capped_by_settled_usage"] is True for row in rows),
        "budget_refused_account_months": sum(row["refused_budget_events"] > 0 for row in rows),
        "known_provider_cost_account_months": sum(row["provider_valued_total_nano_eur"] is not None for row in rows),
        "unknown_provider_cost_account_months": sum(row["provider_valued_total_nano_eur"] is None for row in rows),
        "provider_cost_distribution_nano_eur": _distribution(
            [row["provider_valued_total_nano_eur"] for row in rows if row["provider_valued_total_nano_eur"] is not None]
        ),
        "consumption_distribution_nano_eur": _distribution(
            [row["consumed_nano_eur"] for row in rows if row["consumed_nano_eur"] is not None]
        ),
        "rows": rows,
        "recharges": recharges,
        "breakdown": [dict(cohort=key[0], provider=key[1], component=key[2], **value) for key, value in sorted(breakdown.items())],
        "operator": _operator_section(items, first_month=first_month, last_month=last_month),
    }


def _operator_section(items: Sequence[Mapping[str, Any]], *, first_month: str, last_month: str) -> Dict[str, Any]:
    """The operator partition of TASK-566, as the ledger transactions maintain it.

    All accounts together, whatever the cohort filter: the operator pays fixtures
    and testers alike. Not recomputed from the attempts, which are the same money.
    """
    operator = [item for item in items if item.get("user_id") == "operator"]
    control = next((item for item in operator if item.get("item_type") == "operator_control"), {})
    months = [
        {
            "month": str(item.get("month_key")),
            "delivered_nano_eur": int(item.get("delivered_nano_eur", 0)),
            "failed_nano_eur": int(item.get("failed_nano_eur", 0)),
            "failed_bound_nano_eur": int(item.get("failed_bound_nano_eur", 0)),
        }
        for item in operator
        if item.get("item_type") == "operator_month" and first_month <= str(item.get("month_key")) <= last_month
    ]
    circuits = [
        {key: item.get(key) for key in ("circuit_scope", "state", "suspension_kind", "suspension_reason", "opened_at", "open_until")}
        for item in operator
        if item.get("item_type") == "circuit" and item.get("state") != "closed"
    ]
    return {
        "open_commitments_nano_eur": int(control.get("held_nano_eur", 0)) if control else None,
        "months": sorted(months, key=lambda month: month["month"]),
        "suspensions": sorted(circuits, key=lambda circuit: str(circuit.get("circuit_scope"))),
    }
