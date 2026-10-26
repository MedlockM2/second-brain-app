"""Notes artifact generator.

Model: the shared ``llm_config.LLM_MODEL`` (task-439), like every other type.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel, Field, ValidationError, field_validator

from media_summarizer.core.models.artifact_options import ArtifactOptions
from media_summarizer.core.services import llm_corpus as corpus


class NotesValidationError(Exception):
    """Raised when the model output does not match the canonical notes schema."""


class NotesQuote(BaseModel):
    """A verbatim quote and the source it came from.

    ``source_ref`` is mandatory here and optional everywhere else: a quote is
    literal text, so its origin is objectively defined and checkable. A concept or
    key point legitimately draws on several sources, and demanding a reference
    there would only make the model invent one.
    """

    text: str
    source_ref: str

    @field_validator("text", "source_ref")
    @classmethod
    def _non_empty_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must be non-empty")
        return normalized


class NotesConcept(BaseModel):
    term: str
    explanation: str
    # Kept, and framed in the prompt instead of dropped. The measurement that put
    # it in question — 8 concepts out of 8 marked `core` on the surf course
    # (task-316 §3.3) — is a calibration failure, not a design failure: the prompt
    # asked for one of two words without ever saying what separates them. The
    # mobile badge that renders it stays as it is.
    importance: str

    @field_validator("term", "explanation", "importance")
    @classmethod
    def _non_empty_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must be non-empty")
        return normalized

    @field_validator("importance")
    @classmethod
    def _valid_importance(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"core", "supporting"}:
            raise ValueError("importance must be 'core' or 'supporting'")
        return normalized


class NotesGlossaryItem(BaseModel):
    term: str
    definition: str

    @field_validator("term", "definition")
    @classmethod
    def _non_empty_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must be non-empty")
        return normalized


class NotesContent(BaseModel):
    title: str
    # Optional: empty when the sources do not set a scene (who, what, why).
    context: str = ""
    objectives: List[str]
    concepts: List[NotesConcept]
    key_points: List[str]
    # Optional: empty when no passage is worth quoting.
    notable_quotes: List[NotesQuote] = Field(default_factory=list)
    action_items: List[str]
    glossary: List[NotesGlossaryItem]

    @field_validator("title")
    @classmethod
    def _non_empty_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("title must be non-empty")
        return normalized

    @field_validator("context")
    @classmethod
    def _normalized_context(cls, value: str) -> str:
        return value.strip()

    @field_validator("objectives", "key_points", "action_items")
    @classmethod
    def _non_empty_text_list(cls, items: List[str]) -> List[str]:
        normalized = []
        for item in items:
            if not isinstance(item, str):
                raise ValueError("list entries must be strings")
            cleaned = item.strip()
            if not cleaned:
                raise ValueError("list entries must be non-empty")
            normalized.append(cleaned)
        return normalized


class NotesGenerator:
    """Generator for structured study/review notes from a transcript."""

    @property
    def artifact_type_value(self) -> str:
        return "notes"

    def build_prompt(
        self,
        sources: Sequence[Dict[str, Any]],
        *,
        language: Optional[str] = None,
        options: ArtifactOptions,
    ) -> str:
        # Notes take a focus only: their length is set by the material, section by
        # section, and they hold no question to count or to pitch.
        focus = corpus.focus_instruction(
            options.focus,
            kind="set of notes",
            unit_plural="entries",
            absent_in='"context"',
        )
        optional_sections = corpus.empty_section_instruction(
            'Every section is optional: leave "context" empty when the sources do '
            'not set the scene, "objectives" empty when the sources do not teach '
            'anything to achieve, "concepts" empty when they explain no notion, '
            '"notable_quotes" empty when no passage is worth quoting rather than '
            'quoting for the sake of it, "action_items" empty when they prescribe '
            'nothing, and "glossary" empty when they introduce no term.'
        )
        importance_rule = (
            "- `importance` is either `core` or `supporting`, and the two are not "
            "interchangeable: mark a concept `core` when a reader cannot use the "
            "material at all without it, and `supporting` when it is context, a "
            "refinement, an example or a name worth recognising. Expect a minority "
            "of `core` — on most sources one or two concepts out of five. If "
            "everything is `core`, nothing is, and the distinction has told the "
            "reader nothing."
        )
        instructions = f"""You produce a structured study/review notes artifact from everything above.

Rules:
- {corpus.language_instruction(language)}
- Output STRICT JSON only. No markdown. No commentary. No code fences.
- Keep the structure stable for client rendering.
- Focus on learning/review value, not a generic summary.
- Build one set of notes across all the sources, not one section per source.
- Avoid sponsor/ad content unless it is central to the source material.
{corpus.coverage_instruction("entry", "entries", fields='"concepts" and "key_points"')}
{corpus.source_balance_instruction("entry", "entries")}
- "context": 2-3 sentences setting the stage (who, what, why).
- "notable_quotes": copy verbatim only the passages that carry the material
  themselves, and never quote a passage that a key point or a concept already states.
{corpus.source_ref_instruction(required=True)}
{optional_sections}
- Every string must be concise and useful.
{importance_rule}
{corpus.transcript_markers_instruction()}
{corpus.dated_facts_instruction()}
{corpus.subject_matter_instruction(verbatim_exception=True)}
{corpus.title_instruction("set of notes")}{focus}

Return JSON with this exact schema:
{{
  "title": "A short specific title",
  "context": "2-3 sentences setting the stage",
  "objectives": ["..."],
  "concepts": [
    {{
      "term": "...",
      "explanation": "...",
      "importance": "core"
    }}
  ],
  "key_points": ["..."],
  "notable_quotes": [{{"text": "Quote copied verbatim", "source_ref": "[S1]"}}],
  "action_items": ["..."],
  "glossary": [
    {{
      "term": "...",
      "definition": "..."
    }}
  ]
}}
"""
        return corpus.build_prompt(sources, instructions)

    def response_format_schema(self) -> Optional[Dict[str, Any]]:
        return None

    def unwrap_structured_response(self, content: str) -> str:
        return content

    def validate(self, content: str) -> Dict[str, Any]:
        from media_summarizer.workers.artifact_generator.worker import _strip_code_fences

        try:
            parsed = json.loads(_strip_code_fences(content))
        except json.JSONDecodeError as exc:
            raise NotesValidationError(f"notes output is not valid JSON: {exc}") from exc

        if not isinstance(parsed, dict):
            raise NotesValidationError("notes output must be a JSON object")

        try:
            validated = NotesContent.model_validate(parsed)
        except ValidationError as exc:
            raise NotesValidationError(f"notes output schema validation failed: {exc}") from exc

        return validated.model_dump()

    def build_artifact_content(
        self,
        validated: Any,
        *,
        body: Dict[str, Any],
    ) -> Dict[str, Any]:
        return validated
