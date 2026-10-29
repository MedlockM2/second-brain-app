"""
DynamoDB access layer of the beta budget ledger (task-548).

Schema, transitions and the condition of every write: ``docs/BETA_BUDGET_CONTROL.md``.
Models: ``core/models/beta_budget.py``. The rules that decide *what* to write —
bounds, valuation, exchange rate, which transition applies — live in
``core/services/beta_budget.py``; this module only knows how to write it so that
two concurrent writers can never both win.

Every write that moves money changes the period counter **and** the attempt in one
``TransactWriteItems`` call, so the four amounts of the counter always equal the
sum of what the attempts say. Three rules hold here and nowhere else:

- **admission is one conditional write** (rule 4 of the decision). The counter's
  ``available_nano_eur`` is decremented under the condition that it covers the
  bound, in the same transaction that creates the attempts. DynamoDB cannot add two
  attributes inside a condition, which is why ``available`` is maintained as its own
  attribute instead of being recomputed from the others;
- **an attempt closes once.** Settling and releasing are conditional on the attempt
  still being open, so a redelivered message, a late callback or a second worker
  finds the condition false and moves nothing;
- **a refusal by condition is an answer, anything else is an error.** A cancelled
  transaction whose failing items all failed their condition comes back as the list
  of per-item codes; a conflict with a concurrent transaction is retried a bounded
  number of times; everything else raises :class:`LedgerUnavailableError`, which
  the service turns into a refusal (rule 7: the counter failing refuses the call).

The operator control of TASK-566 lives in the same table, in one partition of its
own (``user_id = "operator"``, never a Cognito sub): the commitments open across
every account, the operator's spend per month and per day, and one circuit per
provider. Its items are moved **inside** the transactions above — an admission
adds its bound to the open commitments, a close moves it to the spend — so the
operator figures are the sum of the attempts and never a second count of them.
"""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Sequence

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import BotoCoreError, ClientError

from media_summarizer.core.models.beta_budget import ATTEMPT_SK_PREFIX, PERIOD_SK_PREFIX
from media_summarizer.utils.database_async import (
    _dynamodb_client_kwargs,
    _log_dynamodb_error,
    get_session,
)
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)


class LedgerUnavailableError(Exception):
    """The ledger could not be read or written for a reason other than a condition."""


def _table() -> str:
    """The ledger table's name, resolved when the ledger is used, not at import.

    Every Lambda imports this module through ``quota_enforcer``, while only the
    paths that reserve or settle touch the ledger. Resolving the name at import
    would turn a missing ``BETA_BUDGET_TABLE`` into a failed cold start of every
    function, API included — for instance in the minutes between a code deploy
    and the Terraform apply that injects the name. Resolved here, a missing name
    fails the ledger call alone, logged, as an unavailable ledger: an admission
    then refuses (rule 7).
    """
    try:
        return required_env("BETA_BUDGET_TABLE")
    except RuntimeError as exc:
        logger.error("beta_budget.table_name_missing")
        raise LedgerUnavailableError("BETA_BUDGET_TABLE is not set") from exc


#: Sparse index of the attempts still open: only ``held`` and ``sending`` attempts
#: carry ``open_since``, so the backstop reads open attempts without reading the
#: account's whole history.
OPEN_ATTEMPTS_INDEX = "open-attempts-index"

#: Tries of a transaction cancelled by a concurrent transaction on the same counter
#: (two admissions of one account at the same instant, or any two writes of the
#: operator's open commitments, which every admission and close touches). Bounded:
#: a counter that keeps conflicting is treated as unavailable.
_TRANSACTION_TRIES = 5
_CONFLICT_BACKOFF_SECONDS = 0.05

