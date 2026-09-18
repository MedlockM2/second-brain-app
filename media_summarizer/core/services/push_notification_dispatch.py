"""The one way a "your source is ready" notification is put on the queue.

**Why the backend announces this at all.** A media whose processing finishes while
the app is closed has nobody to tell: the client refresh that settles a vignette
(``mobile/src/hooks/useProcessingRefresh.ts``) only runs while the screen is
visible, and iOS gives a suspended app no background execution to poll from. The
owner's decision on the task-404 benchmark is explicit that this notification goes
out **whatever the processing duration**, with no threshold: a save is worth an
announcement because the user asked for it, not because it was slow.

**One notification per media per user**, emitted from the completion event, which
is also the join point that already deduplicates a user appearing both as the
submitter and as a watcher of the same content. So the count in the body is one by
construction, and the field is still written as a count rather than a name — see
below.

**Nothing about the content travels.** Expo's push service relays the payload and
its staff can read it while debugging, so the body says how many sources are ready
and never which: no title, no creator, no source. That is the same rule the Digest
notification follows (task-368), and it is why a notification cannot be assembled
from the media's own title even though the worker has it in hand. ``data`` carries
the library id, which is opaque and is what the app needs to open the right screen.

**Failure is swallowed.** A completion event must not be replayed because a
notification could not be scheduled: replaying it would re-index, re-blurb and
re-notify. The enqueue is best effort and says so in its return value.
"""

from __future__ import annotations

import logging
from typing import Optional

from media_summarizer.utils import sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

PUSH_NOTIFICATION_QUEUE = required_env("PUSH_NOTIFICATION_QUEUE")

#: The Android notification channels the app creates before it ever asks for a
#: token (``mobile/src/services/pushNotificationService.ts``). The strings must
#: agree with it: a channel id Android does not know falls back to
#: expo-notifications' own "Miscellaneous" channel, so the notification would still
#: arrive but under a category the user cannot recognise — and Android's
#: per-category mute would stop meaning what it says.
#:
#: Two of them, because that mute is per channel: someone who wants to be told a
#: source is ready but not to get a daily Digest has to be able to say so.
ANDROID_CHANNEL_DIGEST = "digest"
ANDROID_CHANNEL_MEDIA_READY = "media_ready"

#: The ``data.type`` each producer stamps its notification with, and the only thing
#: the app routes a tap on. ``MEDIA_READY`` also tells the app to suppress the
#: banner when the notification lands while the app is open — the vignette settling
#: on screen is the answer there, not a banner about the screen in front of you.
NOTIFICATION_TYPE_DIGEST = "digest"
NOTIFICATION_TYPE_MEDIA_READY = "media_ready"


async def enqueue_media_ready_notification(
    *,
    user_id: Optional[str],
    media_item_id: Optional[str],
) -> bool:
    """Tell one account that one of its sources is ready to read. Never raises.

    Returns whether a message was sent. Skipped, with a structured log, when the
    owner or the library id is missing: the first has no device to reach and the
    second is what a tap would open.

    Whether the account has a registered device at all is not asked here — the
    consumer reads the token table itself, so an account that never granted the
    permission costs one queue message and one "no_device" log line, and no
    duplicate of that logic can drift out of step with it.
    """
    if not user_id or not media_item_id:
        log_event(
            logger,
            logging.WARNING,
            "push_notification.media_ready_skipped",
            "Skipped media-ready notification: missing user_id or media_item_id",
            has_user_id=bool(user_id),
            has_media_item_id=bool(media_item_id),
        )
        return False

    try:
        await sqs.send_message(
            queue_name=PUSH_NOTIFICATION_QUEUE,
            message_body={
                "notification_type": "send",
                "user_id": user_id,
                # English, like the Digest notification: the backend does not know
                # the reader's app language, and task-404 keeps a per-account locale
                # out of scope (§7.10).
                "title": "Ready to read",
                "body": "1 source is ready.",
                "channel_id": ANDROID_CHANNEL_MEDIA_READY,
                "data": {
                    "type": NOTIFICATION_TYPE_MEDIA_READY,
                    "media_item_id": media_item_id,
                },
            },
        )
    except Exception as exc:  # noqa: BLE001 - a notification never fails its caller
        log_event(
            logger,
            logging.WARNING,
            "push_notification.media_ready_enqueue_failed",
            "Failed to enqueue media-ready notification",
            user_id=user_id,
            media_item_id=media_item_id,
            error=str(exc),
        )
        return False

    return True
