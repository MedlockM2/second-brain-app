"""Last explicit engagement per artifact/conversation, never an event log."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env

RECENT_WINDOW_DAYS = 90
RECENT_INDEX = "recent-index"
SCOPE_INDEX = "scope-index"


def table_name() -> str:
    return required_env("USER_ENGAGEMENTS_TABLE")


def target_key(kind: str, subject_id: str) -> str:
    return f"{kind}#{subject_id}"


async def batch_read(table: str, keys: List[Dict[str, str]], fields: List[str]) -> List[Dict[str, Any]]:
    """Bounded, strongly consistent metadata reads; never treat throttling as deletion."""
    unique = list({tuple(sorted(key.items())): key for key in keys}.values())
    items: List[Dict[str, Any]] = []
    async with database_async.dynamodb_resource() as dynamodb:
        for start in range(0, len(unique), 100):
            names = {f"#f{i}": name for i, name in enumerate(fields)}
            pending = {
                table: {
                    "Keys": unique[start : start + 100],
                    "ConsistentRead": True,
                    "ProjectionExpression": ", ".join(names),
                    "ExpressionAttributeNames": names,
                }
            }
            for attempt in range(5):
                response = await dynamodb.batch_get_item(RequestItems=pending)
                items.extend(response.get("Responses", {}).get(table, []))
                pending = response.get("UnprocessedKeys", {})
                if not pending:
                    break
                await asyncio.sleep(0.05 * 2**attempt)
            if pending:
                raise RuntimeError("Engagement metadata could not be fully resolved")
    return items


async def record(
    *,
    user_id: str,
    kind: str,
    subject_id: str,
    scope: str,
    scope_id: str,
    moment: datetime,
    target_check: Dict[str, Any],
    parent_check: Dict[str, Any],
) -> bool:
    moment = moment.astimezone(timezone.utc)
    instant = moment.isoformat(timespec="microseconds")
    identity = target_key(kind, subject_id)
    item = {
        "user_id": user_id,
        "target_key": identity,
        "kind": kind,
        "id": subject_id,
        "scope": scope,
        "scope_id": scope_id,
        "scope_key": f"{scope}#{scope_id}",
        "engaged_at": instant,
        "recency_key": f"{instant}#{identity}",
        "expires_at": int((moment + timedelta(days=RECENT_WINDOW_DAYS)).timestamp()),
    }
    actions = [
        {"ConditionCheck": target_check},
        {"ConditionCheck": parent_check},
        {
            "Put": {
                "TableName": table_name(),
                "Item": item,
                "ConditionExpression": "attribute_not_exists(target_key) OR engaged_at < :now",
                "ExpressionAttributeValues": {":now": instant},
            }
        },
    ]
    serializer = TypeSerializer()
    for action in actions:
        values = next(iter(action.values()))
        for field in ("Key", "Item", "ExpressionAttributeValues"):
            if field in values:
                values[field] = {key: serializer.serialize(value) for key, value in values[field].items()}
    try:
        async with database_async.get_session().client("dynamodb", region_name=database_async.AWS_REGION) as client:
            await client.transact_write_items(TransactItems=actions)
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "TransactionCanceledException":
            reasons = exc.response.get("CancellationReasons", [])
            if reasons and all(reason.get("Code") in ("None", "ConditionalCheckFailed") for reason in reasons):
                return False
        raise


async def recent_page(
    user_id: str, *, since: datetime, limit: int, cursor: Optional[Dict[str, Any]] = None
) -> tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    async with database_async.dynamodb_resource() as dynamodb:
        table = await dynamodb.Table(table_name())
        query: Dict[str, Any] = {
            "IndexName": RECENT_INDEX,
            "ConsistentRead": True,
            "KeyConditionExpression": Key("user_id").eq(user_id)
            & Key("recency_key").gt(f"{since.isoformat(timespec='microseconds')}#\uffff"),
            "ScanIndexForward": False,
            "Limit": limit,
        }
        if cursor:
            query["ExclusiveStartKey"] = cursor
        response = await table.query(**query)
    return response.get("Items", []), response.get("LastEvaluatedKey")


async def delete_target(user_id: str, kind: str, subject_id: str) -> None:
    async with database_async.dynamodb_resource() as dynamodb:
        table = await dynamodb.Table(table_name())
        await table.delete_item(Key={"user_id": user_id, "target_key": target_key(kind, subject_id)})


async def delete_scope(user_id: str, scope: str, scope_id: str) -> None:
    async with database_async.dynamodb_resource() as dynamodb:
        table = await dynamodb.Table(table_name())
        query: Dict[str, Any] = {
            "IndexName": SCOPE_INDEX,
            "ConsistentRead": True,
            "KeyConditionExpression": Key("user_id").eq(user_id) & Key("scope_key").eq(f"{scope}#{scope_id}"),
        }
        while True:
            response = await table.query(**query)
            for row in response.get("Items", []):
                # A concurrent open may have rebound this artifact to another save.
                try:
                    await table.delete_item(
                        Key={"user_id": user_id, "target_key": row["target_key"]},
                        ConditionExpression="scope_key = :scope",
                        ExpressionAttributeValues={":scope": f"{scope}#{scope_id}"},
                    )
                except ClientError as exc:
                    if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                        raise
            if not response.get("LastEvaluatedKey"):
                break
            query["ExclusiveStartKey"] = response["LastEvaluatedKey"]
