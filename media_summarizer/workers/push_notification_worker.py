"""Push notification consumer: hands a notification to Expo.

The delivery path chosen by task-368 and validated by the owner is **Option 1 —
Expo Push Service, one token per device, a single SQS consumer inside the
existing worker image, receipt checking driven by re-enqueueing the same queue
with ``DelaySeconds=900``**. This module is that consumer.

Expo, and not APNs and FCM directly, because a direct integration means holding
an APNs signing key and an FCM service account, minting JWTs, and writing two
payload dialects — for a push surface of two Digest notifications a week and one
line when a saved source becomes readable. Expo already holds the credentials the
EAS build was signed with.

**It renders, per device language, what the producers describe.** A ``send``
message carries a ``notification`` — its ``kind`` and the parameters it needs (the
media's category, a Digest's period and count) — and a ``data`` blob the app routes
on; deciding *that* a notification is due and with which parameters belongs to the
producers (``workers/digest/scheduler.py`` and
``core/services/push_notification_dispatch.py``). The text cannot be fixed by the
producer, because one message reaches every device of an account and each device
reads its notifications in the app's own interface language, stored with its token
(TASK-619). So the tokens are grouped by locale and each group gets its own
rendering from ``core/services/push_notification_copy.py``, which is the one place
the words live. Adding a third kind of notification is a third producer and a third
entry in ``_render``.

**Two message shapes on one queue.** A ``send`` message names a user and the
notification to deliver; a ``receipt_check`` message names the tickets a previous
send produced. They share a queue because they share a consumer, and the second
is produced by the first with a fifteen-minute delay — the interval Expo
recommends before receipts are meaningful.

**Why receipts matter at all**, given the send already answers per token: the
immediate answer is a *ticket*, which only says Expo accepted the notification.
The verdict from APNs or FCM lands minutes later in a *receipt*, and that is
where an uninstalled app shows up as ``DeviceNotRegistered``. Reading receipts is
what keeps the token table from filling with devices that no longer exist.

**A failure raises.** The handler in ``workers/lambda_handlers.py`` turns that
into a batch item failure, SQS retries three times, and the message lands on the
DLQ. What is deliberately *not* retried: a per-token verdict. A rejected token is
either deleted (the device is gone) or logged (nothing a retry would change).

**No token is ever logged**, here or anywhere. Counts, platforms and Expo's own
error codes are; the token itself is a credential — anyone holding it can push to
that device — and it appears in no log line, no exception message and no metric.
``utils/logging_config.py`` redacts the field names as a net under that rule.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx

from media_summarizer.core.models.push_token import PushToken
from media_summarizer.core.services import (
    push_notification_copy,
    push_notification_dispatch,
)
from media_summarizer.utils import push_token_db, sqs
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)

logger = logging.getLogger(__name__)

PUSH_NOTIFICATION_QUEUE = required_env("PUSH_NOTIFICATION_QUEUE")

EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"

#: Expo's documented ceilings: 100 recipients per send call, 1000 ids per receipt
#: call. Both are far above what one account needs — a person has one or two
#: phones — so the chunking exists for correctness, not for throughput.
SEND_BATCH_SIZE = 100
RECEIPT_BATCH_SIZE = 1000

#: SQS caps ``DelaySeconds`` at 900, which is also the delay Expo suggests before
#: reading receipts. The two agreeing is what lets the same queue carry the
#: follow-up instead of a timer, a step function or a second schedule.
RECEIPT_CHECK_DELAY_SECONDS = 900

HTTP_TIMEOUT_SECONDS = 20.0

#: Expo's verdict for a device that no longer has the app installed, or whose
#: notification permission was revoked at the OS level. The only verdict that
#: means "delete this row".
ERROR_DEVICE_NOT_REGISTERED = "DeviceNotRegistered"

#: Optional. Expo's "enhanced security" mode rejects a send that does not carry
#: this bearer token, and is a toggle in the EAS dashboard — an owner action, not
#: a deploy. It is read optionally on purpose: making it required would mean every
#: notification failing until the value is deposited, and the toggle being off is
#: a perfectly valid state.
EXPO_ACCESS_TOKEN = os.environ.get("EXPO_ACCESS_TOKEN", "").strip()

#: The Android channel each kind of notification is filed under, declared next to
#: the producer that needs them in ``core/services/push_notification_dispatch.py``.
_CHANNEL_BY_KIND = {
    push_notification_dispatch.NOTIFICATION_TYPE_DIGEST: push_notification_dispatch.ANDROID_CHANNEL_DIGEST,
    push_notification_dispatch.NOTIFICATION_TYPE_MEDIA_READY: push_notification_dispatch.ANDROID_CHANNEL_MEDIA_READY,
}


def _expo_headers() -> Dict[str, str]:
    headers = {
        "accept": "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
    }
    if EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"
    return headers


async def _post_to_expo(url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """One call to Expo, raising on anything that is not a usable answer.

    Raising is the whole error policy: a transport failure, a 5xx, a rate limit or
    a request-level rejection are all things a retry can fix, and SQS is already
    the retry mechanism. Swallowing them here would turn a recoverable outage into
    silently missing notifications.
    """
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=payload, headers=_expo_headers())

    if response.status_code >= 400:
        # The body can name the reason (a bad access token, a malformed payload)
        # but can also echo a token back, so it is not logged. The status code and
        # the URL are enough to tell an outage from a misconfiguration.
        raise RuntimeError(
            f"Expo push service returned HTTP {response.status_code} for {url}"
        )

    body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError(f"Expo push service returned a non-object body for {url}")

    errors = body.get("errors")
    if errors:
        codes = sorted(
            {str(error.get("code")) for error in errors if isinstance(error, dict)}
        )
        raise RuntimeError(f"Expo push service rejected the request: {codes}")

    return body


def _error_code(entry: Dict[str, Any]) -> str:
    """Expo's error name out of a ticket or a receipt, or the empty string."""
    details = entry.get("details")
    if isinstance(details, dict):
        return str(details.get("error") or "")
    return ""


