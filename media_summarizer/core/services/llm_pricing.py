"""What a generation actually cost, from the provider's own usage block.

Observability, not enforcement: what bounds a user's spend is their minute
allowance, and a generation over a single item costs zero minutes because its LLM
cost is already inside what the item cost to ingest. This figure lands in the
monthly `cost_eur_estimated` counter so the owner can compare the consumption
model's assumptions with the real invoice.

Prices are catalogue USD per 1M tokens, Standard processing, converted at the same
`USD_EUR` rate as the task-65 pricing benchmark so both numbers stay comparable. A
model that is not listed falls back to the most expensive entry: overestimating is
the safe direction for a figure the owner reads to decide whether the model holds.
Only the model of `llm_config` is listed (task-439): a row for a model nothing
calls is a price nobody re-checks.
"""

from __future__ import annotations

from typing import Dict, NamedTuple

USD_EUR = 0.86


class _Rates(NamedTuple):
    """USD per 1M tokens. Each input token is billed at exactly one input rate."""

    input: float
    cached_input: float
    cache_write: float
    output: float


class _ModelPrices(NamedTuple):
    short: _Rates
    long: _Rates
    #: Above this many prompt tokens the *whole* request is billed at ``long``.
    long_context_threshold: int


# model prefix -> prices.
# gpt-6-luna: https://developers.openai.com/api/docs/pricing, Standard tier, read
# 2026-10-10. "Short context: <=272K input tokens. Long context: >272K input
# tokens", the long rates applying to the full request (model page:
# https://developers.openai.com/api/docs/models/gpt-6-luna). Cache writes are
# billed at 1.25x the uncached input rate on GPT-5.6 and later, instead of it, not
# on top (https://developers.openai.com/api/docs/guides/prompt-caching).
# Artifacts stay under the threshold -- MAX_FOLDER_CORPUS_TOKENS is 120 000 -- so
# the long row is there for a request that is not an artifact, such as the chat.
_MODEL_PRICES: Dict[str, _ModelPrices] = {
    "gpt-6-luna": _ModelPrices(
        short=_Rates(input=0.10, cached_input=0.01, cache_write=0.125, output=0.50),
        long=_Rates(input=0.20, cached_input=0.02, cache_write=0.25, output=0.75),
        long_context_threshold=272_000,
    ),
}
_FALLBACK_PRICES = max(_MODEL_PRICES.values(), key=lambda prices: prices.long.input)


def _prices_for(model: str) -> _ModelPrices:
    normalized = (model or "").lower()
    for prefix, prices in _MODEL_PRICES.items():
        if normalized.startswith(prefix):
            return prices
    return _FALLBACK_PRICES


def estimate_llm_cost_eur(
    *,
    model: str,
    prompt_tokens: int,
    cached_tokens: int,
    completion_tokens: int,
    cache_write_tokens: int = 0,
) -> float:
    """Cost in EUR of one call, cached and cache-written tokens at their own rates.

    ``cached_tokens`` and ``cache_write_tokens`` are subsets of ``prompt_tokens`` in
    OpenAI's usage block, so the uncached part is what remains -- counting them in
    full on top would inflate the cost of exactly the requests the corpus-first
    prompt layout is designed to make cheap.
    """
    prices = _prices_for(model)
    rates = (
        prices.long
        if prompt_tokens > prices.long_context_threshold
        else prices.short
    )
    billed_cached = max(0, min(cached_tokens, prompt_tokens))
    billed_written = max(0, min(cache_write_tokens, prompt_tokens - billed_cached))
    billed_fresh = max(0, prompt_tokens - billed_cached - billed_written)
    usd = (
        billed_fresh * rates.input
        + billed_cached * rates.cached_input
        + billed_written * rates.cache_write
        + max(0, completion_tokens) * rates.output
    ) / 1_000_000
    return round(usd * USD_EUR, 6)
