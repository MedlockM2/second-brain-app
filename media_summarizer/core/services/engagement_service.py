"""Explicit recent artifact/conversation activity (TASK-582).

Writes are best-effort decorations; GETs neither record activity nor mutate data.
Titles, status and covers are hydrated from live owned targets and parents.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from boto3.dynamodb.conditions import Attr, Key

from media_summarizer.core.media_ingestion.media_metadata import parse_cover_locator
from media_summarizer.core.models.chat import conversation_sk
from media_summarizer.core.models.media_artifact import content_scope_id_from_scope_key
from media_summarizer.core.services.media_search_service import COVER_URL_EXPIRATION_SECONDS
from media_summarizer.utils import database_async, s3, user_engagements
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)
DEFAULT_RECENT_LIMIT = 12
MAX_RECENT_LIMIT = 20
RECENT_WINDOW_DAYS = user_engagements.RECENT_WINDOW_DAYS
MAX_PREVIEW_IMAGES = 4
_TARGET_FIELDS = [
    "user_id",
    "artifact_id",
    "conversation_id",
    "scope",
    "scope_id",
    "scope_key",
    "artifact_type",
    "status",
    "title",
    "active_attempt_id",
    "turn_count",
    "sk",
]
_MEDIA_FIELDS = [
    "user_id",
    "media_item_id",
    "media_key",
    "title",
    "title_label_key",
    "saved_at",
    "creator_name",
    "thumbnail_url",
    "media_type",
    "deleted_at",
]
_FOLDER_FIELDS = ["id", "user_id", "name"]


class EngagementSubjectNotFoundError(Exception):
    """Missing, internal or foreign target, or no accessible parent."""


@dataclass
class RecentEngagement:
    kind: str
    id: str
    scope: str
    scope_id: str
    engaged_at: str
    state: str
    title: Optional[str] = None
    artifact_type: Optional[str] = None
    scope_title: Optional[str] = None
    scope_title_label_key: Optional[str] = None
    scope_created_at: Optional[str] = None
    creator_name: Optional[str] = None
    image_url: Optional[str] = None
    media_type: Optional[str] = None
    item_count: Optional[int] = None
    preview_images: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


async def _targets(user_id: str, rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    artifacts, conversations = await asyncio.gather(
        user_engagements.batch_read(
            required_env("MEDIA_ARTIFACTS_TABLE"),
            [{"artifact_id": row["id"]} for row in rows if row["kind"] == "artifact"],
            _TARGET_FIELDS,
        ),
        user_engagements.batch_read(
            required_env("CHAT_TABLE"),
            [{"user_id": user_id, "sk": conversation_sk(row["id"])} for row in rows if row["kind"] == "conversation"],
            _TARGET_FIELDS,
        ),
    )
    targets = {}
    for target in artifacts:
        if target.get("user_id") == user_id and target.get("artifact_type") != "review_blurb":
            targets[user_engagements.target_key("artifact", target["artifact_id"])] = target
    for target in conversations:
        if target.get("user_id") == user_id and int(target.get("turn_count", 0)) > 0:
            targets[user_engagements.target_key("conversation", target["conversation_id"])] = target
    return targets


async def _parents(user_id: str, targets: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    media, folders = await asyncio.gather(
        user_engagements.batch_read(
            required_env("USER_MEDIA_TABLE"),
            [
                {"user_id": user_id, "media_item_id": target["scope_id"]}
                for target in targets.values()
                if target.get("scope") == "media"
            ],
            _MEDIA_FIELDS,
        ),
        user_engagements.batch_read(
            required_env("USER_FOLDERS_TABLE"),
            [{"id": target["scope_id"]} for target in targets.values() if target.get("scope") == "folder"],
            _FOLDER_FIELDS,
        ),
    )
    media_by_id = {row["media_item_id"]: row for row in media if not row.get("deleted_at")}
    folder_by_id = {row["id"]: row for row in folders if row.get("user_id") == user_id}
    parents = {}
    missing_content = set()
    for key, target in targets.items():
        if target["scope"] == "folder":
            parent = folder_by_id.get(target["scope_id"])
        else:
            parent = media_by_id.get(target["scope_id"])
            if key.startswith("artifact#"):
                content_id = content_scope_id_from_scope_key(target["scope_key"])
                if parent is None or parent["media_key"] != content_id:
                    missing_content.add(content_id)
                    parent = None
        if parent:
            parents[key] = parent
    if missing_content:
        # Artifact histories belong to content, not one save. Resolve all missing
        # content ids in one account-partition pass, never one query per vignette.
        available: Dict[str, Dict[str, Any]] = {}
        async with database_async.dynamodb_resource() as dynamodb:
            table = await dynamodb.Table(required_env("USER_MEDIA_TABLE"))
            names = {f"#f{i}": name for i, name in enumerate(_MEDIA_FIELDS)}
            query: Dict[str, Any] = {
                "KeyConditionExpression": Key("user_id").eq(user_id),
                "ConsistentRead": True,
                "FilterExpression": Attr("media_key").is_in(sorted(missing_content)) & Attr("deleted_at").not_exists(),
                "ProjectionExpression": ", ".join(names),
                "ExpressionAttributeNames": names,
            }
            while True:
                response = await table.query(**query)
                for row in response.get("Items", []):
                    previous = available.get(row["media_key"])
                    if previous is None or (row["saved_at"], row["media_item_id"]) > (previous["saved_at"], previous["media_item_id"]):
                        available[row["media_key"]] = row
                if not response.get("LastEvaluatedKey"):
                    break
                query["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        for key, target in targets.items():
            if key not in parents and key.startswith("artifact#") and target["scope"] == "media":
                parent = available.get(content_scope_id_from_scope_key(target["scope_key"]))
                if parent:
                    parents[key] = parent
    return parents


def _checks(
    user_id: str, kind: str, subject_id: str, target: Dict[str, Any], parent: Dict[str, Any]
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    is_artifact = kind == "artifact"
    target_check = {
        "TableName": required_env("MEDIA_ARTIFACTS_TABLE" if is_artifact else "CHAT_TABLE"),
        "Key": {"artifact_id": subject_id} if is_artifact else {"user_id": user_id, "sk": conversation_sk(subject_id)},
        "ConditionExpression": "attribute_exists(#id) AND user_id = :owner AND #scope = :scope AND scope_id = :sid"
        + (" AND scope_key = :content AND artifact_type <> :internal" if is_artifact else " AND turn_count > :zero"),
        "ExpressionAttributeNames": {"#id": "artifact_id" if is_artifact else "sk", "#scope": "scope"},
        "ExpressionAttributeValues": {
            ":owner": user_id,
            ":scope": target["scope"],
            ":sid": target["scope_id"],
            **({":content": target["scope_key"], ":internal": "review_blurb"} if is_artifact else {":zero": 0}),
        },
    }
    is_media = target["scope"] == "media"
    parent_check = {
        "TableName": required_env("USER_MEDIA_TABLE" if is_media else "USER_FOLDERS_TABLE"),
        "Key": {"user_id": user_id, "media_item_id": parent["media_item_id"]} if is_media else {"id": parent["id"]},
        "ConditionExpression": "attribute_exists(#id) AND user_id = :owner"
        + (" AND attribute_not_exists(deleted_at) AND media_key = :content" if is_media else ""),
        "ExpressionAttributeNames": {"#id": "media_item_id" if is_media else "id"},
        "ExpressionAttributeValues": {":owner": user_id, **({":content": parent["media_key"]} if is_media else {})},
    }
    return target_check, parent_check


async def record_engagement(*, user_id: str, kind: str, subject_id: str, moment: Optional[datetime] = None) -> bool:
    moment = moment or datetime.now(timezone.utc)
    if kind not in ("artifact", "conversation") or not subject_id.strip():
        raise EngagementSubjectNotFoundError("Unknown engagement target")
    async with database_async.dynamodb_resource():
        targets = await _targets(user_id, [{"kind": kind, "id": subject_id}])
        parents = await _parents(user_id, targets)
        key = user_engagements.target_key(kind, subject_id)
        if key not in targets or key not in parents:
            raise EngagementSubjectNotFoundError("Engagement target not found")
        target, parent = targets[key], parents[key]
        target_check, parent_check = _checks(user_id, kind, subject_id, target, parent)
        return await user_engagements.record(
            user_id=user_id,
            kind=kind,
            subject_id=subject_id,
            scope=target["scope"],
            scope_id=parent.get("media_item_id", parent.get("id", "")),
            moment=moment,
            target_check=target_check,
            parent_check=parent_check,
        )


async def stamp(*, user_id: str, kind: str, subject_id: str, moment: Optional[datetime] = None) -> bool:
    """Best-effort recording used after an already accepted user action."""
    try:
        return await record_engagement(user_id=user_id, kind=kind, subject_id=subject_id, moment=moment)
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "engagement.stamp_failed",
            "Could not record an engagement",
            user_id=user_id,
            kind=kind,
            subject_id=subject_id,
            error_type=type(exc).__name__,
        )
        return False


async def remove(*, user_id: str, kind: str, subject_id: str) -> None:
    try:
        await user_engagements.delete_target(user_id, kind, subject_id)
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "engagement.cleanup_failed",
            "Could not remove a deleted target engagement",
            user_id=user_id,
            kind=kind,
            subject_id=subject_id,
            error_type=type(exc).__name__,
        )


async def remove_scope(*, user_id: str, scope: str, scope_id: str) -> None:
    try:
        await user_engagements.delete_scope(user_id, scope, scope_id)
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "engagement.cleanup_failed",
            "Could not remove deleted scope engagements",
            user_id=user_id,
            scope=scope,
            scope_id=scope_id,
            error_type=type(exc).__name__,
        )


async def list_recent(user_id: str, *, limit: int = DEFAULT_RECENT_LIMIT) -> List[RecentEngagement]:
    limit = max(1, min(limit, MAX_RECENT_LIMIT))
    since = datetime.now(timezone.utc) - timedelta(days=RECENT_WINDOW_DAYS)
    entries: List[RecentEngagement] = []
    cursor = None
    async with database_async.dynamodb_resource():
        while len(entries) < limit:
            rows, cursor = await user_engagements.recent_page(user_id, since=since, limit=limit, cursor=cursor)
            targets = await _targets(user_id, rows)
            parents = await _parents(user_id, targets)
            for row in rows:
                key = row["target_key"]
                if key not in targets or key not in parents:
                    continue
                target, parent = targets[key], parents[key]
                scope = target["scope"]
                raw_status = target.get("status")
                state = (
                    ("pending" if raw_status in ("queued", "generating") else "failed" if raw_status == "failed" else "ready")
                    if row["kind"] == "artifact"
                    else ("pending" if target.get("active_attempt_id") else "ready")
                )
                entries.append(
                    RecentEngagement(
                        kind=row["kind"],
                        id=row["id"],
                        scope=scope,
                        scope_id=parent["media_item_id"] if scope == "media" else parent["id"],
                        engaged_at=row["engaged_at"],
                        state=state,
                        title=target.get("title"),
                        artifact_type=target.get("artifact_type"),
                        scope_title=parent.get("title") if scope == "media" else parent["name"],
                        scope_title_label_key=parent.get("title_label_key"),
                        scope_created_at=parent.get("saved_at"),
                        creator_name=parent.get("creator_name"),
                        image_url=parent.get("thumbnail_url"),
                        media_type=parent.get("media_type"),
                    )
                )
                if len(entries) == limit:
                    break
            if not cursor:
                break
        await _hydrate_folders(user_id, entries)
        await _sign_covers(entries)
    return entries


async def _hydrate_folders(user_id: str, entries: List[RecentEngagement]) -> None:
    from media_summarizer.utils import user_media

    folder_ids = sorted({entry.scope_id for entry in entries if entry.scope == "folder"})
    if not folder_ids:
        return
    summaries = await user_media.folder_overviews(user_id, folder_ids, preview_limit=MAX_PREVIEW_IMAGES)
    for entry in entries:
        if entry.scope == "folder":
            entry.item_count, entry.preview_images = summaries[entry.scope_id]


async def _sign_covers(entries: List[RecentEngagement]) -> None:
    pending: List[tuple[RecentEngagement, Optional[int], tuple[str, str]]] = []
    for entry in entries:
        located = parse_cover_locator(entry.image_url)
        if located:
            pending.append((entry, None, located))
        for index, value in enumerate(entry.preview_images):
            located = parse_cover_locator(value)
            if located:
                pending.append((entry, index, located))
    if not pending:
        return
    signed = await s3.generate_presigned_urls([located for _, _, located in pending], expiration=COVER_URL_EXPIRATION_SECONDS)
    for (entry, slot, _), url in zip(pending, signed):
        if slot is None:
            entry.image_url = url
        else:
            entry.preview_images[slot] = url or ""
    for entry in entries:
        entry.preview_images = [value for value in entry.preview_images if value and not parse_cover_locator(value)]
