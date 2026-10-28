"""Scheduled, read-only audit of reservations no worker closed (TASK-552)."""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import boto3
from boto3.dynamodb.conditions import Attr

from media_summarizer.core.services.pricing_config_service import DEFAULT_PRICING_CONFIG
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
        log_event(
            logger, logging.INFO, "beta_budget.audit_succeeded", "Read-only reservation audit completed", stale_reservations=stale
        )
        return {"status": "completed", "stale_reservations": stale}
    except Exception as exc:
        log_event(logger, logging.ERROR, "beta_budget.audit_failed", "Reservation audit did not finish", error_type=type(exc).__name__)
        raise
