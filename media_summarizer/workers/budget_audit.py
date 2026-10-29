"""Scheduled, read-only audit of the beta budget ledger.

Two readings every 30 minutes, neither of which writes anything:

- reservations no worker closed past their expiry (TASK-552);
- the operator's spend against its ceilings, the spend per account active this
  month, and the provider circuits still open (TASK-566). The figures come from
  the operator partition the ledger transactions maintain; the alarms of
  ``operator_control_alerts.tf`` read them off ``operator.spend_level``. Runbook:
  docs/OPERATOR_SPEND_CONTROL.md.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import boto3
from boto3.dynamodb.conditions import Attr, Key

from media_summarizer.core.services import operator_guard
from media_summarizer.core.services.pricing_config_service import DEFAULT_PRICING_CONFIG, _merge_defaults
from media_summarizer.utils import beta_budget_db
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)


def handle_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Scan only the sparse open index. Never releases or resets capacity."""
    try:
        dynamodb = boto3.resource("dynamodb")
        config = (
            dynamodb.Table(os.environ["PRICING_CONFIG_TABLE"])
            .get_item(
                Key={"config_key": "beta_access"},
                ConsistentRead=True,
            )
            .get("Item", {})
        )
        raw = config.get("config_value")
        beta = json.loads(raw) if raw else {}
        default_expiry = DEFAULT_PRICING_CONFIG["beta_access"]["hold_expiry_minutes"]
        expiry = int(beta.get("hold_expiry_minutes", default_expiry))
        if expiry <= 0:
            expiry = int(default_expiry)
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=expiry)).isoformat(timespec="microseconds")
        table = dynamodb.Table(os.environ["BETA_BUDGET_TABLE"])
        options: Dict[str, Any] = {"IndexName": "open-attempts-index", "FilterExpression": Attr("open_since").lt(cutoff)}
        stale = 0
        while True:
            page = table.scan(**options)
            stale += sum(item.get("status") in {"held", "sending"} for item in page.get("Items", []))
            key = page.get("LastEvaluatedKey")
            if not key:
                break
            options["ExclusiveStartKey"] = key
        if stale:
            log_event(
                logger,
                logging.WARNING,
                "beta_budget.audit_stale",
                "Reservations exceeded the configured expiry",
                stale_reservations=stale,
                cutoff=cutoff,
            )
        _audit_operator(dynamodb, table)
        log_event(
            logger, logging.INFO, "beta_budget.audit_succeeded", "Read-only reservation audit completed", stale_reservations=stale
        )
        return {"status": "completed", "stale_reservations": stale}
    except Exception as exc:
        log_event(logger, logging.ERROR, "beta_budget.audit_failed", "Reservation audit did not finish", error_type=type(exc).__name__)
        raise


def _pct(value: int, limit: int) -> float:
    return round(value * 100 / limit, 2) if limit > 0 else 100.0


def _audit_operator(dynamodb: Any, table: Any) -> None:
    """Log the operator's exposure, its drift per active account and its open circuits."""
    stored = (
        dynamodb.Table(os.environ["PRICING_CONFIG_TABLE"])
        .get_item(Key={"config_key": "operator_control"}, ConsistentRead=True)
        .get("Item", {})
    )
    raw = stored.get("config_value")
    block = _merge_defaults(DEFAULT_PRICING_CONFIG["operator_control"], json.loads(raw) if raw else {})
    limits = operator_guard.operator_limits({"operator_control": block})
    now = datetime.now(timezone.utc)

    def item(sk: str) -> Dict[str, Any]:
        key = {"user_id": beta_budget_db.OPERATOR_PARTITION, "sk": sk}
        return table.get_item(Key=key, ConsistentRead=True).get("Item", {})

    control = item(beta_budget_db.OPERATOR_CONTROL_SK)
    month = item(beta_budget_db.operator_month_sk(operator_guard.month_key(now)))
    day = item(beta_budget_db.operator_day_sk(operator_guard.day_key(now)))
    held = int(control.get(beta_budget_db.OP_HELD, 0))
    delivered = int(month.get(beta_budget_db.OP_DELIVERED, 0))
    failed_month = int(month.get(beta_budget_db.OP_FAILED, 0))
    failed_day = int(day.get(beta_budget_db.OP_FAILED, 0))

    # Accounts active this month: those whose month counter exists, which the
    # first reservation of the month creates. A scan, like the TASK-552 report:
    # proportional to the retained ledger, sufficient at beta scale.
    period = beta_budget_db.period_sk(operator_guard.month_key(now))
    options: Dict[str, Any] = {"FilterExpression": Attr("sk").eq(period), "ProjectionExpression": "user_id"}
    active = 0
    while True:
        page = table.scan(**options)
        active += len(page.get("Items", []))
        key = page.get("LastEvaluatedKey")
        if not key:
            break
        options["ExclusiveStartKey"] = key

    circuits = table.query(
        KeyConditionExpression=Key("user_id").eq(beta_budget_db.OPERATOR_PARTITION) & Key("sk").begins_with("circuit#"),
        ConsistentRead=True,
    ).get("Items", [])
    suspended = sorted(str(entry.get("circuit_scope", entry["sk"])) for entry in circuits if entry.get("state") != "closed")

    spend = delivered + failed_month
    per_account = spend // active if active else 0
    fields: Dict[str, Any] = {
        "held_nano_eur": held,
        "delivered_nano_eur": delivered,
        "failed_month_nano_eur": failed_month,
        "failed_day_nano_eur": failed_day,
        "failed_bound_nano_eur": int(month.get(beta_budget_db.OP_FAILED_BOUND, 0)),
        "active_accounts": active,
        "spend_per_active_account_eur": round(per_account / 1e9, 4),
        "open_circuits": len(suspended),
        "suspended_scopes": suspended,
        "config_valid": int(limits is not None),
    }
    if limits is not None:
        fields.update(
            exposure_pct=_pct(spend + held, limits.monthly_cap_nano_eur),
            loss_daily_pct=_pct(failed_day + held, limits.loss_daily_nano_eur),
            loss_monthly_pct=_pct(failed_month + held, limits.loss_monthly_nano_eur),
            per_account_drift=int(active > 0 and per_account > limits.per_active_account_alert_nano_eur),
        )
    log_event(logger, logging.INFO, "operator.spend_level", "Operator spend against its ceilings", **fields)
