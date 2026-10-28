"""
DynamoDB access layer for the shared provider-pool counters.

One table, `user_usage_monthly`, of which one row is still written: the shared row
keyed on PROVIDER_POOL_USER_ID, which counts provider spend across *all* users for
the shared free-tier pools of `provider_pool_guard` (Apify results, LlamaParse
pages), one row per calendar month. Those pools protect the operator's provider
accounts, not a tester's budget, and their fate is TASK-557's.

The per-account minute rows this table used to hold (`minutes_used`,
`cost_eur_estimated`, keyed on a subscription or trial period) are no longer read
or written: task-549 replaced every minute debit with the beta budget, whose ledger
is a table of its own (`utils/beta_budget_db.py`). The rows written before it on
dev gate nothing; account erasure still sweeps them with the account.

All counter increments use atomic ADD operations to avoid race conditions, guarded
by an idempotency token kept in `settled_jobs`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

from botocore.exceptions import ClientError

from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)

USER_USAGE_MONTHLY_TABLE = required_env("USER_USAGE_MONTHLY_TABLE")

# Reserved partition of the monthly table holding platform-wide provider spend.
# Not a user id, and it can never collide with one: user ids are UUIDs.
PROVIDER_POOL_USER_ID = "__provider_pools__"

# Platform-wide provider pool counters.
_POOL_COUNTERS: Mapping[str, str] = {
    "apify_results": "apify_results",
    "llamaparse_pages": "llamaparse_pages",
}


def _current_month() -> str:
    """Return the current calendar month in YYYY-MM format."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def _atomic_add(
    *,
    table_name: str,
    key: Dict[str, str],
    additions: Dict[str, Any],
    set_fields: Dict[str, Any],
    idempotency_token: Optional[str],
    log_name: str,
) -> bool:
    """Apply an atomic ADD, optionally guarded by an idempotency token.

    When `idempotency_token` is provided the token is added to the item's
    `settled_jobs` string set in the same update, under a condition that rejects
    the write if the token is already there. That makes a redelivered SQS message
    (or a retried worker run) debit the counters exactly once.

    Returns True when the counters moved, False when the write was skipped
    because the token had already been applied (or there was nothing to add).
    """
    additions = {name: value for name, value in additions.items() if value}
    if not additions:
        return False

    expr_names: Dict[str, str] = {}
    expr_values: Dict[str, Any] = {}
    add_parts = []
    for index, (attribute, value) in enumerate(additions.items()):
        placeholder = f"#a{index}"
        value_ref = f":a{index}"
        expr_names[placeholder] = attribute
        expr_values[value_ref] = value
        add_parts.append(f"{placeholder} {value_ref}")

    condition_expr: Optional[str] = None
    if idempotency_token:
        expr_names["#sj"] = "settled_jobs"
        expr_values[":sj"] = {idempotency_token}
        expr_values[":token"] = idempotency_token
        add_parts.append("#sj :sj")
        condition_expr = "attribute_not_exists(#sj) OR NOT contains(#sj, :token)"

    set_parts = []
    for index, (attribute, value) in enumerate(set_fields.items()):
        placeholder = f"#s{index}"
        value_ref = f":s{index}"
        expr_names[placeholder] = attribute
        expr_values[value_ref] = value
        set_parts.append(f"{placeholder} = {value_ref}")

    update_expr = "ADD " + ", ".join(add_parts)
    if set_parts:
        update_expr += " SET " + ", ".join(set_parts)

    request: Dict[str, Any] = {
        "Key": key,
        "UpdateExpression": update_expr,
        "ExpressionAttributeNames": expr_names,
        "ExpressionAttributeValues": expr_values,
    }
    if condition_expr:
        request["ConditionExpression"] = condition_expr

    session = database_async.get_session()
    async with session.resource(
        "dynamodb",
        region_name=database_async.AWS_REGION,
    ) as dynamodb:
        table = await dynamodb.Table(table_name)
        try:
            await table.update_item(**request)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                logger.info(
                    log_name,
                    extra={"key": key, "idempotency_token": idempotency_token},
                )
                return False
            raise

    return True


async def _get_item(table_name: str, key: Dict[str, str]) -> Optional[Dict[str, Any]]:
    session = database_async.get_session()
    async with session.resource(
        "dynamodb",
        region_name=database_async.AWS_REGION,
    ) as dynamodb:
        table = await dynamodb.Table(table_name)
        response = await table.get_item(Key=key)
        item = response.get("Item")
        return item if item else None


# ---------------------------------------------------------------------------
# Shared provider pools
# ---------------------------------------------------------------------------


async def get_provider_pool_usage(month: Optional[str] = None) -> Dict[str, int]:
    """Return this calendar month's provider spend across every user."""
    if month is None:
        month = _current_month()

    item = await _get_item(
        USER_USAGE_MONTHLY_TABLE,
        {"user_id": PROVIDER_POOL_USER_ID, "period": month},
    )
    if item is None:
        return {name: 0 for name in _POOL_COUNTERS}
    return {
        name: int(item.get(attribute, 0))
        for name, attribute in _POOL_COUNTERS.items()
    }


async def increment_provider_pool_usage(
    *,
    apify_results: int = 0,
    llamaparse_pages: int = 0,
    month: Optional[str] = None,
    idempotency_token: Optional[str] = None,
) -> bool:
    """Record provider spend against the shared monthly pool.

    Apify credit and LlamaParse credits are fixed monthly pools shared by every
    user, so no per-user allowance can protect them. This is the counter behind
    the alarm and the stop threshold of `provider_pools` in the pricing config.
    """
    if month is None:
        month = _current_month()

    provided = {
        "apify_results": apify_results,
        "llamaparse_pages": llamaparse_pages,
    }
    additions = {
        _POOL_COUNTERS[name]: value for name, value in provided.items() if value
    }

    return await _atomic_add(
        table_name=USER_USAGE_MONTHLY_TABLE,
        key={"user_id": PROVIDER_POOL_USER_ID, "period": month},
        additions=additions,
        set_fields={"last_updated": datetime.now(timezone.utc).isoformat()},
        idempotency_token=idempotency_token,
        log_name="quota.provider_pool_increment_skipped_duplicate",
    )
