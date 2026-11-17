"""Digest compositions, with no provider calls or automatic artifact generation.

The tab reads a rolling window ending now: the last 24 hours (daily) and the
last 7 days (weekly), cached in DynamoDB for five minutes (including empty
results) in one replaceable slot per type. The read-start timestamp bounds
freshness even if two rebuilds overlap.

Rolling rather than calendar periods so that the tab and a Digest notification
show the same media: the Monday 09:30 notification announces the week that just
closed, which a "current ISO week" tab no longer held nine hours into Monday
(TestFlight feedback AGAd5cCwZDGiyc9np_wjdec). Opened shortly after a send, the
rolling window covers the announced period; it is never empty merely because a
calendar period has just started.

Notifications still use closed windows and immutable captures: the 24 hours
before 18:30, and the elapsed Monday-to-Sunday week announced on Monday 09:30.
Their keys and publication claims are separate from the tab's cache slot.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone, tzinfo
from typing import List, Optional
from zoneinfo import ZoneInfo

from media_summarizer.core.models.digest import (
    DigestMediaItem,
    DigestRecord,
    DigestType,
    UserDigestSettings,
)
from media_summarizer.utils import digest_db
from media_summarizer.utils import user_media as user_media_store

logger = logging.getLogger(__name__)


#: When the daily digest notification goes out, in the user's local time.
DAILY_SEND_TIME = time(hour=18, minute=30)

#: When the weekly digest notification goes out: Monday, local time.
WEEKLY_SEND_TIME = time(hour=9, minute=30)

CURRENT_DIGEST_MAX_AGE = timedelta(minutes=5)

#: How far back the tab reads, ending at the read instant.
ROLLING_WINDOWS = {
    DigestType.DAILY: timedelta(hours=24),
    DigestType.WEEKLY: timedelta(days=7),
}

#: The ``period_key`` the tab's reads answer. Stable per type: a rolling window
#: has no calendar identity, and the clients only use the key to tell one
#: composition of the same Digest from another.
ROLLING_PERIOD_KEYS = {
    DigestType.DAILY: "last-24h",
    DigestType.WEEKLY: "last-7d",
}

#: The DynamoDB slot the tab's composition is cached in, one per type.
ROLLING_CACHE_SLOT = "rolling"


def resolve_zone(iana_timezone: Optional[str]) -> tzinfo:
    """The zone to resolve a *read* in, falling back to UTC when there is none.

    The fallback is for reading only, and the asymmetry is deliberate. A screen
    has to render something, so an account whose zone has not been reported yet
    reads its digest in UTC — off by a few hours, never empty. A **notification**
    for that same account is not sent at all (see ``workers/digest/scheduler.py``):
    guessing the moment to interrupt someone is worse than not interrupting them,
    and the app reports its zone on every foreground pass, so the state is
    short-lived by construction.

    An unknown name gets the same treatment as an absent one. The field is gated
    by ``normalize_iana_timezone`` on the way in, so this only fires if the
    runtime's tz database is older than the one that accepted the value.
    """
    if not iana_timezone:
        return timezone.utc
    try:
        return ZoneInfo(iana_timezone)
    except Exception:
        logger.warning(
            "Unknown IANA zone %r; reading the digest in UTC", iana_timezone
        )
        return timezone.utc


def local_now(iana_timezone: Optional[str]) -> datetime:
    """``now`` carried in the account's own zone, which is what the windows read."""
    return datetime.now(resolve_zone(iana_timezone))


@dataclass(frozen=True)
class DigestWindow:
    """The period one notification announced.

    Half-open, ``[start, end)``, and that matters: a media saved at exactly the
    send instant belongs to the *next* period, so every media is announced once
    and none is skipped between two consecutive digests.
    """

    period_key: str
    start: datetime
    end: datetime
    #: The local instant this period's notification is due at — the last 18:30, or
    #: the last Monday 09:30. Always in the past, since both resolvers step back a
    #: period when the upcoming send has not happened yet.
    #:
    #: Distinct from ``end`` because the two coincide only for the daily window.
    #: The weekly one ends on the Monday at 00:00 and is announced nine and a half
    #: hours later, so a scheduler reading ``end`` as the send instant would notify
    #: the whole world's Sunday nights at midnight.
    send_at: datetime


def resolve_daily_window(now: datetime) -> DigestWindow:
    """The 24 hours the last 18:30 send announced.

    ``now`` carries the zone the send is scheduled in, and the window is derived
    from it — nothing here reads a clock of its own. Every caller now passes
    ``local_now(user.iana_timezone)`` (task-369), so the window is the user's
    18:30 and not UTC's; ``resolve_zone`` documents what an account with no zone
    gets.

    The ``period_key`` is the local date of the send, so the digest announced on
    the evening of the 12th is ``2026-05-12`` even though most of its content was
    saved on the 11th. It is therefore per-user by construction: two accounts in
    different zones legitimately hold different keys for the same evening.
    """
    send = now.replace(
        hour=DAILY_SEND_TIME.hour,
        minute=DAILY_SEND_TIME.minute,
        second=0,
        microsecond=0,
    )
    if send > now:
        # Before this evening's send: the digest currently live is yesterday's.
        send -= timedelta(days=1)
    return DigestWindow(
        period_key=send.date().isoformat(),
        start=send - timedelta(days=1),
        end=send,
        send_at=send,
    )


