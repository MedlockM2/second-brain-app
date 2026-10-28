"""
Podcast Index utilities for podcast search and retrieval operations.

This module provides simple, stateless utility functions for interacting
with the Podcast Index API in the Media Summarizer application.
"""

import hashlib
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import httpx

from media_summarizer.utils.podcastindex_limiter import acquire_podcastindex_slot

# Configure logging
logger = logging.getLogger(__name__)

# API configuration
PODCAST_INDEX_BASE_URL = "https://api.podcastindex.org/api/1.0"


def _get_env_stripped(name: str) -> Optional[str]:
    v = os.getenv(name)
    if v is None:
        return None
    # Remove surrounding quotes and whitespace
    v = v.strip()
    if (v.startswith('"') and v.endswith('"')) or (
        v.startswith("'") and v.endswith("'")
    ):
        v = v[1:-1]
    return v.strip()


# ---------------------------------------------------------------------------
# Lazy credential loading
# ---------------------------------------------------------------------------
# Credentials are read on first use rather than at module-import time.
# This is critical because media_summarizer/utils/__init__.py eagerly imports
# this module (triggering module-level code), but in the Lambda deployment the
# secrets are injected into os.environ by lambda_handlers.py AFTER the utils
# package has already been imported.  Reading at module level would always see
# empty values, causing every PodcastIndex API call to fail.


def _get_credentials() -> tuple[Optional[str], Optional[str]]:
    """Return (API_KEY, API_SECRET) read lazily from os.environ."""
    return (
        _get_env_stripped("PODCASTINDEXORG_API_KEY"),
        _get_env_stripped("PODCASTINDEXORG_API_SECRET"),
    )


# HTTP client configuration (durcissement: timeouts explicites)
PODCAST_INDEX_TIMEOUT_SECONDS = int(os.getenv("PODCAST_INDEX_TIMEOUT_SECONDS", "20"))
_HTTP_TIMEOUT = httpx.Timeout(PODCAST_INDEX_TIMEOUT_SECONDS)


