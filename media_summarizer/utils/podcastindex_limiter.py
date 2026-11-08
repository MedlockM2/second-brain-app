"""Distributed rate limiter for PodcastIndex outbound calls."""

from __future__ import annotations

import logging
import os

from media_summarizer.utils.distributed_rate_limiter import acquire_global_slot

logger = logging.getLogger(__name__)

_LIMIT_ENABLED = os.getenv("PODCASTINDEX_RATE_LIMIT_ENABLED", "true").lower() not in {
    "0",
    "false",
    "no",
}
# Sustained rate and burst per limiter scope. Without Redis the scope is one
# Lambda instance, so the global ceiling is instances x these values: with the
# resolution worker's 10 instances, 20 req/s sustained and 50 requests at once,
# against a provider that served 64 req/s cleanly and blocks an IP for an hour
# somewhere below 128 (docs/ADR/podcastindex-rate-limiting.md). The burst lets a
# resolution's 3 to 7 calls run without waiting; 1 req/s with no burst made each
# one wait a second between calls.
_RPS = float(os.getenv("PODCASTINDEX_RATE_LIMIT_RPS", "2") or "2")
_BURST = max(1, int(os.getenv("PODCASTINDEX_RATE_LIMIT_BURST", "5") or "5"))
_INTERVAL_MS = max(1, int(1000 / max(_RPS, 0.001)))
_REDIS_URL = (os.getenv("PODCASTINDEX_LIMITER_REDIS_URL") or "").strip()
_REDIS_KEY = os.getenv(
    "PODCASTINDEX_LIMITER_KEY", "podcastindex:global:next_allowed_ms"
)
_REDIS_KEY_TTL_MS = int(os.getenv("PODCASTINDEX_LIMITER_TTL_MS", "60000"))


async def acquire_podcastindex_slot() -> float:
    """
    Reserve a global PodcastIndex call slot and wait until it is due.

    Returns:
        Wait time in seconds applied before the caller can perform outbound call.
    """
    return await acquire_global_slot(
        enabled=_LIMIT_ENABLED,
        interval_ms=_INTERVAL_MS,
        redis_url=_REDIS_URL,
        redis_key=_REDIS_KEY,
        redis_key_ttl_ms=_REDIS_KEY_TTL_MS,
        limiter_name="PodcastIndex",
        logger=logger,
        burst=_BURST,
    )
