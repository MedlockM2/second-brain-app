"""The audio track of a video embedded in a web page, fetched with yt-dlp.

yt-dlp knows the players pages embed -- Vimeo, Dailymotion, Wistia, Loom, plain
files, HLS streams -- and assembles an HLS audio rendition without ffmpeg. Its
duration and title are read *before* anything is downloaded, so a video over the
ceiling costs one metadata request, not its whole file.

YouTube is the exception: from a Lambda address YouTube answers every request
with "Sign in to confirm you're not a bot" (measured for task-309, the reason the
YouTube worker runs on Apify alone). An embedded YouTube video therefore fails
here like any other unreachable video, and the page is stored without it.

Vimeo and Welcome to the Jungle answered a Lambda in eu-west-3 normally on
2026-11-10: config, HLS playlists and segments all 200, and yt-dlp downloaded
the 74 s audio of a Vimeo video in full.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from dataclasses import dataclass
from typing import Any, Dict, Optional

from media_summarizer.core.web_page import EmbeddedVideo
from media_summarizer.utils.http_user_agent import BROWSER_USER_AGENT

logger = logging.getLogger(__name__)

#: One video longer than this is left out: a page is read for what it says, and
#: an hour-long webinar is a media of its own.
MAX_VIDEO_DURATION_SECONDS = int(os.environ.get("WEB_PAGE_MAX_VIDEO_DURATION_SECONDS", "1800"))
MAX_VIDEO_AUDIO_BYTES = int(os.environ.get("WEB_PAGE_MAX_VIDEO_AUDIO_BYTES", str(200 * 1024 * 1024)))

_CONTENT_TYPES = {
    "mp4": "audio/mp4",
    "m4a": "audio/mp4",
    "webm": "audio/webm",
    "mp3": "audio/mpeg",
    "ogg": "audio/ogg",
    "opus": "audio/ogg",
    "aac": "audio/aac",
    "mov": "video/quicktime",
}


class VideoAudioUnavailable(Exception):
    """This video's audio cannot be had; the page goes on without it."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class VideoAudio:
    file_path: str
    content_type: str
    duration_seconds: Optional[float]
    title: Optional[str]
    thumbnail_url: Optional[str]
    provider: str


def _options(*, referer: str, out_dir: str, download: bool) -> Dict[str, Any]:
    return {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "cachedir": False,
        "skip_download": not download,
        # Audio alone when the player offers it (Vimeo's HLS has a separate audio
        # rendition); the smallest full file otherwise, since its audio is all
        # Deepgram reads.
        "format": "bestaudio/worst",
        "outtmpl": os.path.join(out_dir, "%(id)s.%(ext)s"),
        "max_filesize": MAX_VIDEO_AUDIO_BYTES,
        "socket_timeout": 20,
        "retries": 2,
        "fragment_retries": 3,
        "concurrent_fragment_downloads": 4,
        # Private and domain-restricted embeds check where they are played from.
        "http_headers": {"User-Agent": BROWSER_USER_AGENT, "Referer": referer},
    }


def _thumbnail(info: Dict[str, Any]) -> Optional[str]:
    url = info.get("thumbnail")
    if isinstance(url, str) and url.startswith("https://"):
        return url
    for item in reversed(info.get("thumbnails") or []):
        candidate = item.get("url") if isinstance(item, dict) else None
        if isinstance(candidate, str) and candidate.startswith("https://"):
            return candidate
    return None


def _fetch_sync(video: EmbeddedVideo, *, referer: str, out_dir: str) -> VideoAudio:
    import yt_dlp

    try:
        with yt_dlp.YoutubeDL(_options(referer=referer, out_dir=out_dir, download=False)) as ydl:
            info = ydl.extract_info(video.url, download=False)
    except Exception as exc:  # noqa: BLE001 - yt-dlp raises a zoo of types
        raise VideoAudioUnavailable(f"metadata_failed:{type(exc).__name__}") from exc
    if not isinstance(info, dict):
        raise VideoAudioUnavailable("metadata_empty")

    duration = info.get("duration")
    duration_seconds = float(duration) if isinstance(duration, (int, float)) and duration > 0 else None
    if duration_seconds and duration_seconds > MAX_VIDEO_DURATION_SECONDS:
        raise VideoAudioUnavailable("too_long")
    if info.get("is_live"):
        raise VideoAudioUnavailable("live_stream")

    try:
        with yt_dlp.YoutubeDL(_options(referer=referer, out_dir=out_dir, download=True)) as ydl:
            downloaded = ydl.process_ie_result(info, download=True)
    except Exception as exc:  # noqa: BLE001
        raise VideoAudioUnavailable(f"download_failed:{type(exc).__name__}") from exc

    path = None
    for item in (downloaded or {}).get("requested_downloads") or []:
        if isinstance(item, dict) and item.get("filepath"):
            path = item["filepath"]
    if not path or not os.path.exists(path) or os.path.getsize(path) == 0:
        raise VideoAudioUnavailable("download_missing")

    ext = os.path.splitext(path)[1].lstrip(".").lower()
    return VideoAudio(
        file_path=path,
        content_type=_CONTENT_TYPES.get(ext, "application/octet-stream"),
        duration_seconds=duration_seconds,
        title=(info.get("title") or "").strip() or None,
        thumbnail_url=_thumbnail(info),
        provider=video.provider,
    )


async def fetch_video_audio(video: EmbeddedVideo, *, referer: str) -> VideoAudio:
    """Download one video's audio into a fresh temporary directory under ``/tmp``.

    The caller deletes the file once it is uploaded (``os.remove``) -- Lambda keeps
    ``/tmp`` across warm invocations.
    """
    out_dir = tempfile.mkdtemp(prefix="web-video-")
    return await asyncio.to_thread(_fetch_sync, video, referer=referer, out_dir=out_dir)
