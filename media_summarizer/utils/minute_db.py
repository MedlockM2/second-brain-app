"""
Subscriptions data access on DynamoDB (async, aioboto3), using the same session
config as database_async.

GSIs expected:
- user-index on user_id

Note: Table creation and index management are handled outside this module (infra scripts/terraform).
"""

from __future__ import annotations

from typing import List

from boto3.dynamodb.conditions import Key

from media_summarizer.core.models.billing import Subscription
from media_summarizer.utils import database_async
from media_summarizer.utils.env import required_env

# Table names (overridable via env)
SUBSCRIPTIONS_TABLE = required_env("SUBSCRIPTIONS_TABLE")


# ---------- Subscriptions ----------


async def create_subscription(subscription: Subscription) -> Subscription:
    session = database_async.get_session()
    async with session.resource(
        "dynamodb",
        region_name=database_async.AWS_REGION,
    ) as dynamodb:
        table = await dynamodb.Table(SUBSCRIPTIONS_TABLE)
        await table.put_item(
            Item=subscription.to_dynamodb_item(),
            ConditionExpression="attribute_not_exists(id)",
        )
        return subscription


async def get_subscriptions_by_user_id(user_id: str) -> List[Subscription]:
    session = database_async.get_session()
    async with session.resource(
        "dynamodb",
        region_name=database_async.AWS_REGION,
    ) as dynamodb:
        table = await dynamodb.Table(SUBSCRIPTIONS_TABLE)
        response = await table.query(
            IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id)
        )
        items = response.get("Items", [])
        return [Subscription.from_dynamodb_item(it) for it in items]


async def update_subscription(subscription: Subscription) -> Subscription:
    session = database_async.get_session()
    async with session.resource(
        "dynamodb",
        region_name=database_async.AWS_REGION,
    ) as dynamodb:
        table = await dynamodb.Table(SUBSCRIPTIONS_TABLE)
        await table.put_item(Item=subscription.to_dynamodb_item())
        return subscription
