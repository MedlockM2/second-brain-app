"""The one LLM choice every generation path reads (task-439).

Owner decision of 2026-10-10: OpenAI ``gpt-6-luna``, Standard processing, for the
chat, every artifact type, the triage blurb and the re-translation of an existing
artifact. It replaces the per-type split of task-72 (``gpt-5-nano`` for the short
summary, ``gpt-5.4-nano`` elsewhere) and widens the choice task-430 had made for the
chat alone. On 2026-10-27 the owner extended it to the translation of a media's
full text for the reader (task-556, ``core/services/transcript_translation.py``),
which had its own GPT-5-nano setting from task-189 until then. There is
deliberately one variable, not one per type: a per-type knob is how the split this
module removes came to exist.

The full-text translation reads ``LLM_MODEL`` and ``LLM_REASONING_EFFORT`` but not
``LLM_MAX_OUTPUT_TOKENS``: a translation is as long as its source, so a fixed
32 000 would cut every long one. It sends no output ceiling at all: only the model's
maximum applies, and 1.5 times its input is what the beta budget reserves for it
(task-547 rule 11, amended 2026-10-28).

What is *not* governed here: the speech synthesis of the podcast (task-386).

Parameters, from https://developers.openai.com/api/docs/models/gpt-6-luna
(read 2026-10-10; on the re-read of 2026-10-28 for task-556 the reasoning values,
the 128 000 output maximum and the absence of sampling parameters were unchanged):

- **Reasoning.** ``reasoning.effort`` accepts ``none``, ``low``, ``medium``,
  ``high``, ``xhigh`` and ``max``; ``medium`` is the provider default. It is sent
  explicitly so a change of provider default cannot silently change quality or cost.
  ``medium`` is also what the task-72 models ran at, since nothing set it before.
  Tools (the chat's web search, task-614) are taken at any effort on the Responses
  API; it was Chat Completions that took them only at ``none``.
- **Output ceiling.** ``max_output_tokens``, which counts "visible output tokens
  and reasoning tokens" (Responses API reference, read 2026-11-06). 128 000 tokens is the model's maximum, reasoning tokens
  included. The default here is 32 000, for the chat and every artifact alike. The
  reasoning guide asks for "at least 25,000 tokens for reasoning and outputs", below
  which an answer comes back incomplete after its input and reasoning are billed.
  The 429 help article (read 2026-10-10) warns that "unnecessarily large
  output-token allowances can also contribute to token-rate errors" and to "avoid
  setting a much larger allowance than the request needs". 32 000 clears the first
  with a margin, stays far above any artifact (a detailed summary of 25 sources is a
  few thousand tokens plus its reasoning), and keeps what each call weighs on the
  tokens-per-minute limit shared by the chat and the artifacts low.
- **Sampling.** The model page documents no ``temperature`` or ``top_p``, and the
  reasoning models before it rejected ``temperature``. Neither is sent.
- **Structured Outputs and prompt caching** are both listed as supported, so every
  generator that has a JSON schema sends it, and ``prompt_cache_key`` is still sent
  (on GPT-5.6 and later it keys cache accounting rather than routing).

**The endpoint** (task-613, owner decision of 2026-11-06): every call goes to the
Responses API, ``POST /v1/responses``, read on 2026-11-06 at
https://developers.openai.com/api/reference/resources/responses/methods/create and
https://developers.openai.com/api/reference/resources/responses/streaming-events.
There is no other path to the provider. Every request carries ``store: false``:
the conversation is rebuilt from DynamoDB on each turn (``chat_prompt``), never
from a stored response, and nothing has to be kept for 30 days on OpenAI's side.

The model stays configurable for an incident, never per type. Whatever replaces
Luna must support Structured Outputs (``text.format``) and ``reasoning.effort`` on
the Responses API, and must get a row in ``llm_pricing`` -- otherwise its cost reads
as Luna's.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-6-luna")
LLM_REASONING_EFFORT = os.environ.get("LLM_REASONING_EFFORT", "medium")
LLM_MAX_OUTPUT_TOKENS = int(os.environ.get("LLM_MAX_OUTPUT_TOKENS", "32000"))

#: The model's own limits, from the model page (re-read 2026-10-28): a 1 050 000
#: token window, of which at most 128 000 are output, reasoning included. The beta
#: budget (task-549) reads them: no output is reserved beyond the first, and a
#: request whose measured input is above the second is refused as too large rather
#: than sent. Overridable with the model, never per call.
LLM_MODEL_MAX_OUTPUT_TOKENS = int(os.environ.get("LLM_MODEL_MAX_OUTPUT_TOKENS", "128000"))
LLM_MODEL_MAX_INPUT_TOKENS = int(os.environ.get("LLM_MODEL_MAX_INPUT_TOKENS", "922000"))


def response_parameters(
    *, max_output_tokens: Optional[int] = LLM_MAX_OUTPUT_TOKENS
) -> Dict[str, Any]:
    """The Responses API request fields that follow from the model choice.

    Callers add what is theirs -- ``input``, ``text.format``, ``prompt_cache_key``
    -- on top. The chat and the artifacts read the shared ceiling; the full-text
    translation passes ``max_output_tokens=None`` and is bounded by the model's own
    maximum only. ``store: false`` is here so that no call can forget it.
    """
    parameters: Dict[str, Any] = {
        "model": LLM_MODEL,
        "reasoning": {"effort": LLM_REASONING_EFFORT},
        "store": False,
    }
    if max_output_tokens is not None:
        parameters["max_output_tokens"] = max_output_tokens
    return parameters