def _render(
    notification: Dict[str, Any], locale: str
) -> Optional[push_notification_copy.RenderedNotification]:
    """The title and body of ``notification`` in ``locale``, or None for a shape
    this consumer does not know."""
    kind = notification.get("kind")
    if kind == push_notification_dispatch.NOTIFICATION_TYPE_MEDIA_READY:
        return push_notification_copy.render_media_ready(
            locale, str(notification.get("media_category") or "")
        )
    if kind == push_notification_dispatch.NOTIFICATION_TYPE_DIGEST:
        item_count = notification.get("item_count")
        if not isinstance(item_count, int) or isinstance(item_count, bool):
            return None
        return push_notification_copy.render_digest(
            locale, str(notification.get("digest_type") or ""), item_count
        )
    return None


async def _send_chunk(
    user_id: str,
    chunk: Sequence[PushToken],
    rendered: push_notification_copy.RenderedNotification,
    data: Dict[str, Any],
    channel_id: str,
) -> Tuple[List[Tuple[str, str]], int]:
    """One Expo send call for up to ``SEND_BATCH_SIZE`` devices sharing a language.

    Returns the accepted ``(ticket_id, push_token)`` pairs and the rejected count.
    """
    accepted: List[Tuple[str, str]] = []
    rejected = 0
    payload = {
        "to": [token.push_token for token in chunk],
        "title": rendered.title,
        "body": rendered.body,
        "data": data,
        "sound": "default",
        "channelId": channel_id,
    }
    response = await _post_to_expo(EXPO_SEND_URL, payload)

    # Expo answers one ticket per recipient, in the order the recipients were
    # given. `zip` on the shorter of the two is deliberate: a truncated answer
    # loses the tail's receipts, which the next send recovers, whereas
    # indexing blind would mis-attribute a verdict to the wrong device — and
    # delete a live registration.
    tickets = response.get("data") or []
    if not isinstance(tickets, list):
        raise RuntimeError("Expo push service returned a non-list ticket set")
    if len(tickets) != len(chunk):
        log_event(
            logger,
            logging.WARNING,
            "push_notification.ticket_count_mismatch",
            "Expo returned a different number of tickets than recipients",
            user_id=user_id,
            sent_count=len(chunk),
            ticket_count=len(tickets),
        )

    for token, ticket in zip(chunk, tickets):
        if not isinstance(ticket, dict):
            continue
        if ticket.get("status") == "ok":
            ticket_id = ticket.get("id")
            if ticket_id:
                accepted.append((str(ticket_id), token.push_token))
            continue

        rejected += 1
        code = _error_code(ticket)
        log_event(
            logger,
            logging.WARNING,
            "push_notification.rejected",
            "Expo rejected a push recipient",
            user_id=user_id,
            platform=token.platform.value,
            error_code=code or "unknown",
        )
        if code == ERROR_DEVICE_NOT_REGISTERED:
            await push_token_db.delete_token(user_id, token.push_token)
    return accepted, rejected


