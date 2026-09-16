"""E2E test for a foreign media read by a French reader (task-192, task-398).

Scenario: a user with ``reading_language=fr`` ingests an English-language
Instagram Reel, opens the transcript, then asks for a summary.

Expected, and the two halves are deliberately different paths:

- **The reader's full text** (``/raw-content``) is translated into French,
  asynchronously: the first call is a cache miss that answers with the original
  English text and ``translation_pending: true``, the SQS worker translates, and a
  later call answers in French with the provenance in ``translation``. The endpoint
  never translates synchronously — that is what killed it at API Gateway's hard
  30 s integration timeout before task-203.
- **The artifact** is generated from the **original** transcript and written in
  French by the prompt alone (task-398). So the corpus is never translated: the
  source snapshot keeps the English transcript key and ``language: "en"``, while
  the summary itself reads in French. This is what lets a generation start the
  second a foreign media lands instead of waiting 60-90 s for a translation.

Uses a dedicated user (not the shared session ``test_user``) so that setting
``reading_language=fr`` cannot affect other E2E tests running in the same
session.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, AsyncIterator, Dict

import httpx
import pytest
import pytest_asyncio
from langdetect import DetectorFactory, detect

from tests.e2e.conftest import _teardown_user, poll_until

INSTAGRAM_REEL_URL = "https://www.instagram.com/reel/DZjAGUKSLeu/"

DetectorFactory.seed = 0


@pytest_asyncio.fixture(scope="module")
async def french_reader_headers(
    http_client: httpx.AsyncClient,
) -> AsyncIterator[Dict[str, str]]:
    """A dedicated user with ``reading_language=fr``, isolated from `test_user`."""
    suffix = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
    email = f"e2e-test-{suffix}@test.local"
    password = "E2eTestPassword123!"

    resp = await http_client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    resp.raise_for_status()
    # /register returns a full session (access_token, refresh_token, user)
    user_id = resp.json()["user"]["id"]
    print(f"\n[e2e] created french_reader user {email} (id={user_id})")

    resp = await http_client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await http_client.patch(
        "/api/auth/me",
        json={"reading_language": "fr"},
        headers=headers,
    )
    resp.raise_for_status()
    assert resp.json()["reading_language"] == "fr"

    try:
        yield headers
    finally:
        await _teardown_user(http_client, user_id)


@pytest.mark.e2e
async def test_instagram_reel_translated_for_french_reader(
    http_client: httpx.AsyncClient,
    french_reader_headers: Dict[str, str],
) -> None:
    # 1. Ingest the English Instagram Reel.
    resp = await http_client.post(
        "/api/media/ingest-url",
        json={"url": INSTAGRAM_REEL_URL},
        headers=french_reader_headers,
    )
    resp.raise_for_status()
    media_item_id = resp.json()["media_item_id"]
    print(f"\n[e2e] ingested Instagram reel {media_item_id} ({INSTAGRAM_REEL_URL})")

    body = await poll_until(
        client=http_client,
        url=f"/api/media/{media_item_id}",
        headers=french_reader_headers,
        predicate=lambda b: b.get("media_item", {}).get("status")
        in ("ready_for_artifacts", "failed", "cancelled"),
        timeout_s=60,
        interval_s=3,
    )
    media_status = body.get("media_item", {}).get("status")
    assert media_status == "ready_for_artifacts", (
        f"ingestion stayed in {media_status}: {body}"
    )

    # 2. Ask for a summary. Nothing is waited on: the generation reads the
    # original English transcript and the reading language travels in the prompt
    # (task-398), so this must not sit behind a transcript translation. The tight
    # timeout is the point of the test -- a regression that reintroduces the
    # translate-first pipeline would blow it.
    resp = await http_client.post(
        "/api/artifacts",
        json={
            "scope": "media",
            "scope_id": media_item_id,
            "artifact_type": "summary_short",
        },
        headers=french_reader_headers,
        timeout=25.0,
    )
    resp.raise_for_status()
    created = resp.json()
    artifact_id = created["artifact_id"]

    artifact = await poll_until(
        client=http_client,
        url=f"/api/artifacts/{artifact_id}",
        headers=french_reader_headers,
        predicate=lambda b: b.get("status") in ("ready", "failed"),
        timeout_s=120,
        interval_s=3,
    )
    assert artifact.get("status") == "ready", (
        f"artifact stayed in {artifact.get('status')}: {artifact}"
    )

    resp = await http_client.get(
        f"/api/artifacts/{artifact_id}/content", headers=french_reader_headers
    )
    resp.raise_for_status()
    envelope = resp.json()["content"]

    # The corpus was the ORIGINAL transcript: the snapshot names the English text,
    # not a `.translated.fr.` object.
    source = envelope["sources"][0]
    assert source["language"] == "en", envelope["sources"]
    assert ".translated." not in (source["transcript_s3_key"] or ""), source

    # ...and the summary itself is in French, from the prompt alone.
    summary = envelope["content"]
    summary_text = " ".join(
        [summary["headline"], summary["takeaway"], *summary["key_points"]]
    )
    assert detect(summary_text) == "fr", summary_text

    # 3. The reader's full text is a separate, non-blocking path. The first call is
    # a cache miss: the original English text comes back immediately with the
    # translation reserved and dispatched (task-203). A synchronous translation
    # here would sail past API Gateway's hard 30 s integration timeout.
    resp = await http_client.get(
        f"/api/media/{media_item_id}/raw-content",
        headers=french_reader_headers,
        timeout=12.0,
    )
    resp.raise_for_status()
    raw_body = resp.json()
    assert raw_body["content"].strip(), "raw transcript is empty"

    def _translated(body: Dict[str, Any]) -> bool:
        translation = body.get("translation") or {}
        return bool(translation.get("is_translated")) or (
            translation.get("translation_status") == "failed"
        )

    raw_body = await poll_until(
        client=http_client,
        url=f"/api/media/{media_item_id}/raw-content",
        headers=french_reader_headers,
        predicate=_translated,
        timeout_s=120,
        interval_s=3,
    )
    raw_translation = raw_body.get("translation") or {}
    assert raw_translation.get("is_translated") is True, raw_translation
    assert raw_translation.get("detected_language") == "en", raw_translation
    assert raw_translation.get("target_language") == "fr", raw_translation
    assert raw_translation.get("translated_from") == "en", raw_translation
    assert detect(raw_body["content"]) == "fr", raw_body["content"][:200]