# Counter attributes. The names are the schema of docs/BETA_BUDGET_CONTROL.md §2.1.
BUDGET = "budget_nano_eur"
AVAILABLE = "available_nano_eur"
HELD = "held_nano_eur"
CONSUMED = "consumed_nano_eur"
RELEASED = "released_nano_eur"
OPERATOR_SPEND = "operator_spend_nano_eur"
COUNTER_AMOUNTS = (BUDGET, AVAILABLE, HELD, CONSUMED, RELEASED, OPERATOR_SPEND)

# The operator partition (TASK-566, docs/OPERATOR_SPEND_CONTROL.md §2).
OPERATOR_PARTITION = "operator"
OPERATOR_CONTROL_SK = "control"
#: Open commitments of every account, and the version every admission is
#: conditioned on: the ceilings add figures of several items, which a DynamoDB
#: condition cannot, so an admission reads them, checks them, and commits only if
#: nothing moved the commitments in between.
OP_HELD = "held_nano_eur"
OP_VERSION = "version"
#: Spend of a month or a day, at the barème: delivered results, failures (the
#: operator spend of the account counters), and the part of the failures that is
#: a reserved bound standing in for a missing metric.
OP_DELIVERED = "delivered_nano_eur"
OP_FAILED = "failed_nano_eur"
OP_FAILED_BOUND = "failed_bound_nano_eur"

_serializer = TypeSerializer()


def period_sk(period_key: str) -> str:
    return f"{PERIOD_SK_PREFIX}{period_key}"


def attempt_sk(attempt_id: str) -> str:
    return f"{ATTEMPT_SK_PREFIX}{attempt_id}"


def operator_month_sk(month_key: str) -> str:
    return f"month#{month_key}"


def operator_day_sk(day_key: str) -> str:
    return f"day#{day_key}"


def circuit_sk(scope: str) -> str:
    return f"circuit#{scope}"


@dataclass(frozen=True)
class OperatorHold:
    """What an admission adds to the operator's open commitments."""

    held_nano_eur: int
    #: The commitments' version the ceilings were checked against; 0 when the
    #: control item did not exist yet.
    expected_version: int


@dataclass(frozen=True)
class OperatorClose:
    """What a close moves in the operator partition: the bound out of the open
    commitments, the cost into the spend of the month and the day it closes in."""

    released_nano_eur: int
    month_key: str
    day_key: str
    delivered_nano_eur: int = 0
    failed_nano_eur: int = 0
    failed_bound_nano_eur: int = 0
    month_ttl_epoch: int = 0
    day_ttl_epoch: int = 0


def _key(user_id: str, sk: str) -> Dict[str, str]:
    return {"user_id": user_id, "sk": sk}


def _serialize(value: Mapping[str, Any]) -> Dict[str, Any]:
    return {name: _serializer.serialize(item) for name, item in value.items()}


def _cancellation_codes(exc: ClientError) -> Optional[List[str]]:
    """Per-item codes of a cancelled transaction, or ``None`` if it was not one."""
    if exc.response.get("Error", {}).get("Code") != "TransactionCanceledException":
        return None
    return [reason.get("Code", "None") or "None" for reason in exc.response.get("CancellationReasons", [])]


def _failing(codes: Sequence[str]) -> List[str]:
    return [code for code in codes if code not in ("None", "")]


async def _commit(items: List[Dict[str, Any]], *, operation: str, user_id: str) -> Optional[List[str]]:
    """Run one transaction.

    Returns ``None`` when it committed, or the per-item cancellation codes when every
    failing item failed its condition — the state moved on, and the caller decides
    what that means. A conflict with another transaction is retried; anything else
    raises :class:`LedgerUnavailableError`.
    """
    for attempt in range(1, _TRANSACTION_TRIES + 1):
        try:
            session = get_session()
            async with session.client("dynamodb", **_dynamodb_client_kwargs()) as client:
                await client.transact_write_items(TransactItems=items)
            return None
        except ClientError as exc:
            codes = _cancellation_codes(exc)
            failing = _failing(codes) if codes else []
            if codes is not None and failing and all(code == "ConditionalCheckFailed" for code in failing):
                return codes
            retryable = codes is not None and any(code in ("TransactionConflict", "ThrottlingError") for code in failing)
            if retryable and attempt < _TRANSACTION_TRIES:
                await asyncio.sleep(_CONFLICT_BACKOFF_SECONDS * attempt * (1 + random.random()))
                continue
            _log_dynamodb_error(operation, exc, table=_table(), user_id=user_id, cancellation_codes=codes)
            raise LedgerUnavailableError(operation) from exc
        except BotoCoreError as exc:
            _log_dynamodb_error(operation, exc, table=_table(), user_id=user_id)
            raise LedgerUnavailableError(operation) from exc
    raise LedgerUnavailableError(operation)