async def _handle_send(body: Dict[str, Any]) -> None:
    """Deliver one notification to every device of one account, each in its language.

    Devices are read here rather than carried in the message: the scheduler
    decides *that* a notification is due, and a device registered or removed in
    the seconds since is still handled correctly.
    """
    user_id = body.get("user_id")
    notification = body.get("notification")
    kind = notification.get("kind") if isinstance(notification, dict) else None
    channel_id = _CHANNEL_BY_KIND.get(str(kind))
    if (
        not user_id
        or not isinstance(notification, dict)
        or channel_id is None
        or _render(notification, push_notification_copy.FALLBACK_LOCALE) is None
    ):
        # Nothing a retry would fix. Logged and dropped rather than sent to the
        # DLQ three attempts later.
        log_event(
            logger,
            logging.ERROR,
            "push_notification.malformed",
            "Push notification message is missing required fields",
            queue=PUSH_NOTIFICATION_QUEUE,
        )
        return

    data = body.get("data") or {}
    tokens = await push_token_db.list_tokens_for_user(user_id)
    if not tokens:
        # The normal state for an account that never granted the permission, or
        # granted it on a device it no longer owns. Not an error.
        log_event(
            logger,
            logging.INFO,
            "push_notification.no_device",
            "No registered device for this account",
            user_id=user_id,
            notification_kind=data.get("type"),
        )
        return

    # One rendering per interface language among this account's devices. A row
    # registered before the app sent its language has none and reads English.
    by_locale: Dict[str, List[PushToken]] = {}
    for token in tokens:
        by_locale.setdefault(
            push_notification_copy.normalize_locale(token.locale), []
        ).append(token)

    accepted: List[Tuple[str, str]] = []  # (ticket_id, push_token)
    rejected = 0

    for locale, locale_tokens in by_locale.items():
        rendered = _render(notification, locale)
        if rendered is None:  # cannot happen: the shape was checked above
            continue
        for start in range(0, len(locale_tokens), SEND_BATCH_SIZE):
            chunk = locale_tokens[start : start + SEND_BATCH_SIZE]
            accepted_chunk, rejected_chunk = await _send_chunk(
                user_id, chunk, rendered, data, channel_id
            )
            accepted.extend(accepted_chunk)
            rejected += rejected_chunk

    log_event(
        logger,
        logging.INFO,
        "push_notification.sent",
        "Push notification handed to Expo",
        user_id=user_id,
        notification_kind=data.get("type"),
        period_key=data.get("period_key"),
        device_count=len(tokens),
        locales=sorted(by_locale),
        accepted_count=len(accepted),
        rejected_count=rejected,
    )

    if accepted:
        await _schedule_receipt_check(user_id, accepted)