def _generate_headers() -> Dict[str, str]:
    """
    Generate authentication headers for Podcast Index API.

    Returns:
        Dict containing required headers for authentication
    """
    api_key, api_secret = _get_credentials()
    if not api_key or not api_secret:
        # For test mode
        if api_key == "test_key" and api_secret == "test_secret":
            return {
                "User-Agent": "MediaSummarizer/1.0",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        raise ValueError(
            "PODCASTINDEXORG_API_KEY and PODCASTINDEXORG_API_SECRET must be set"
        )

    unix_time = str(int(time.time()))

    # Create authorization hash: SHA1(api_key + api_secret + unix_time)
    hash_string = api_key + api_secret + unix_time
    authorization_hash = hashlib.sha1(hash_string.encode()).hexdigest()

    return {
        "X-Auth-Date": unix_time,
        "X-Auth-Key": api_key,
        # Some clients/libraries/infra expect either Authorization or X-Auth-Hash; include both.
        "Authorization": authorization_hash,
        "X-Auth-Hash": authorization_hash,
        "User-Agent": "MediaSummarizer/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def _rate_limited_get(
    *,
    url: str,
    headers: Dict[str, str],
    params: Dict[str, Any],
    http_client: Optional[httpx.AsyncClient] = None,
) -> httpx.Response:
    wait_seconds = await acquire_podcastindex_slot()
    if wait_seconds > 0:
        logger.debug(
            "PodcastIndex limiter wait applied: %.3fs for %s",
            wait_seconds,
            url,
        )

    if http_client:
        return await http_client.get(url, headers=headers, params=params)

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        return await client.get(url, headers=headers, params=params)


async def search_podcasts(
    query: str,
    max_results: int = 10,
    clean: bool = True,
    similar: bool = False,
    http_client: Optional[httpx.AsyncClient] = None,
) -> Dict[str, Any]:
    """
    Search for podcasts by term using Podcast Index API.

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default: 10, max: 1000)
        clean: Whether to clean the results (remove explicit content, etc.)
        similar: Whether to include similar matches (fuzzy search)
        http_client: Optional HTTP client for dependency injection

    Returns:
        Dict containing search results with podcasts data

    Raises:
        Exception: If the API request fails
    """
    try:
        headers = _generate_headers()
        params = {"q": query, "max": min(max_results, 1000)}

        if clean:
            params["clean"] = "true"
        if similar:
            params["similar"] = "true"

        url = f"{PODCAST_INDEX_BASE_URL}/search/byterm"

        response = await _rate_limited_get(
            url=url,
            headers=headers,
            params=params,
            http_client=http_client,
        )

        response.raise_for_status()
        data = response.json()

        logger.info(f"Found {data.get('count', 0)} podcasts for query: {query}")
        return data

    except httpx.HTTPStatusError as e:
        logger.error(
            f"HTTP error searching podcasts: {e.response.status_code} - {e.response.text}"
        )
        raise Exception(f"Failed to search podcasts: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Error searching podcasts: {str(e)}")
        raise


async def get_podcast_by_feed_url(
    feed_url: str, http_client: Optional[httpx.AsyncClient] = None
) -> Dict[str, Any]:
    """
    Get podcast information by RSS feed URL.

    Args:
        feed_url: RSS feed URL
        http_client: Optional HTTP client for dependency injection

    Returns:
        Dict containing podcast information

    Raises:
        Exception: If the API request fails
    """
    try:
        headers = _generate_headers()
        params = {"url": feed_url}

        url = f"{PODCAST_INDEX_BASE_URL}/podcasts/byfeedurl"

        response = await _rate_limited_get(
            url=url,
            headers=headers,
            params=params,
            http_client=http_client,
        )

        response.raise_for_status()
        data = response.json()

        logger.info(f"Retrieved podcast info for feed URL: {feed_url}")
        return data

    except httpx.HTTPStatusError as e:
        logger.error(
            f"HTTP error getting podcast by feed URL: {e.response.status_code} - {e.response.text}"
        )
        raise Exception(f"Failed to get podcast by feed URL: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Error getting podcast by feed URL: {str(e)}")
        raise


async def get_podcast_by_itunes_id(
    itunes_id: int | str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> Dict[str, Any]:
    """
    Get podcast information by Apple Podcasts iTunes show ID.

    Args:
        itunes_id: Apple Podcasts iTunes show ID
        http_client: Optional HTTP client for dependency injection

    Returns:
        Dict containing podcast information

    Raises:
        Exception: If the API request fails
    """
    try:
        headers = _generate_headers()
        params = {"id": str(itunes_id).strip()}
        url = f"{PODCAST_INDEX_BASE_URL}/podcasts/byitunesid"

        response = await _rate_limited_get(
            url=url,
            headers=headers,
            params=params,
            http_client=http_client,
        )

        response.raise_for_status()
        data = response.json()

        logger.info("Retrieved podcast info for iTunes ID: %s", params["id"])
        return data

    except httpx.HTTPStatusError as e:
        logger.error(
            "HTTP error getting podcast by iTunes ID: %s - %s",
            e.response.status_code,
            e.response.text,
        )
        raise Exception(f"Failed to get podcast by iTunes ID: {e.response.status_code}")
    except Exception as e:
        logger.error("Error getting podcast by iTunes ID: %s", str(e))
        raise


async def get_episodes_by_feed_id(
    feed_id: int,
    max_results: int = 10,
    since: Optional[int] = None,
    http_client: Optional[httpx.AsyncClient] = None,
) -> Dict[str, Any]:
    """
    Get episodes for a podcast by feed ID.

    Args:
        feed_id: Podcast Index feed ID
        max_results: Maximum number of episodes to return (default: 10, max: 1000)
        since: Unix timestamp to get episodes since (optional)
        http_client: Optional HTTP client for dependency injection

    Returns:
        Dict containing episodes data

    Raises:
        Exception: If the API request fails
    """
    try:
        headers = _generate_headers()
        params = {"id": feed_id, "max": min(max_results, 1000)}

        if since:
            params["since"] = since

        url = f"{PODCAST_INDEX_BASE_URL}/episodes/byfeedid"

        response = await _rate_limited_get(
            url=url,
            headers=headers,
            params=params,
            http_client=http_client,
        )

        response.raise_for_status()
        data = response.json()

        # Temporary debug log: dump raw PodcastIndex response for this feed id.
        # This helps diagnose missing feedTitle values during debugging.
        try:
            # Limit size to avoid extremely large logs in case of large responses
            raw_dump = json.dumps(data, ensure_ascii=False)
            if len(raw_dump) > 20000:
                raw_dump = raw_dump[:20000] + "...(truncated)"
            logger.debug(
                "PodcastIndex raw response for feed_id=%s: %s", feed_id, raw_dump
            )
        except Exception as e:
            logger.debug(
                "Failed to JSON-dump PodcastIndex response for feed_id=%s: %s",
                feed_id,
                str(e),
            )

        logger.info(f"Retrieved {data.get('count', 0)} episodes for feed ID: {feed_id}")
        return data

    except httpx.HTTPStatusError as e:
        logger.error(
            f"HTTP error getting episodes by feed ID: {e.response.status_code} - {e.response.text}"
        )
        raise Exception(f"Failed to get episodes by feed ID: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Error getting episodes by feed ID: {str(e)}")
        raise


async def get_episode_by_itunes_id(
    itunes_episode_id: int | str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> Dict[str, Any]:
    """
    Get a specific episode by its Apple Podcasts iTunes episode ID.

    Uses the PodcastIndex 'episodes/byitunesid' endpoint to directly map
    an Apple Podcasts ?i=<episode_id> value to a PodcastIndex episode record.

    Args:
        itunes_episode_id: Apple Podcasts iTunes episode ID (the ?i= parameter)
        http_client: Optional HTTP client for dependency injection

    Returns:
        Dict containing episode data with 'status' and 'episode' keys

    Raises:
        Exception: If the API request fails
    """
    try:
        headers = _generate_headers()
        params = {"id": str(itunes_episode_id).strip()}

        url = f"{PODCAST_INDEX_BASE_URL}/episodes/byitunesid"

        response = await _rate_limited_get(
            url=url,
            headers=headers,
            params=params,
            http_client=http_client,
        )

        response.raise_for_status()
        data = response.json()

        logger.info(
            "Retrieved episode data for iTunes episode ID: %s", params["id"]
        )
        return data

    except httpx.HTTPStatusError as e:
        logger.error(
            "HTTP error getting episode by iTunes episode ID: %s - %s",
            e.response.status_code,
            e.response.text,
        )
        raise Exception(
            f"Failed to get episode by iTunes episode ID: {e.response.status_code}"
        )
    except Exception as e:
        logger.error("Error getting episode by iTunes episode ID: %s", str(e))
        raise