# ---------------------------------------------------------------------------
# Admission
# ---------------------------------------------------------------------------


async def admit(
    *,
    user_id: str,
    period_key: str,
    budget_nano_eur: int,
    held_nano_eur: int,
    consumed_nano_eur: int,
    counter_ttl_epoch: int,
    attempt_items: Sequence[Mapping[str, Any]],
    now_iso: str,
    operator_hold: Optional[OperatorHold] = None,
) -> Optional[List[str]]:
    """Check the month's available amount and record the attempts, atomically.

    One transaction: the counter of ``period_key`` is created with the month's
    budget if it does not exist yet, then decremented by ``held + consumed`` under
    the condition that it covers them; every attempt is written under the condition
    that it does not exist yet. ``consumed_nano_eur`` is non-zero only for a charge
    with no provider call (rule 12), whose attempt is written already settled.

    With ``operator_hold``, the operator's open commitments grow by the same bound
    in the same transaction, under the condition that their version is still the
    one the operator ceilings were checked against (TASK-566).

    Returns ``None`` when admitted, otherwise the cancellation codes: index 0 is the
    counter (``ConditionalCheckFailed`` = not enough available), index ``i`` the
    ``i``-th attempt (``ConditionalCheckFailed`` = it already exists), and the last
    index the operator commitments when given (``ConditionalCheckFailed`` = they
    moved since they were read).
    """
    total = held_nano_eur + consumed_nano_eur
    counter_update: Dict[str, Any] = {
        "TableName": _table(),
        "Key": _serialize(_key(user_id, period_sk(period_key))),
        "UpdateExpression": (
            "SET #budget = if_not_exists(#budget, :budget),"
            " #available = if_not_exists(#available, :budget) - :total,"
            " #held = if_not_exists(#held, :zero) + :held,"
            " #consumed = if_not_exists(#consumed, :zero) + :consumed,"
            " #released = if_not_exists(#released, :zero),"
            " #operator = if_not_exists(#operator, :zero),"
            " item_type = :item_type, period_key = :period,"
            " created_at = if_not_exists(created_at, :now), updated_at = :now,"
            " ttl_epoch = if_not_exists(ttl_epoch, :ttl)"
        ),
        # A counter that does not exist yet is created with the full budget, and the
        # caller has already refused any total above the budget itself: the first
        # branch is therefore always covered.
        "ConditionExpression": "attribute_not_exists(#available) OR #available >= :total",
        "ExpressionAttributeNames": {
            "#budget": BUDGET,
            "#available": AVAILABLE,
            "#held": HELD,
            "#consumed": CONSUMED,
            "#released": RELEASED,
            "#operator": OPERATOR_SPEND,
        },
        "ExpressionAttributeValues": _serialize(
            {
                ":budget": budget_nano_eur,
                ":total": total,
                ":held": held_nano_eur,
                ":consumed": consumed_nano_eur,
                ":zero": 0,
                ":item_type": "period",
                ":period": period_key,
                ":now": now_iso,
                ":ttl": counter_ttl_epoch,
            }
        ),
    }
    items: List[Dict[str, Any]] = [{"Update": counter_update}]
    for attempt in attempt_items:
        items.append(
            {
                "Put": {
                    "TableName": _table(),
                    "Item": _serialize(attempt),
                    "ConditionExpression": "attribute_not_exists(sk)",
                }
            }
        )
    if operator_hold is not None:
        items.append({"Update": _operator_hold_update(operator_hold, now_iso)})
    return await _commit(items, operation="beta_budget.admit", user_id=user_id)


