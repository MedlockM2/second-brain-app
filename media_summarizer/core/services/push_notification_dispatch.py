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
submitter and as a watcher of the same content. So the body can speak of a single
media in the singular, with no count to compute.

**The body names the media's category, and nothing more.** Expo's push service
relays the payload and its staff can read it while debugging, so the rule inherited
from the Digest notification (task-368) stands: no title, no creator, **and no
source platform** — "Your video has been processed", never "Your YouTube video".
Naming the category is the compromise the owner settled on task-407: more useful
than the count this used to carry ("1 source is ready."), which told the person
nothing they did not already know, while still not revealing which service they
feed on. ``data`` carries the library id, which is opaque and is what the app needs
to open the right screen.

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

#: The word the body puts after "Your", per value an ingestion path actually
#: writes into ``media_type``.
#:
#: Keyed on what the *code* writes, not on the ``MediaType`` enum: the enum is not
#: the contract here, because ``media_type`` is an ``Optional[str]`` on
#: ``ProcessingJob`` and two paths write values that are not enum members at all --
#: ``"document"`` (the upload handler in ``api/endpoints/media.py`` and
#: ``workers/document_parsing/worker.py``) and ``"audio"`` (the audio upload
#: handler). A map built from the enum would have quietly sent every parsed document
#: and every uploaded audio file through the generic label, which is the whole point
#: of enumerating the written values instead (task-407).
#:
#: Each label is a *category*, deliberately never a platform: ``youtube_video`` and
#: ``short_video`` both read "video" because the body must not say which service the
#: media came from.
MEDIA_TYPE_LABELS = {
    "podcast_episode": "podcast episode",
    "article": "article",
    "youtube_video": "video",
    "short_video": "video",
    "image_post": "image",
    "audio_file": "audio",
    "audio": "audio",
    "shared_text": "note",
    "document": "document",
}

#: What an unnamed media is called. Covers three cases that are all the same for the
#: reader: no ``media_type`` on the job at all, ``MediaType.UNKNOWN``, and a value a
#: future ingestion path writes without adding it above. The raw value is never
#: interpolated into the body -- an internal token like ``short_video`` in a
#: notification would be a leak of vocabulary, and a wrong one is worse than a vague
#: one.
GENERIC_MEDIA_LABEL = "source"


def _media_label(media_type: Optional[str]) -> str:
    """The category word for this media, or the generic one. Never the raw value."""
    normalized = (media_type or "").strip().lower()
    label = MEDIA_TYPE_LABELS.get(normalized)
    if label:
        return label
    if normalized and normalized != "unknown":
        # Not noise: an ingestion path writing a value this module does not know is
        # a notification silently losing its specificity, and the only way to see it
        # is from here. `media_type` is a declared field of the log schema.
        log_event(
            logger,
            logging.WARNING,
            "push_notification.media_ready_unlabelled_type",
            "No notification label for this media_type; using the generic one",
            media_type=normalized,
        )
    return GENERIC_MEDIA_LABEL


async def enqueue_media_ready_notification(
    *,
    user_id: Optional[str],
    media_item_id: Optional[str],
    media_type: Optional[str],
) -> bool:
    """Tell one account that one of its sources is ready to deepen. Never raises.

    Returns whether a message was sent. Skipped, with a structured log, when the
    owner or the library id is missing: the first has no device to reach and the
    second is what a tap would open.

    ``media_type`` is the job's own weakly-typed value and is allowed to be absent:
    it only picks the word in the body, through :func:`_media_label`, and a media
    whose category is unknown is still worth announcing.

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
                # out of scope (§7.10). The Android channel name the app creates is
                # translated and must keep saying the same thing as this title
                # (`notifications.mediaReadyChannel` in `mobile/src/i18n/`).
                "title": "Ready to deepen",
                "body": f"Your {_media_label(media_type)} has been processed.",
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
