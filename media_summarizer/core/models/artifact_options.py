"""The customisation options of a generation, as the generators read them (task-531).

A request carries them in ``parameters``, next to the ``language`` the service sets
from the reading language. They are part of what ``artifact_id`` hashes, so two
different option sets over the same sources are two artifacts — and an option left
at its default is **never** stored: ``artifact_service.resolve_request_options``
drops it before the hash, which is what keeps a request at the defaults on the very
id a request with no options computes.

This module holds the vocabulary and its defaults only. Which option a type
accepts, and the refusal of everything else, is a request rule and lives with the
other request rules in ``artifact_service``.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, Optional


class SummaryLength(str, Enum):
    """How deep a ``summary_short`` goes. Same schema at every length."""

    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class ItemCount(str, Enum):
    """How many questions or cards, relative to what the material carries."""

    FEWER = "fewer"
    STANDARD = "standard"
    MORE = "more"


class Difficulty(str, Enum):
    """How demanding the questions or cards are."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


#: The keys, as they travel in ``parameters``.
LENGTH = "length"
COUNT = "count"
DIFFICULTY = "difficulty"
FOCUS = "focus"

#: The value each enumerated option takes when the request does not set it. Also
#: the value that is dropped before the hash when the request does set it.
DEFAULT_LENGTH = SummaryLength.SHORT
DEFAULT_COUNT = ItemCount.STANDARD
DEFAULT_DIFFICULTY = Difficulty.MEDIUM

#: Ceiling of ``focus`` once its whitespace is cleaned. A topic to favour, not a
#: second prompt: 300 characters is several sentences, and the text is pasted into
#: four prompts' worth of instructions.
MAX_FOCUS_CHARS = 300


def clean_focus(value: str) -> str:
    """Trim the focus and collapse every run of whitespace, newlines included, to one space.

    Collapsing is what keeps the text on a single line between its two markers in
    the prompt (``llm_corpus.focus_instruction``), and what makes two requests that
    only differ by their spacing the same artifact.
    """
    return " ".join(value.split())


@dataclass(frozen=True)
class ArtifactOptions:
    """The options of one generation, defaults filled in.

    Built by the worker from the stored ``parameters``, which never hold a default:
    an absent key reads as its default here, so the generators see one value per
    option whatever the request sent.
    """

    length: SummaryLength = DEFAULT_LENGTH
    count: ItemCount = DEFAULT_COUNT
    difficulty: Difficulty = DEFAULT_DIFFICULTY
    #: ``None`` when the request asked for no particular topic.
    focus: Optional[str] = None

    @classmethod
    def from_parameters(cls, parameters: Mapping[str, Any]) -> "ArtifactOptions":
        """Read the options off an entry's ``parameters``.

        The values were validated by the request, so a value outside the enum here
        means a corrupted message, and the ``ValueError`` it raises fails the
        generation rather than silently generating something else.
        """
        focus = parameters.get(FOCUS)
        return cls(
            length=SummaryLength(parameters.get(LENGTH) or DEFAULT_LENGTH),
            count=ItemCount(parameters.get(COUNT) or DEFAULT_COUNT),
            difficulty=Difficulty(parameters.get(DIFFICULTY) or DEFAULT_DIFFICULTY),
            focus=(clean_focus(focus) or None) if isinstance(focus, str) else None,
        )
