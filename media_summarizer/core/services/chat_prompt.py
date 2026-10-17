"""The prompt of a chat turn and its context budget (task-462).

One module for the API, which accepts or refuses a turn, and the worker, which
builds the request (task-463): the budget the API checks is computed by the same
rule as the one the worker's real messages are held to, so a turn the API accepted
cannot be refused by the worker, and the reverse.

**Layout** (task-430 README §11.2, Decision point 7). Nothing goes before the
corpus. The first message is exactly what an artifact sends -- ``llm_corpus``'s
preamble, the tagged corpus, then the instructions -- with the chat's instructions
in place of an artifact type's, so the corpus stays a stable, cacheable prefix
shared with the artifacts of the same content. Then the history, each turn as a
``user`` question and an ``assistant`` answer, then the new question. No
retrieval of passages, no summary of the history, no silent truncation: a turn
that does not fit is refused, never cut.

**Ceilings** are explicit parameters (Decision point 8): the question's
server-side size guard, the turns of a conversation, one turn in
flight per account, and the context budget. The output ceiling is not a chat
parameter: the chat keeps ``LLM_MAX_COMPLETION_TOKENS`` of ``llm_config`` (owner
decision of 2026-10-10); how long an answer is, is said in the instructions.
"""

from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

from media_summarizer.core.models.chat import (
    ChatAssistantMessage,
    ChatConversation,
    ChatTurnStatus,
    ChatUserMessage,
)
from media_summarizer.core.services import llm_corpus
from media_summarizer.core.services.llm_client import LlmMessage

#: Server-only guard against oversized questions, not a composer limit (task-503).
#: At most 256 000 UTF-8 bytes of text, leaving ample metadata room below
#: DynamoDB's 400 KiB item limit even for four-byte characters. The independent
#: context budget below still counts the question and its later history copies.
MAX_QUESTION_CHARS = 64_000

#: Turns of one conversation. The 21st is refused ``conversation_full`` and the app
#: offers a new conversation on the same scope (README §9.4).
MAX_TURNS_PER_CONVERSATION = 20

#: Input tokens above which the provider reprices the **whole** request (Luna: 2x
#: input and cache, 1.5x output). Not a slope but a step: one token over it costs as
#: much as the 272 000 before it (complement C3.2).
PRICE_STEP_INPUT_TOKENS = 272_000

#: Relative error of ``llm_corpus.estimate_tokens`` (UTF-8 bytes / 3.4): about 10 %.
ESTIMATOR_ERROR = 0.10

#: **The context budget**, in *estimated* input tokens. A turn is accepted only if
#: its estimated input stays at or under ``272 000 / 1.10``: even when the estimator
#: under-counts by its full 10 %, the real input stays under the price step. It
#: counts what the request carries -- corpus, instructions, the full history (past
#: answers by their visible text) and the question -- and never the output ceiling,
#: which the step does not price and which would only take room from the corpus.
CONTEXT_BUDGET_TOKENS = int(PRICE_STEP_INPUT_TOKENS / (1 + ESTIMATOR_ERROR))

#: Bytes allowed per source for its corpus header (tag, title, language, dates),
#: used only when the corpus text is not in hand -- the API checks the budget from
#: the snapshot's measured ``byte_length`` without downloading the transcripts. A
#: real header is well under it (a 120-character title and two dates are ~200 bytes
#: at the very most), so the API's estimate is never below the worker's.
CORPUS_HEADER_BYTES_PER_SOURCE = 256

# Fixed text around the corpus, in llm_corpus.build_prompt.
_CORPUS_FRAME_BYTES = len(
    (
        f"{llm_corpus.PROMPT_PREAMBLE}\n===== SOURCES =====\n"
        "\n===== END OF SOURCES =====\n\n"
    ).encode("utf-8")
)


def chat_instructions(language: Optional[str]) -> str:
    """What the model is asked to do, after the corpus and before the history.

    The shared fragments of ``llm_corpus`` go in as they are (README §11.2): they
    are the quality lessons of task-316, and ``source_ref_instruction(required=True)``
    is the one that makes a cited answer checkable. The chat has no JSON output, so
    the first lines say what plays the role of that ``source_ref`` here: the tag
    written right after what it supports.
    """
    return "\n".join(
        [
            "You are answering questions about the sources above, in a conversation. "
            "The questions follow these instructions, after the earlier turns of the "
            "conversation if there are any.",
            "- The sources are the starting point, not the limit. Think the question "
            "through: reason from what the sources say, draw out what follows from it, "
            "and bring in your own knowledge when it helps answer, explain, correct or "
            "extend them. Never stop at \"the sources do not say\" when the question can "
            "be answered by reasoning or by what is generally known.",
            "- Keep the two apart for the reader. Every statement drawn from a source "
            'carries that source\'s tag right after it, e.g. "[S2]"; that tag is the '
            '"source_ref" of the rule below. A statement drawn from several sources '
            "carries each of their tags. Reasoning and knowledge that do not come from "
            "a source carry no tag, and where it matters, say in passing that they go "
            "beyond the sources. Never put a tag on something the source does not say.",
            llm_corpus.source_ref_instruction(required=True),
            "- Keep an answer to a few short paragraphs unless the question asks for "
            "more detail, a list or a longer explanation.",
            llm_corpus.subject_matter_instruction(),
            llm_corpus.dated_facts_instruction(),
            llm_corpus.transcript_markers_instruction(),
            f"- {llm_corpus.language_instruction(language)}",
        ]
    )


