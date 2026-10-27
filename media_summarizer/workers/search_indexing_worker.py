"""Index each save's fixed reading-language text, once it is available.

Messages carry only user_id and media_item_id. The durable row selects the
language and the content ledger selects the source. Foreign source text is
never published while its translation is pending or failed.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict

from media_summarizer.core.services import search_indexing
from media_summarizer.core.services.durable_media_service import resolve_content_transcript
from media_summarizer.core.services.raw_content_service import get_raw_content
from media_summarizer.utils import sqs
from media_summarizer.utils import user_media as user_media_store
from media_summarizer.utils.env import required_env
from media_summarizer.utils.logging_config import (
    bind_log_context,
    log_event,
    reset_log_context,
)

logger = logging.getLogger(__name__)

SEARCH_INDEXING_QUEUE = required_env("SEARCH_INDEXING_QUEUE")
TRANSLATION_POLL_SECONDS = 15
TRANSLATION_MAX_WAIT_SECONDS = 3600

# Backoff
TEST_MODE = os.environ.get("TEST_MODE", "false").lower() == "true"
RETRY_DELAY = 0.01 if TEST_MODE else 2


async def process_indexing_message(message: Dict[str, Any]) -> None:
    """
    Process a single search indexing message.

    Resolve the fixed reading-language text, then publish it in Algolia.
    """
    body = json.loads(message.get("Body", "{}"))

    media_item_id = body.get("media_item_id")
    user_id = body.get("user_id")
    if not media_item_id or not user_id:
        logger.error(
            f"Missing required fields in search indexing message: {body}"
        )
        return

    context_token = bind_log_context(
        media_item_id=media_item_id, user_id=user_id
    )
    try:
        log_event(
            logger,
            logging.INFO,
            "search_indexing.started",
            "Downloading transcript for search indexing",
            media_item_id=media_item_id,
        )

        # The save may be gone: this message is written when transcription ends and
        # read minutes later, and in between the user can have deleted the item --
        # cancelling a share whose processing had already started is exactly that
        # (task-378). Deletion drops the Algolia chunks of the item, so indexing it
        # now would put a deleted save back into search results, which the search
        # endpoint serves from Algolia and cannot filter out on its own.
        #
        # ``get_user_media`` reads a soft-deleted row as absent, which is the whole
        # check: no row, no indexing.
        record = await user_media_store.get_user_media(user_id, media_item_id)
        if record is None:
            log_event(
                logger,
                logging.INFO,
                "search_indexing.skipped_deleted",
                "Skipped search indexing: the save no longer exists",
                media_item_id=media_item_id,
            )
            return

        transcript = await resolve_content_transcript(record)
        if transcript is None:
            raise RuntimeError("Content transcript unavailable for search indexing")
        raw = await get_raw_content(transcript, reading_language=record.reading_language)
        translation = raw.translation or {}
        if translation.get("translation_pending"):
            # Requeue an inexpensive check without spending Lambda time waiting,
            # or consuming SQS's delivery attempts for a normal translation wait.
            started = body.get("translation_wait_started_at") or int(time.time())
            if time.time() - started >= TRANSLATION_MAX_WAIT_SECONDS:
                raise RuntimeError("Translation did not become ready for search indexing")
            await sqs.send_message(
                queue_name=SEARCH_INDEXING_QUEUE,
                message_body={**body, "translation_wait_started_at": started},
                delay_seconds=TRANSLATION_POLL_SECONDS,
            )
            return
        if record.reading_language and not (
            translation.get("is_translated")
            or translation.get("detected_language") == record.reading_language
        ):
            # Failed/unknown translations do not make foreign source text searchable.
            # A later successful translation wakes this save through its worker.
            log_event(
                logger, logging.INFO, "search_indexing.translation_unavailable",
                "Skipped search indexing: reading-language text is unavailable",
                media_item_id=media_item_id,
            )
            return

        # Recheck deletion after the S3/state reads, before publishing a hit.
        if await user_media_store.get_user_media(user_id, media_item_id) is None:
            return
        search_indexing.index_transcript(
            user_id=user_id,
            media_item_id=media_item_id,
            transcript_text=raw.content,
            title=record.title,
            creator_name=record.creator_name,
            source_platform=record.source_platform,
            created_at=int(record.saved_at.timestamp()),
        )

        log_event(
            logger,
            logging.INFO,
            "search_indexing.completed",
            "Transcript indexed successfully",
            media_item_id=media_item_id,
        )

    except Exception as e:
        logger.error(
            f"Failed to index transcript for media_item_id={media_item_id}: {e}",
            exc_info=True,
        )
        # Re-raise so the message stays in the queue for retry
        raise
    finally:
        reset_log_context(context_token)


async def poll_queue() -> None:
    """Poll the search indexing SQS queue."""
    log_event(
        logger,
        logging.INFO,
        "worker.started",
        "Starting search indexing worker",
        queue=SEARCH_INDEXING_QUEUE,
    )

    while True:
        try:
            messages = await sqs.receive_messages(
                queue_name=SEARCH_INDEXING_QUEUE,
                max_messages=10,
                wait_time_seconds=20,
            )
            if messages:
                for m in messages:
                    try:
                        await process_indexing_message(m)
                        receipt_handle = m.get("ReceiptHandle")
                        if receipt_handle:
                            await sqs.delete_message(
                                queue_name=SEARCH_INDEXING_QUEUE,
                                receipt_handle=receipt_handle,
                            )
                    except Exception as e:
                        logger.error(f"Failed to process search indexing message: {e}")
            await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Polling error in search indexing worker: {e}")
            await asyncio.sleep(RETRY_DELAY)


async def main() -> None:
    """Main entry point for the search indexing worker."""
    await poll_queue()


if __name__ == "__main__":
    from media_summarizer.utils.logging_config import setup_logging

    setup_logging("worker-search-indexing")
    asyncio.run(main())