def resolve_weekly_window(now: datetime) -> DigestWindow:
    """The Monday-to-Sunday week the last Monday 09:30 send announced.

    The week *before* that send, never the one in progress: the ISO week the send
    happens in is nine hours old when the notification leaves, so announcing it
    would announce almost nothing.
    """
    send = now.replace(
        hour=WEEKLY_SEND_TIME.hour,
        minute=WEEKLY_SEND_TIME.minute,
        second=0,
        microsecond=0,
    ) - timedelta(days=now.weekday())  # weekday() is 0 on Monday
    if send > now:
        # Monday, before 09:30: the digest currently live is the previous send's.
        send -= timedelta(days=7)

    # `send` is a Monday, so the week that closed starts seven days before it and
    # ends where the send's own week starts.
    week_start = (send - timedelta(days=7)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    iso_year, iso_week, _ = week_start.isocalendar()
    return DigestWindow(
        period_key=f"{iso_year}-W{iso_week:02d}",
        start=week_start,
        end=week_start + timedelta(days=7),
        send_at=send,
    )


async def _collect_window_items(
    user_id: str, window: DigestWindow
) -> List[DigestMediaItem]:
    """Every library row saved inside the window, oldest first.

    One query, whatever the period holds. There is deliberately no job lookup any
    more: the digest used to drop an item without a transcript because it existed
    to serve a pre-generated summary of it, and it now shows the media page, which
    states for itself where an item stands. So "saved in the period" is the whole
    of the rule, which is also what makes it checkable against ``user_media-dev``
    with one query.
    """
    records = [
        record
        for record in await user_media_store.list_library_for_user(user_id)
        if window.start <= record.saved_at < window.end
    ]
    # Sorted on the datetime, not on the serialised string: two rows written with
    # different offsets would compare wrong as text.
    records.sort(key=lambda record: record.saved_at)
    return [
        DigestMediaItem(
            media_item_id=record.media_item_id,
            added_at=record.saved_at.isoformat(),
        )
        for record in records
    ]


async def get_or_assemble_for_window(
    user_id: str, digest_type: DigestType, window: DigestWindow
) -> DigestRecord:
    """The stored capture of a period, assembling it on first read.

    The capture is what makes the screen agree with the notification: the first
    read of a period freezes the list, and every later read returns that list
    verbatim. Re-deriving it would be harmless — the window is entirely in the
    past, so it can no longer change — but it would cost a library scan per open.

    Public because the send path resolves its own window: the scheduler has to
    know whether a period is *due* before it assembles it, so it computes the
    window itself and hands it here rather than going through the two wrappers
    below. Assembly stays in one place either way.
    """
    existing = await digest_db.get_digest(user_id, digest_type, window.period_key)
    if existing is not None:
        return existing

    media_items = await _collect_window_items(user_id, window)
    record = DigestRecord(
        user_id=user_id,
        digest_type=digest_type,
        period_key=window.period_key,
        media_items=media_items,
    )
    # An empty notification period is not written: nothing is announced.
    # Current-period reads cache emptiness separately in a replaceable slot.
    if media_items:
        await digest_db.save_digest(record)
    return record


async def get_current_digest(
    user_id: str, digest_type: DigestType, *, iana_timezone: Optional[str]
) -> DigestRecord:
    """The rolling window ending now, reused across opens and API Lambda instances.

    Notification preferences control sends only. Reading the window remains
    available even when its notification is disabled. The zone only stamps the
    record: a window measured back from an instant is the same in every zone.
    """
    now = local_now(iana_timezone)
    period_key = ROLLING_PERIOD_KEYS[digest_type]
    cached = await digest_db.get_digest(
        user_id, digest_type, period_key, cache_slot=ROLLING_CACHE_SLOT
    )
    if cached is not None and cached.period_key == period_key:
        age = now - datetime.fromisoformat(cached.created_at)
        if timedelta(0) <= age < CURRENT_DIGEST_MAX_AGE:
            return cached

    window = DigestWindow(
        period_key=period_key,
        start=now - ROLLING_WINDOWS[digest_type],
        end=now,
        send_at=now,
    )
    items = await _collect_window_items(user_id, window)
    record = DigestRecord(
        user_id=user_id,
        digest_type=digest_type,
        period_key=period_key,
        media_items=items,
        created_at=now.astimezone(timezone.utc).isoformat(),
    )
    # Empty results must be cached too, otherwise an empty library is assembled
    # on every open. This is a cache slot, never a publication candidate.
    await digest_db.save_digest(record, cache_slot=ROLLING_CACHE_SLOT)
    return record


async def get_user_digest_settings(user_id: str) -> UserDigestSettings:
    """Get digest settings for a user, returning defaults if none exist."""
    settings = await digest_db.get_user_digest_settings(user_id)
    if settings is None:
        return UserDigestSettings(user_id=user_id)
    return settings


async def update_user_digest_settings(
    user_id: str,
    *,
    digest_enabled: Optional[bool] = None,
    daily_digest_enabled: Optional[bool] = None,
    weekly_digest_enabled: Optional[bool] = None,
) -> UserDigestSettings:
    """Update digest settings for a user."""
    settings = await get_user_digest_settings(user_id)

    if digest_enabled is not None:
        settings.digest_enabled = digest_enabled
    if daily_digest_enabled is not None:
        settings.daily_digest_enabled = daily_digest_enabled
    if weekly_digest_enabled is not None:
        settings.weekly_digest_enabled = weekly_digest_enabled

    return await digest_db.save_user_digest_settings(settings)