def history_turns(messages: Sequence[object]) -> List[Tuple[str, str]]:
    """The earlier turns as ``(question, answer)``, in order.

    A turn enters the history by the text its answer showed: completed, or
    interrupted with the part that was produced. A turn that failed with no text,
    or one still running, has no answer to show, and its question alone would put
    two user messages in a row with nothing to say about the first -- it is left out.
    """
    questions = {
        message.turn_index: message.text
        for message in messages
        if isinstance(message, ChatUserMessage)
    }
    turns: List[Tuple[str, str]] = []
    for message in messages:
        if not isinstance(message, ChatAssistantMessage) or not message.text:
            continue
        if message.status not in (ChatTurnStatus.COMPLETED, ChatTurnStatus.INTERRUPTED):
            continue
        question = questions.get(message.turn_index)
        if question is not None:
            turns.append((question, message.text))
    return turns


def build_messages(
    *,
    corpus_sources: Sequence[dict],
    language: Optional[str],
    history: Sequence[Tuple[str, str]],
    question: str,
) -> List[LlmMessage]:
    """The messages of one turn: corpus and instructions, history, question.

    ``corpus_sources`` are the downloaded sources in snapshot order, readable ones
    only (``llm_corpus.download_transcripts``), so their ``[Sk]`` tags are the
    snapshot's refs.
    """
    messages: List[LlmMessage] = [
        {
            "role": "user",
            "content": llm_corpus.build_prompt(corpus_sources, chat_instructions(language)),
        }
    ]
    for past_question, past_answer in history:
        messages.append({"role": "user", "content": past_question})
        messages.append({"role": "assistant", "content": past_answer})
    messages.append({"role": "user", "content": question})
    return messages


def _text_bytes(text: str) -> int:
    return len(text.encode("utf-8"))


def estimate_input_tokens(messages: Sequence[LlmMessage]) -> int:
    """**The budget rule**: estimated tokens of everything the request carries.

    The worker applies it to the messages it is about to send.
    """
    return llm_corpus.estimate_tokens(
        sum(_text_bytes(message.get("content") or "") for message in messages)
    )


def estimate_turn_input_tokens(
    *,
    conversation: ChatConversation,
    history: Sequence[Tuple[str, str]],
    question: str,
) -> int:
    """The same rule, from the snapshot instead of the downloaded corpus.

    What the API checks before accepting a turn. The corpus bytes are those the
    corpus ceiling was measured on at opening (transcript plus description, per
    source), plus a header allowance per source and the fixed frame; instructions,
    history and question are counted exactly. It errs on the high side of
    :func:`estimate_input_tokens`, never below it.
    """
    readable = [
        source for source in conversation.source_snapshot.sources if not source.excluded
    ]
    corpus_bytes = sum(int(source.byte_length or 0) for source in readable)
    corpus_bytes += CORPUS_HEADER_BYTES_PER_SOURCE * len(readable) + _CORPUS_FRAME_BYTES
    # The description note is added by build_prompt only when a source has a
    # description; counted always, since the snapshot does not say.
    corpus_bytes += _text_bytes(llm_corpus.source_description_instruction()) + 2
    total = corpus_bytes + _text_bytes(chat_instructions(conversation.language))
    total += sum(_text_bytes(q) + _text_bytes(a) for q, a in history)
    total += _text_bytes(question)
    return llm_corpus.estimate_tokens(total)


def fits_context_budget(estimated_tokens: int) -> bool:
    return estimated_tokens <= CONTEXT_BUDGET_TOKENS


def prompt_cache_key(conversation: ChatConversation) -> str:
    """The key an artifact over the same content uses (README §11.3)."""
    return llm_corpus.prompt_cache_key(
        scope=conversation.scope.value,
        content_scope_id=conversation.content_scope_id or conversation.scope_id,
        transcript_s3_keys=[
            source.transcript_s3_key or ""
            for source in conversation.source_snapshot.sources
            if not source.excluded
        ],
    )
