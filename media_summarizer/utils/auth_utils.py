"""Lifetime policy for browser-extension grants, independent of Cognito sessions."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from media_summarizer.core.models.auth import LineageKind


def get_refresh_token_expires_at(kind: LineageKind, lineage_started_at: Optional[datetime] = None) -> datetime:
    now = datetime.now(timezone.utc)
    return min(now + timedelta(days=90), (lineage_started_at or now) + timedelta(days=365))
