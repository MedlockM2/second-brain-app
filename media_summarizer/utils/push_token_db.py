"""
DynamoDB operations for ``user_push_tokens``.

Table: PK=``user_id``, SK=``push_token``. An account partition lists its
registrations; the reserved owner partition assigns each token to exactly one
account. Registration and ownership are written atomically. See
``core/models/push_token.py`` for why there is no TTL attribute on it.

No function here ever passes a token value to a log call. ``_log_dynamodb_error``
and ``_log_dynamodb_success`` are given the table and the ``user_id`` only, which
is enough to locate a failing write without publishing the credential that would
let anyone push to that device.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from media_summarizer.core.models.push_token import PushToken, PushTokenPlatform
from media_summarizer.utils.database_async import (
    _dynamodb_client_kwargs,
    _log_dynamodb_error,
    _log_dynamodb_success,
    get_session,
)
from media_summarizer.utils.env import required_env

logger = logging.getLogger(__name__)

USER_PUSH_TOKENS_TABLE = required_env("USER_PUSH_TOKENS_TABLE")

#: How long a token survives without being seen again.
#:
#: An app that is uninstalled stops refreshing ``last_seen_at`` and nothing else
#: ever says so — neither Apple, nor Google, nor reliably Expo. 90 days is long
#: enough that a phone left in a drawer over a summer keeps its registration, and
#: short enough that a device the user got rid of stops being addressable within
#: a quarter. The sweep is driven by the daily rule in
#: ``lambda_digest_scheduler.tf``.
STALE_TOKEN_DAYS = 90

# One authoritative owner per Expo token, in the existing table. Account rows
# remain the device listing; these rows arbitrate account switches atomically.
# This namespace cannot be a real account id (UUIDs issued by the auth service).
_OWNER_PARTITION = "__push_token_owners__"


async def _transact(actions: List[Dict[str, Any]]) -> None:
    serializer = TypeSerializer()
    encoded = []
    for action in actions:
        kind, values = next(iter(action.items()))
        operation = dict(values)
        for field in ("Item", "Key", "ExpressionAttributeValues"):
            if field in operation:
                operation[field] = {k: serializer.serialize(v) for k, v in operation[field].items()}
        encoded.append({kind: operation})
    async with get_session().client("dynamodb", **_dynamodb_client_kwargs()) as client:
        await client.transact_write_items(TransactItems=encoded, ClientRequestToken=str(uuid4()))


async def save_token(
    user_id: str, push_token: str, platform: PushTokenPlatform
) -> None:
    """Register and exclusively assign this token to the authenticated account.

    Sign-out is best-effort on a phone that may be offline or restarted. Its
    success cannot be the uniqueness constraint: the same Expo token survives
    account switches. The transaction makes the last registration the sole owner,
    even if an older account row remains. No read-then-write race between accounts.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        await _transact([
            {"Update": {
                "TableName": USER_PUSH_TOKENS_TABLE,
                "Key": {"user_id": user_id, "push_token": push_token},
                "UpdateExpression": (
                    "SET created_at = if_not_exists(created_at, :now), "
                    "last_seen_at = :now, platform = :platform"
                ),
                "ExpressionAttributeValues": {":now": now, ":platform": platform.value},
            }},
            {"Put": {
                "TableName": USER_PUSH_TOKENS_TABLE,
                "Item": {"user_id": _OWNER_PARTITION, "push_token": push_token,
                         "owner_user_id": user_id, "last_seen_at": now},
            }},
        ])
        _log_dynamodb_success("save_push_token", table=USER_PUSH_TOKENS_TABLE, user_id=user_id)
    except ClientError as e:
        _log_dynamodb_error("save_push_token", e, table=USER_PUSH_TOKENS_TABLE, user_id=user_id)
        raise


