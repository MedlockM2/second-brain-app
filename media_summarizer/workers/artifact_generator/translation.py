"""Translate a stored artifact into another language, instead of regenerating it.

A reading language change asks for the same artifact in another language. Producing
it from the transcript again costs the whole corpus in input tokens for a text of a
few hundred words; producing it from the finished artifact costs that text twice
(in, then out). That is the whole of task-395, and this module is the part that
does it: one payload in, the same payload in another language out.

Two constraints shape it, and both come from the artifacts themselves:

- **the structure is not re-derived, it is preserved.** Only the string leaves are
  sent to the model, and the answer is grafted back onto the original object. So a
  quiz keeps its option order and its ``correct_answer`` label, a flashcard keeps
  its ``source_ref``, and a card count keeps matching the number of cards — none of
  which a model rewriting the whole JSON can be trusted with. It also means the
  generators' validators are not involved at all: their input shape is not always
  the stored shape (``quiz`` shuffles its options after validating), so
  re-validating a translated payload would reject a perfectly good artifact.
- **a dropped segment must be structurally impossible.** The schema handed to the
  provider names every segment as a required property, so Structured Outputs
  guarantees a value for each. A missing field would silently leave an artifact
  half in the old language, which is worse than a failure — a failure is retried.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Sequence, Tuple

from media_summarizer.core.services.transcript_translation import V1_LANGUAGE_NAMES

#: Keys whose value is machinery, not prose. ``label`` and ``correct_answer`` are the
#: two halves of one identity (a quiz answer names an option by its label, so
#: translating either breaks the pairing), ``importance`` is a closed vocabulary the
#: mobile client switches on, and ``source_ref`` quotes the transcript's own words —
#: the transcript is not translated, so neither is the pointer into it.
NON_TRANSLATABLE_KEYS = frozenset({"label", "correct_answer", "importance", "source_ref"})

#: Prefix of the segment ids exchanged with the model. Short on purpose: the ids are
#: repeated twice in the payload (input map and schema), and they carry no meaning.
_SEGMENT_PREFIX = "s"

Segment = Tuple[Tuple[Any, ...], str]


def collect_segments(content: Any) -> List[Segment]:
    """Every translatable string of an artifact payload, with the path that holds it.

    The path is what allows the answer to be grafted back exactly where it came
    from, so nothing in the structure has to be described to the model.
    """
    segments: List[Segment] = []
    _walk(content, (), segments)
    return segments


def _walk(node: Any, path: Tuple[Any, ...], segments: List[Segment]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key in NON_TRANSLATABLE_KEYS:
                continue
            _walk(value, (*path, key), segments)
        return
    if isinstance(node, list):
        for index, value in enumerate(node):
            _walk(value, (*path, index), segments)
        return
    # Numbers and booleans are counts and flags; whitespace carries no language.
    if isinstance(node, str) and node.strip():
        segments.append((path, node))


def apply_segments(
    content: Any,
    *,
    segments: Sequence[Segment],
    translated: Dict[str, str],
) -> Any:
    """Rebuild the payload with the translated strings in place of the originals.

    A deep copy is grafted rather than mutated: the source envelope stays readable
    for the log line and for the failure path.
    """
    rebuilt = json.loads(json.dumps(content))
    for index, (path, original) in enumerate(segments):
        value = translated.get(segment_id(index))
        if not isinstance(value, str) or not value.strip():
            # Structured Outputs made the property required, so this is not the
            # normal way an incomplete answer arrives — but a payload that kept one
            # untranslated string is still readable, whereas raising would throw the
            # whole translation away.
            value = original
        _assign(rebuilt, path, value)
    return rebuilt


def _assign(node: Any, path: Tuple[Any, ...], value: str) -> None:
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value


def segment_id(index: int) -> str:
    return f"{_SEGMENT_PREFIX}{index + 1}"


def build_prompt(
    *,
    segments: Sequence[Segment],
    source_language: str,
    target_language: str,
    artifact_type: str,
) -> str:
    """The instruction sent with the segments.

    It says what the text *is* — the fields of a study artifact — because a key point
    and a flashcard answer are not translated the same way, and the model cannot see
    the structure they came from.
    """
    source_name = V1_LANGUAGE_NAMES.get(source_language, source_language)
    target_name = V1_LANGUAGE_NAMES.get(target_language, target_language)
    payload = json.dumps(
        {segment_id(index): text for index, (_, text) in enumerate(segments)},
        ensure_ascii=False,
        indent=2,
    )
    return (
        f"You are translating the text fields of a study artifact of type "
        f"'{artifact_type}' from {source_name} to {target_name}.\n"
        "\n"
        "Rules:\n"
        "- Return one translation per input key, under the exact same key.\n"
        "- Translate each segment on its own. Do not merge, split, reorder, "
        "summarize or expand them, and do not add anything that is not in the "
        "source segment.\n"
        "- Stay consistent: a term translated one way in a segment is translated "
        "the same way in every other segment.\n"
        "- Keep the length and the register of the source. These texts are shown in "
        "fixed layouts, so a translation twice as long does not fit.\n"
        "- Keep proper nouns, brand names, code identifiers and quoted titles in "
        "their original form. Keep any markdown, timestamps and speaker labels "
        f"exactly as they are, and keep numbers unchanged.\n"
        f"- A segment already written in {target_name} is returned unchanged.\n"
        "\n"
        "Segments:\n"
        f"{payload}"
    )


def build_response_format(segment_count: int) -> Dict[str, Any]:
    """A strict schema with one required property per segment.

    Built per call rather than declared once: that is what makes "the answer has
    exactly the segments the artifact has" a property of the request instead of a
    check after the fact.
    """
    properties = {
        segment_id(index): {"type": "string"} for index in range(segment_count)
    }
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "artifact_translation",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": properties,
                "required": list(properties.keys()),
                "additionalProperties": False,
            },
        },
    }


def read_translated_segments(raw_content: str) -> Dict[str, str]:
    """Parse the model's answer into a segment id -> text map."""
    parsed = json.loads(raw_content)
    if not isinstance(parsed, dict):
        raise ValueError("artifact_translation_not_an_object")
    return {
        key: value for key, value in parsed.items() if isinstance(value, str)
    }