def _operator_hold_update(hold: OperatorHold, now_iso: str) -> Dict[str, Any]:
    values: Dict[str, Any] = {":held": hold.held_nano_eur, ":zero": 0, ":one": 1, ":now": now_iso, ":type": "operator_control"}
    if hold.expected_version:
        condition = "#version = :expected"
        values[":expected"] = hold.expected_version
    else:
        condition = "attribute_not_exists(#version)"
    return {
        "TableName": _table(),
        "Key": _serialize(_key(OPERATOR_PARTITION, OPERATOR_CONTROL_SK)),
        "UpdateExpression": (
            "SET #held = if_not_exists(#held, :zero) + :held, #version = if_not_exists(#version, :zero) + :one,"
            " item_type = :type, updated_at = :now"
        ),
        "ConditionExpression": condition,
        "ExpressionAttributeNames": {"#held": OP_HELD, "#version": OP_VERSION},
        "ExpressionAttributeValues": _serialize(values),
    }


def _operator_close_updates(close: OperatorClose, now_iso: str) -> List[Dict[str, Any]]:
    """The operator side of a close. Unconditional: a close is never refused."""
    items: List[Dict[str, Any]] = [
        {
            "Update": {
                "TableName": _table(),
                "Key": _serialize(_key(OPERATOR_PARTITION, OPERATOR_CONTROL_SK)),
                "UpdateExpression": (
                    "SET #held = if_not_exists(#held, :zero) - :released,"
                    " #version = if_not_exists(#version, :zero) + :one, item_type = :type, updated_at = :now"
                ),
                "ExpressionAttributeNames": {"#held": OP_HELD, "#version": OP_VERSION},
                "ExpressionAttributeValues": _serialize(
                    {":released": close.released_nano_eur, ":zero": 0, ":one": 1, ":now": now_iso, ":type": "operator_control"}
                ),
            }
        },
        {
            "Update": {
                "TableName": _table(),
                "Key": _serialize(_key(OPERATOR_PARTITION, operator_month_sk(close.month_key))),
                "UpdateExpression": (
                    "SET #delivered = if_not_exists(#delivered, :zero) + :delivered,"
                    " #failed = if_not_exists(#failed, :zero) + :failed,"
                    " #bound = if_not_exists(#bound, :zero) + :bound,"
                    " item_type = :type, month_key = :month, updated_at = :now, ttl_epoch = if_not_exists(ttl_epoch, :ttl)"
                ),
                "ExpressionAttributeNames": {"#delivered": OP_DELIVERED, "#failed": OP_FAILED, "#bound": OP_FAILED_BOUND},
                "ExpressionAttributeValues": _serialize(
                    {
                        ":delivered": close.delivered_nano_eur,
                        ":failed": close.failed_nano_eur,
                        ":bound": close.failed_bound_nano_eur,
                        ":zero": 0,
                        ":type": "operator_month",
                        ":month": close.month_key,
                        ":now": now_iso,
                        ":ttl": close.month_ttl_epoch,
                    }
                ),
            }
        },
    ]
    if close.failed_nano_eur:
        items.append(
            {
                "Update": {
                    "TableName": _table(),
                    "Key": _serialize(_key(OPERATOR_PARTITION, operator_day_sk(close.day_key))),
                    "UpdateExpression": (
                        "SET #failed = if_not_exists(#failed, :zero) + :failed, item_type = :type,"
                        " day_key = :day, updated_at = :now, ttl_epoch = if_not_exists(ttl_epoch, :ttl)"
                    ),
                    "ExpressionAttributeNames": {"#failed": OP_FAILED},
                    "ExpressionAttributeValues": _serialize(
                        {
                            ":failed": close.failed_nano_eur,
                            ":zero": 0,
                            ":type": "operator_day",
                            ":day": close.day_key,
                            ":now": now_iso,
                            ":ttl": close.day_ttl_epoch,
                        }
                    ),
                }
            }
        )
    return items


