#!/usr/bin/env python3
"""
Reproducible multi-instance verification for PodcastIndex global limiter.

This script does not call PodcastIndex. It validates the slot scheduler itself by
running multiple OS processes that concurrently request limiter slots.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import time
from concurrent.futures import ProcessPoolExecutor


def _run_worker(iterations: int) -> list[float]:
    async def _run() -> list[float]:
        from media_summarizer.utils.podcastindex_limiter import acquire_podcastindex_slot

        timestamps: list[float] = []
        for _ in range(iterations):
            await acquire_podcastindex_slot()
            timestamps.append(time.time())
        return timestamps

    return asyncio.run(_run())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4, help="Process count")
    parser.add_argument(
        "--iterations", type=int, default=5, help="Limiter acquisitions per process"
    )
    parser.add_argument(
        "--tolerance-ms",
        type=int,
        default=100,
        help="Timing slack allowed below the limiter's guarantee.",
    )
    args = parser.parse_args()

    redis_url = os.getenv("PODCASTINDEX_LIMITER_REDIS_URL", "").strip()
    if not redis_url:
        print("PODCASTINDEX_LIMITER_REDIS_URL is not set. Aborting.")
        return 2

    all_timestamps: list[float] = []
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(_run_worker, args.iterations) for _ in range(args.workers)]
        for future in futures:
            all_timestamps.extend(future.result())

    all_timestamps.sort()
    if len(all_timestamps) < 2:
        print("Not enough timestamps to validate limiter behavior.")
        return 2

    from media_summarizer.utils.podcastindex_limiter import _BURST, _INTERVAL_MS

    # The limiter's guarantee (GCRA): any n consecutive slots, across every
    # process, span at least (n - burst) intervals.
    worst_ms = 0
    for i in range(len(all_timestamps)):
        for j in range(i + 1, len(all_timestamps)):
            required = (j - i + 1 - _BURST) * _INTERVAL_MS
            actual = (all_timestamps[j] - all_timestamps[i]) * 1000
            worst_ms = max(worst_ms, int(required - actual))

    print(
        f"Collected {len(all_timestamps)} slots "
        f"(workers={args.workers}, iterations={args.iterations}, "
        f"interval={_INTERVAL_MS}ms, burst={_BURST})."
    )
    print(f"Largest shortfall against the guarantee: {worst_ms}ms")

    if worst_ms > args.tolerance_ms:
        print(f"FAILED: slots ran {worst_ms}ms ahead of the limiter's guarantee.")
        return 1

    print("OK: slots stay within the limiter's guarantee.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

