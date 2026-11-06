"""The text of a shared conversation: one line per message, in selection order.

A WhatsApp multi-selection reaches the share extension as one item per message,
with nothing but the message body -- no author, no time (checked on dev on
2026-11-06). Its texts and its voice notes are saved as a single media whose full
text reads as the exchange it came from:

    - Oui pour ça que je voulais me barrer samedi soir
    - 🎤 (0:42) Bon je t'explique, en fait samedi…
    - Mdrrr c'est quoi ça

Each message opens with a dash on its own line; the lines of a multi-line message
are indented under it so they stay part of that message. A voice note is marked
with ``VOICE_MARKER`` and its duration, then its transcript; a voice note Deepgram
found nothing to transcribe in keeps its marker and duration alone, at its place.

The result is Markdown list syntax on purpose: the reader on mobile and web already
draws it as a list (``hasStructuredMarkdown``), and the transcript normalizer keeps
Markdown verbatim, so no client knows anything about conversations.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Iterable, List, Sequence, Tuple

from media_summarizer.core.media_ingestion.domain import (
    ConversationMessage,
    ConversationMessageKind,
)

#: Opens the line of a voice note, before its duration.
VOICE_MARKER = "🎤"

#: Most messages one shared conversation may hold.
MAX_CONVERSATION_MESSAGES = 50

_BLANK_RUN_RE = re.compile(r"\n\s*\n+")


def message_lines(text: str) -> List[str]:
    """The non-empty lines of a message, each stripped."""
    unified = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    return [line.strip() for line in unified.split("\n") if line.strip()]


def _item(first: str, rest: Sequence[str]) -> str:
    return "\n".join([f"- {first}".rstrip(), *(f"  {line}" for line in rest)])


def format_duration(seconds: float) -> str:
    """``m:ss`` for a voice note, rounded to the second."""
    total = max(0, int(round(seconds or 0)))
    return f"{total // 60}:{total % 60:02d}"


def format_text_message(text: str) -> str:
    lines = message_lines(text)
    if not lines:
        return ""
    return _item(lines[0], lines[1:])


def format_voice_message(transcript: str, duration_seconds: float) -> str:
    """A voice note's line: marker, duration, then its transcript (paragraphs folded)."""
    head = f"{VOICE_MARKER} ({format_duration(duration_seconds)})"
    lines = message_lines(_BLANK_RUN_RE.sub("\n", transcript or ""))
    if not lines:
        return _item(head, [])
    return _item(f"{head} {lines[0]}", lines[1:])


def format_conversation(items: Iterable[str]) -> str:
    return "\n".join(item for item in items if item)


def voice_budget_part(position: int) -> str:
    """Budget part of the voice note at ``position`` (1-based among the voice notes).

    Each voice note is its own Deepgram request, admitted and settled on its own
    under the import, like the images of a carousel are parsed one by one.
    """
    return f"voice{position}"


def voice_parts(messages: Sequence[ConversationMessage]) -> List[Tuple[str, int]]:
    """``(budget part, probed duration)`` of every voice note, in order."""
    voices = [m for m in messages if m.kind == ConversationMessageKind.VOICE]
    return [
        (voice_budget_part(position), int(voice.duration_seconds or 0))
        for position, voice in enumerate(voices, start=1)
    ]


def conversation_content_hash(parts: Sequence[Tuple[str, str]]) -> str:
    """Identity of a selection: each message's kind and its text or audio fingerprint."""
    return hashlib.sha256(
        json.dumps([list(part) for part in parts], ensure_ascii=False).encode("utf-8")
    ).hexdigest()