# ---------------------------------------------------------------------------
# Transitions of one attempt
# ---------------------------------------------------------------------------


async def claim_send(
    *,
    user_id: str,
    attempt_id: str,
    now_iso: str,
    gates: Sequence[Mapping[str, Any]] = (),
) -> Optional[List[str]]:
    """``held`` → ``sending``: the caller alone may now send the request.

    ``gates`` are the operator conditions of TASK-566 (:func:`circuit_allows`,
    :func:`circuit_take_probe`), checked in the same transaction: a circuit opened
    between the caller's read and this write refuses the send.

    Returns ``None`` when claimed, otherwise the cancellation codes: index 0 is the
    attempt (``ConditionalCheckFailed`` = it is not ``held`` — another delivery
    claimed it, it is closed, or it does not exist), index ``i`` the ``i``-th gate.
    A caller without the claim never sends under this reservation.
    """
    attempt_update: Dict[str, Any] = {
        "TableName": _table(),
        "Key": _serialize(_key(user_id, attempt_sk(attempt_id))),
        "UpdateExpression": "SET #status = :sending, claimed_at = :now",
        "ConditionExpression": "#status = :held",
        "ExpressionAttributeNames": {"#status": "status"},
        "ExpressionAttributeValues": _serialize({":sending": "sending", ":held": "held", ":now": now_iso}),
    }
    return await _commit(
        [{"Update": attempt_update}, *[dict(gate) for gate in gates]],
        operation="beta_budget.claim_send",
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Circuits (TASK-566)
# ---------------------------------------------------------------------------


def circuit_allows(scope: str) -> Dict[str, Any]:
    """Gate: the circuit of ``scope`` is closed, or was never opened."""
    return {
        "ConditionCheck": {
            "TableName": _table(),
            "Key": _serialize(_key(OPERATOR_PARTITION, circuit_sk(scope))),
            "ConditionExpression": "attribute_not_exists(#state) OR #state = :closed",
            "ExpressionAttributeNames": {"#state": "state"},
            "ExpressionAttributeValues": _serialize({":closed": "closed"}),
        }
    }


def circuit_take_probe(
    scope: str,
    *,
    attempt_id: str,
    epoch: int,
    from_state: str,
    now_iso: str,
    stale_before_iso: str,
) -> Dict[str, Any]:
    """Gate: this send is the single probe of a circuit that may try again.

    From ``open`` (an incident whose wait is over) the circuit becomes
    ``half_open``; from ``half_open`` the probe is taken only when no other send
    holds it, or when the one holding it is older than ``stale_before_iso`` (its
    worker died). The epoch condition keeps a stale read from taking a probe of a
    circuit that was reopened or resumed meanwhile.
    """
    names = {"#state": "state", "#epoch": "epoch"}
    values: Dict[str, Any] = {
        ":epoch": epoch,
        ":half_open": "half_open",
        ":attempt": attempt_id,
        ":now": now_iso,
    }
    if from_state == "open":
        condition = "#state = :open AND #epoch = :epoch AND suspension_kind = :incident AND open_until <= :now"
        values.update({":open": "open", ":incident": "incident", ":zero": 0})
        update = (
            "SET #state = :half_open, probe_attempt = :attempt, probe_claimed_at = :now,"
            " probe_successes = :zero, updated_at = :now"
        )
    else:
        condition = (
            "#state = :half_open AND #epoch = :epoch"
            " AND (attribute_not_exists(probe_attempt) OR probe_claimed_at < :stale)"
        )
        values[":stale"] = stale_before_iso
        update = "SET probe_attempt = :attempt, probe_claimed_at = :now, updated_at = :now"
    return {
        "Update": {
            "TableName": _table(),
            "Key": _serialize(_key(OPERATOR_PARTITION, circuit_sk(scope))),
            "UpdateExpression": update,
            "ConditionExpression": condition,
            "ExpressionAttributeNames": names,
            "ExpressionAttributeValues": _serialize(values),
        }
    }


async def update_operator_item(
    sk: str,
    *,
    update: str,
    values: Mapping[str, Any],
    names: Optional[Mapping[str, str]] = None,
    condition: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """One conditional update of an operator item; its new attributes, or ``None``
    when the condition was false (the state moved on)."""
    kwargs: Dict[str, Any] = {
        "Key": _key(OPERATOR_PARTITION, sk),
        "UpdateExpression": update,
        "ExpressionAttributeValues": dict(values),
        "ReturnValues": "ALL_NEW",
    }
    if names:
        kwargs["ExpressionAttributeNames"] = dict(names)
    if condition:
        kwargs["ConditionExpression"] = condition
    try:
        session = get_session()
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(_table())
            response = await table.update_item(**kwargs)
        return dict(response.get("Attributes") or {})
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return None
        _log_dynamodb_error("beta_budget.update_operator_item", exc, table=_table(), user_id=OPERATOR_PARTITION, sk=sk)
        raise LedgerUnavailableError("beta_budget.update_operator_item") from exc
    except BotoCoreError as exc:
        _log_dynamodb_error("beta_budget.update_operator_item", exc, table=_table(), user_id=OPERATOR_PARTITION, sk=sk)
        raise LedgerUnavailableError("beta_budget.update_operator_item") from exc


async def close_attempt(
    *,
    user_id: str,
    attempt_id: str,
    period_key: str,
    expected_statuses: Sequence[str],
    attempt_set: Mapping[str, Any],
    counter_add: Mapping[str, int],
    now_iso: str,
    claimed_before: Optional[str] = None,
    operator_close: Optional[OperatorClose] = None,
) -> bool:
    """Close an open attempt and move its month's counter, in one transaction.

    The attempt is updated with ``attempt_set`` and leaves the open-attempts index
    (``open_since`` is removed) under the condition that its status is one of
    ``expected_statuses`` — and, with ``claimed_before``, that it was claimed no
    later than that instant. The counter of the attempt's **own** month receives the
    signed ``counter_add`` deltas, whatever the current month is: a result arriving
    after midnight settles in the month it was reserved in.

    With ``operator_close``, the same transaction moves the attempt's bound out of
    the operator's open commitments and its cost into the operator's spend.

    Returns True when applied, False when a condition was false (the attempt moved
    on, is missing, or is still inside its lease).
    """
    names: Dict[str, str] = {"#status": "status"}
    values: Dict[str, Any] = {}
    set_parts: List[str] = []
    for index, (attribute, value) in enumerate(attempt_set.items()):
        names[f"#s{index}"] = attribute
        values[f":s{index}"] = value
        set_parts.append(f"#s{index} = :s{index}")
    status_refs = []
    for index, status in enumerate(expected_statuses):
        values[f":e{index}"] = status
        status_refs.append(f":e{index}")
    condition = (
        f"#status = {status_refs[0]}" if len(status_refs) == 1 else f"#status IN ({', '.join(status_refs)})"
    )
    if claimed_before is not None:
        names["#claimed"] = "claimed_at"
        values[":claimed_before"] = claimed_before
        condition += " AND #claimed <= :claimed_before"

    attempt_update: Dict[str, Any] = {
        "TableName": _table(),
        "Key": _serialize(_key(user_id, attempt_sk(attempt_id))),
        "UpdateExpression": "SET " + ", ".join(set_parts) + " REMOVE open_since",
        "ConditionExpression": condition,
        "ExpressionAttributeNames": names,
        "ExpressionAttributeValues": _serialize(values),
    }

    counter_names: Dict[str, str] = {}
    counter_values: Dict[str, Any] = {":now": now_iso}
    counter_parts: List[str] = []
    for index, (attribute, delta) in enumerate(counter_add.items()):
        counter_names[f"#c{index}"] = attribute
        counter_values[f":c{index}"] = int(delta)
        counter_parts.append(f"#c{index} = #c{index} + :c{index}")
    counter_parts.append("updated_at = :now")
    counter_update: Dict[str, Any] = {
        "TableName": _table(),
        "Key": _serialize(_key(user_id, period_sk(period_key))),
        "UpdateExpression": "SET " + ", ".join(counter_parts),
        "ConditionExpression": "attribute_exists(sk)",
        "ExpressionAttributeValues": _serialize(counter_values),
    }
    if counter_names:
        counter_update["ExpressionAttributeNames"] = counter_names

    items: List[Dict[str, Any]] = [{"Update": attempt_update}, {"Update": counter_update}]
    if operator_close is not None:
        items.extend(_operator_close_updates(operator_close, now_iso))
    codes = await _commit(
        items,
        operation="beta_budget.close_attempt",
        user_id=user_id,
    )
    return codes is None


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def get_item(user_id: str, sk: str) -> Optional[Dict[str, Any]]:
    """One item, read strongly consistent: every caller decides a transition on it."""
    try:
        session = get_session()
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(_table())
            response = await table.get_item(Key=_key(user_id, sk), ConsistentRead=True)
    except (ClientError, BotoCoreError) as exc:
        _log_dynamodb_error("beta_budget.get_item", exc, table=_table(), user_id=user_id)
        raise LedgerUnavailableError("beta_budget.get_item") from exc
    item = response.get("Item")
    return dict(item) if item else None


async def put_observation(item: Mapping[str, Any]) -> None:
    """Append non-financial evidence in the same account partition and TTL cycle."""
    session = get_session()
    async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(_table())
        await table.put_item(Item=dict(item), ConditionExpression="attribute_not_exists(sk)")


async def query_prefix(user_id: str, prefix: str) -> List[Dict[str, Any]]:
    """Every item of the account whose sort key starts with ``prefix``."""
    items: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {
        "KeyConditionExpression": Key("user_id").eq(user_id) & Key("sk").begins_with(prefix),
        "ConsistentRead": True,
    }
    try:
        session = get_session()
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(_table())
            while True:
                response = await table.query(**kwargs)
                items.extend(dict(item) for item in response.get("Items", []))
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    return items
                kwargs["ExclusiveStartKey"] = last_key
    except (ClientError, BotoCoreError) as exc:
        _log_dynamodb_error("beta_budget.query_prefix", exc, table=_table(), user_id=user_id)
        raise LedgerUnavailableError("beta_budget.query_prefix") from exc


async def query_open_attempts_before(user_id: str, cutoff_iso: str) -> List[Dict[str, Any]]:
    """The account's attempts still open and admitted before ``cutoff_iso``.

    Read on the sparse index, which is eventually consistent: an attempt closed a
    moment ago may still be listed, which is harmless because closing it again is
    conditional on it being open.
    """
    items: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {
        "IndexName": OPEN_ATTEMPTS_INDEX,
        "KeyConditionExpression": Key("user_id").eq(user_id) & Key("open_since").lt(cutoff_iso),
    }
    try:
        session = get_session()
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(_table())
            while True:
                response = await table.query(**kwargs)
                items.extend(dict(item) for item in response.get("Items", []))
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    return items
                kwargs["ExclusiveStartKey"] = last_key
    except (ClientError, BotoCoreError) as exc:
        _log_dynamodb_error("beta_budget.query_open_attempts", exc, table=_table(), user_id=user_id)
        raise LedgerUnavailableError("beta_budget.query_open_attempts") from exc