async def _schedule_receipt_check(
    user_id: str, accepted: Sequence[Tuple[str, str]]
) -> None:
    """Re-enqueue the ticket ids for a look at their receipts in fifteen minutes.

    The tokens travel with the ids because the mapping is the only way to know
    *which* device a ``DeviceNotRegistered`` receipt condemns, and Expo's receipt
    does not reliably echo the token back. They travel inside our own encrypted
    queue, reachable by the worker role alone, which is the same trust boundary as
    the DynamoDB table they came from.
    """
    await sqs.send_message(
        queue_name=PUSH_NOTIFICATION_QUEUE,
        message_body={
            "notification_type": "receipt_check",
            "user_id": user_id,
            "tickets": [
                {"id": ticket_id, "push_token": token} for ticket_id, token in accepted
            ],
        },
        delay_seconds=RECEIPT_CHECK_DELAY_SECONDS,
    )


async def _handle_receipt_check(body: Dict[str, Any]) -> None:
    """Read the receipts of a past send and delete the devices that are gone.

    A receipt that is not available yet is counted and left alone. Nothing is
    re-scheduled for it: the same verdict comes back on the next send's ticket, at
    worst a day later, and the ninety-day sweep in ``push_token_db`` is the floor
    under both. Chasing a pending receipt would be a second retry ladder for a row
    that two other mechanisms already remove.
    """
    user_id = body.get("user_id")
    entries = body.get("tickets") or []
    token_by_id = {
        str(entry["id"]): str(entry["push_token"])
        for entry in entries
        if isinstance(entry, dict) and entry.get("id") and entry.get("push_token")
    }
    if not user_id or not token_by_id:
        log_event(
            logger,
            logging.ERROR,
            "push_notification.malformed",
            "Receipt check message carries no usable ticket",
            queue=PUSH_NOTIFICATION_QUEUE,
        )
        return

    ticket_ids = list(token_by_id)
    pending = 0
    unregistered = 0
    errored = 0

    for start in range(0, len(ticket_ids), RECEIPT_BATCH_SIZE):
        chunk = ticket_ids[start : start + RECEIPT_BATCH_SIZE]
        response = await _post_to_expo(EXPO_RECEIPTS_URL, {"ids": chunk})
        receipts = response.get("data") or {}
        if not isinstance(receipts, dict):
            raise RuntimeError("Expo push service returned a non-object receipt set")

        for ticket_id in chunk:
            receipt = receipts.get(ticket_id)
            if not isinstance(receipt, dict):
                pending += 1
                continue
            if receipt.get("status") == "ok":
                continue

            code = _error_code(receipt)
            if code == ERROR_DEVICE_NOT_REGISTERED:
                unregistered += 1
                await push_token_db.delete_token(user_id, token_by_id[ticket_id])
            else:
                errored += 1
                log_event(
                    logger,
                    logging.WARNING,
                    "push_notification.receipt_error",
                    "Push receipt reports a delivery failure",
                    user_id=user_id,
                    error_code=code or "unknown",
                )

    log_event(
        logger,
        logging.INFO,
        "push_notification.receipts_checked",
        "Push receipts checked",
        user_id=user_id,
        ticket_count=len(ticket_ids),
        pending_count=pending,
        unregistered_count=unregistered,
        error_count=errored,
    )


async def process_message(message: Dict[str, Any]) -> None:
    """SQS entry point, routing on ``notification_type``."""
    body = json.loads(message.get("Body", "{}"))
    notification_type = body.get("notification_type")

    token = bind_log_context(user_id=body.get("user_id"))
    try:
        if notification_type == "send":
            await _handle_send(body)
        elif notification_type == "receipt_check":
            await _handle_receipt_check(body)
        else:
            log_event(
                logger,
                logging.ERROR,
                "push_notification.unknown_type",
                "Unknown push notification message type",
                queue=PUSH_NOTIFICATION_QUEUE,
                notification_type=str(notification_type),
            )
    finally:
        reset_log_context(token)