async def _list_registrations(user_id: str) -> List[PushToken]:
    """All account rows, including superseded ones, for delivery and erasure."""
    async with get_session().resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
        table = await dynamodb.Table(USER_PUSH_TOKENS_TABLE)
        tokens: List[PushToken] = []
        query_kwargs: Dict[str, Any] = {
            "KeyConditionExpression": Key("user_id").eq(user_id),
            "ConsistentRead": True,
        }
        while True:
            response = await table.query(**query_kwargs)
            tokens.extend(PushToken.from_dynamodb_item(item) for item in response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            query_kwargs["ExclusiveStartKey"] = last_key
        return tokens


async def list_tokens_for_user(user_id: str) -> List[PushToken]:
    """Only devices whose current authoritative owner is this account.

    Strong reads exclude stale registrations immediately after an account switch.
    An old row without an owner is not a destination: re-register on app launch,
    never guess an owner or fall back to the former multi-account behaviour.
    """
    try:
        tokens = await _list_registrations(user_id)
        owned = []
        async with get_session().resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(USER_PUSH_TOKENS_TABLE)
            for token in tokens:
                response = await table.get_item(
                    Key={"user_id": _OWNER_PARTITION, "push_token": token.push_token},
                    ConsistentRead=True,
                )
                if response.get("Item", {}).get("owner_user_id") == user_id:
                    owned.append(token)
        return owned
    except ClientError as e:
        _log_dynamodb_error("list_push_tokens", e, table=USER_PUSH_TOKENS_TABLE, user_id=user_id)
        raise


async def delete_token(
    user_id: str, push_token: str, *, last_seen_at: Optional[str] = None
) -> bool:
    """Remove an account's registration and its ownership, never another owner's.

    A delayed sign-out or receipt for A must not unassign the phone from B.
    The stale sweep additionally compares its snapshot's last_seen_at so a fresh
    registration cannot be erased by an earlier scan.
    """
    row_delete: Dict[str, Any] = {
        "TableName": USER_PUSH_TOKENS_TABLE,
        "Key": {"user_id": user_id, "push_token": push_token},
    }
    if last_seen_at is not None:
        row_delete.update(
            ConditionExpression="last_seen_at = :seen",
            ExpressionAttributeValues={":seen": last_seen_at},
        )
    try:
        try:
            await _transact([
                {"Delete": {
                    "TableName": USER_PUSH_TOKENS_TABLE,
                    "Key": {"user_id": _OWNER_PARTITION, "push_token": push_token},
                    "ConditionExpression": "attribute_not_exists(user_id) OR owner_user_id = :user",
                    "ExpressionAttributeValues": {":user": user_id},
                }},
                {"Delete": row_delete},
            ])
        except ClientError as exc:
            reasons = exc.response.get("CancellationReasons", [])
            if (exc.response.get("Error", {}).get("Code") != "TransactionCanceledException"
                    or not any(r.get("Code") == "ConditionalCheckFailed" for r in reasons)
                    or any(r.get("Code") not in ("None", "ConditionalCheckFailed") for r in reasons)):
                raise
            # The token now belongs to someone else, or the scan was stale.
            # Delete only this account row, still conditional when sweeping.
            async with get_session().resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
                table = await dynamodb.Table(USER_PUSH_TOKENS_TABLE)
                try:
                    await table.delete_item(**{k: v for k, v in row_delete.items() if k != "TableName"})
                except ClientError as row_exc:
                    if row_exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                        return False
                    raise
        _log_dynamodb_success("delete_push_token", table=USER_PUSH_TOKENS_TABLE, user_id=user_id)
        return True
    except ClientError as e:
        _log_dynamodb_error("delete_push_token", e, table=USER_PUSH_TOKENS_TABLE, user_id=user_id)
        raise


async def delete_all_for_user(user_id: str) -> int:
    """Erase registrations and owner rows when the account is deleted."""
    tokens = await _list_registrations(user_id)
    for token in tokens:
        await delete_token(user_id, token.push_token)
    return len(tokens)


async def delete_stale_tokens(older_than_days: int = STALE_TOKEN_DAYS) -> int:
    """Delete every registration not seen for ``older_than_days``. Returns the count.

    A ``Scan``, and that is the right shape here: the table holds one row per
    device of the whole install base, the sweep runs once a day, and there is no
    access pattern that would justify an index built solely for it.
    """
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=older_than_days)
    ).isoformat()
    removed = 0
    try:
        session = get_session()
        async with session.resource("dynamodb", **_dynamodb_client_kwargs()) as dynamodb:
            table = await dynamodb.Table(USER_PUSH_TOKENS_TABLE)
            scan_kwargs: Dict[str, Any] = {
                "ProjectionExpression": "user_id, push_token, last_seen_at"
            }
            while True:
                response = await table.scan(**scan_kwargs)
                for item in response.get("Items", []):
                    # Lexicographic comparison of two ISO-8601 UTC strings is a
                    # chronological one, and every row is written by
                    # `save_token` above with `datetime.now(timezone.utc)`.
                    if item["user_id"] == _OWNER_PARTITION:
                        # Removed atomically along with its owner's account row.
                        continue
                    if str(item.get("last_seen_at", "")) >= cutoff:
                        continue
                    if await delete_token(
                        item["user_id"], item["push_token"],
                        last_seen_at=str(item.get("last_seen_at", "")),
                    ):
                        removed += 1
                last_key = response.get("LastEvaluatedKey")
                if not last_key:
                    break
                scan_kwargs["ExclusiveStartKey"] = last_key
            return removed
    except ClientError as e:
        _log_dynamodb_error(
            "delete_stale_push_tokens", e, table=USER_PUSH_TOKENS_TABLE
        )
        raise
