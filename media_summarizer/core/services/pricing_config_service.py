"""
Pricing configuration service with in-memory cache (TTL ~5 minutes).

Reads all pricing/quota parameters from DynamoDB pricing_config table.
On first load, seeds default values derived from the validated consumption model
(docs/research/task-287-consumption-model/README.md, owner_decision: ok) for the
commercial tiers, and from the beta budget decision (R.1–R.2 of
docs/research/pricing-challenge/README.md, implementation rules of
docs/research/task-547-beta-budget-control/README.md) for the beta formula, its
exchange rate and its barème (`beta_access`, `eur_usd_rate`, `provider_tariffs`).

The service is stateless-safe: multiple processes will each maintain their own
cache but share the same DynamoDB source of truth. Changes propagate within
the TTL window (300 seconds by default).
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Cache TTL in seconds (5 minutes)
_CACHE_TTL_SECONDS = 300

# In-memory cache
_cache: Dict[str, Any] = {}
_cache_loaded_at: float = 0.0


# ---------------------------------------------------------------------------
# Default values from the validated consumption model of task-287
# (docs/research/task-287-consumption-model/README.md, owner_decision: ok).
#
# One unit is metered: the *minute*. A minute is a minute of media we pay a
# transcription provider to process, and everything that is not transcription is
# unlimited. Ingestion paths that trigger no per-item provider fee (articles, web
# pages, TikTok, single-item AI generations) cost zero minutes by design — see
# §3.1 of the benchmark for the conversion table. An Instagram photo post is no
# longer one of them since task-384: its images go through the document parser we
# pay for, so they are billed at `document_pages_per_minute` like any page.
#
# The beta formula (`beta_access`) is not a minute allowance: it is a budget in
# euros of provider usage, held and settled by `beta_budget` (task-548), and it
# reads none of the minute figures below.
#
# These are seeded into DynamoDB if the table is empty on first read.
# ---------------------------------------------------------------------------

DEFAULT_PRICING_CONFIG: Dict[str, Any] = {
    # --- Tier definitions ---
    # `minutes_per_month` is the *only* allowance a tier carries, and it doubles as
    # safety-net layer 1: at 0.00664 EUR of provider budget per minute, the worst
    # case a subscriber can cost is minutes x 0.00664, which each tier's
    # `revenue_net_eur` covers several times over (0.40 / 1.99 / 4.78 EUR).
    "tiers": {
        "text_only": {
            "id": "text_only",
            "name": "Reader",
            "name_fr": "Lecteur",
            "price_ttc_eur": 3.00,
            "revenue_net_eur": 2.125,
            "minutes_per_month": 60,
            # A single import can never be allowed to swallow a whole allowance in
            # one go; above this the submission is refused as too long, which is
            # not something an upgrade fixes.
            "max_minutes_per_item": 60,
        },
        "mix": {
            "id": "mix",
            "name": "Mix",
            "name_fr": "Mix",
            "price_ttc_eur": 5.00,
            "revenue_net_eur": 3.542,
            "minutes_per_month": 300,
            "max_minutes_per_item": 180,
        },
        "audio_heavy": {
            "id": "audio_heavy",
            "name": "Audio-Heavy",
            "name_fr": "Audio-Heavy",
            "price_ttc_eur": 9.00,
            "revenue_net_eur": 6.375,
            # 720, not 900: at 900 minutes the worst case (0.006642 x 900 = 5.98 EUR)
            # eats 94% of the 6.375 EUR net, which leaves nothing for infrastructure.
            "minutes_per_month": 720,
            "max_minutes_per_item": 240,
        },
    },
    # --- Free trial ---
    "free_trial": {
        "enabled": True,
        "duration_days": 30,
        "tier": "mix",
        "minutes_per_month": 300,
        "max_minutes_per_item": 180,
    },
    # --- Beta formula (task-429, budget of task-548) ---
    # Nothing is purchasable while the app is in beta, and the app hides every
    # route to the paywall. The beta is its own formula, **independent of the
    # commercial `tiers` and of any subscription**: every account, whatever its
    # creation date and whatever it has bought, gets a budget of provider usage
    # valued at normal prices (owner decision R.1–R.2 of
    # docs/research/pricing-challenge/README.md, and the implementation rules of
    # docs/research/task-547-beta-budget-control/README.md). Read by
    # `beta_budget.beta_formula`, and by nothing that reads `tiers`.
    #
    # `enabled` is True in the defaults rather than per environment because the
    # beta is a state of the *product*, not of a deployment: an environment whose
    # table has no block must behave like the beta. The end date is unknown until
    # the owner announces the start, hence `None`; it is filled in the table
    # afterwards, which needs no build and no deploy (see docs/V1_LAUNCH_PLAN.md
    # § « Phase de beta »). A stored block holding only `enabled` and `ends_at` gets
    # every other key below from `_merge_defaults`.
    #
    # When the beta ends, this block and every line that reads it are **deleted**,
    # here and in `pricing_config-dev` / `pricing_config-prod` — a key dropped from
    # the defaults survives in the table, see `_merge_defaults`.
    "beta_access": {
        "enabled": True,
        # ISO 8601 instant the beta closes, or None while it is open-ended.
        "ends_at": None,
        # 5 EUR of provider usage per account and per month, outside fixed
        # infrastructure. Considered permissive enough by the owner: not to be
        # re-calibrated here. Strings, not floats, so money is read exactly.
        "monthly_budget_eur": "5",
        # Fixed by the decision and the only behaviour implemented: the calendar
        # month in UTC, each month starting from the full budget with nothing
        # carried over. Stated so the block describes the formula whole; another
        # value is logged (`beta_budget.config_unsupported`) and ignored.
        "period": "calendar_month_utc",
        "carry_over": False,
        # Above these one item is refused as `item_too_large`, which is not a
        # budget refusal; when the measurement fails, the limit itself is
        # reserved (rules 2-3 of the task-547 decision).
        "item_limits": {
            "audio_minutes": 240,
            "document_pages": 100,
            "spreadsheet_sheets": 30,
        },
        # The output a full-text translation is reserved for, as a multiple of its
        # input tokens (rule 11, as amended on 2026-10-28): a reservation estimate,
        # never sent to the provider. The real output is settled on (rule 8).
        "translation_output_ratio": "1.5",
        # Text an import will produce, estimated from its upstream measure, to
        # reserve its blurb and its translation with it (rule 10).
        "estimated_text_tokens_per_audio_minute": 200,
        "estimated_text_tokens_per_document_page": 700,
        # Backstop: an attempt still open this long after its admission has no
        # worker left to close it, and its hold goes back to the tester. Above the
        # longest legitimate import chain (docs/BETA_BUDGET_CONTROL.md §3.5).
        "hold_expiry_minutes": 360,
    },
    # --- Operator spend protection (TASK-566) ---
    # Owner decision: docs/research/task-563-provider-capacity-fairness-operator-safety/
    # README.md, Owner Validation points 3 and 4. A safety ceiling on what the
    # operator pays the providers in a calendar month UTC, all accounts together —
    # deliveries, failures and the bounds of calls still open — not a target
    # budget: raise it by hand in `pricing_config-<env>` as accounts grow. The
    # loss reserves bound the spend of calls that delivered nothing, open
    # commitments included, inside that ceiling. The 50 % and 80 % alerts are the
    # CloudWatch alarms of `operator_control_alerts.tf`. Runbook:
    # docs/OPERATOR_SPEND_CONTROL.md. Strings, so money is read exactly.
    "operator_control": {
        "monthly_cap_eur": "500",
        "loss_reserve_daily_eur": "5",
        "loss_reserve_monthly_eur": "50",
        # Drift alert: operator spend of the month divided by the accounts active
        # in it. About 0.6 EUR in the nominal 1 000 DAU scenario of the benchmark
        # (§3.2); above 2 EUR, each account costs several times what it should.
        "per_active_account_alert_eur": "2",
    },
    # --- EUR/USD exchange rate of the beta budget (rule 15 of task-547) ---
    # ECB reference rate, USD per EUR, with its publication date. Converts the
    # dollar tariffs below into the euro budget, and nothing else: no call is ever
    # refused because of it. Each reservation records the rate it was computed
    # with. Seeded with the 26 October 2026 rate; kept up to date every working day
    # by TASK-559, which leaves the last rate in place when the ECB file fails.
    "eur_usd_rate": {
        "usd_per_eur": "1.1188",
        "published_on": "2026-10-26",
        "source": "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    },
    # --- Versioned barème of the beta budget (R.2.1, task-547 decision) ---
    # Normal public prices in USD, promotional credits and free volumes ignored:
    # an LLM call paid by a sign-up credit consumes the same budget as after it
    # runs out. Read 2026-10-26 (Deepgram, LlamaParse, Unstructured, OpenAI) and
    # 2026-10-27/28 (Apify programmes, X API). Bump `version` with any price: every
    # reservation records the version it was bounded with.
    "provider_tariffs": {
        "version": "2026-10-28",
        "currency": "USD",
        # Nova-3 pre-recorded, monolingual batch, per minute, billed to the second.
        "deepgram": {"nova-3": {"per_minute": "0.0043"}},
        # Cost-effective mode: 3 provider credits per page at 1.25 USD per 1 000
        # credits; a spreadsheet sheet is 1 credit.
        "llamaparse": {"page": {"usd": "0.00375"}, "sheet": {"usd": "0.00125"}},
        # The fallback parser, a distinct attempt with its own reservation, priced
        # on the same count as the upstream measure (pages, or the sheets of a
        # spreadsheet) at its page price.
        "unstructured": {"page": {"usd": "0.015"}, "sheet": {"usd": "0.015"}},
        # USD per 1M tokens, Standard processing. Above the threshold the long rows
        # apply to the whole request. A model with no cache-write price bills
        # written tokens as fresh input. Only `llm_config.LLM_MODEL` is listed:
        # every LLM call uses it, the full-text translation included (task-556).
        "openai": {
            "gpt-6-luna": {
                "long_context_threshold": 272000,
                "short": {"input": "0.10", "cached_input": "0.01", "cache_write": "0.125", "output": "0.50"},
                "long": {"input": "0.20", "cached_input": "0.02", "cache_write": "0.25", "output": "0.75"},
            },
        },
        # Price of one result, Free plan (the dearest listed), keyed by the default
        # actor ids of `apify_adapter.py`. An actor configured with another id must
        # get its own price here before it is reserved.
        "apify": {
            "starvibe~youtube-video-transcript": {"per_result": "0.005"},
            "scrape-creators~best-tiktok-transcripts-scraper": {"per_result": "0.001"},
            "apify~instagram-reel-scraper": {"per_result": "0.0026"},
            "apify~instagram-post-scraper": {"per_result": "0.0027"},
        },
        # One post read through the X API v2; author and media expansions are not
        # billed (measured 2026-10-28).
        "x_api": {"post": {"usd": "0.005"}},
    },
    # --- How each metered event converted into minutes (benchmark §3.1) ---
    # Nothing is debited from these any more: since task-549 every paid call is
    # held and settled in euros by the beta budget. Only the pricing endpoint
    # still exposes them, and TASK-550 removes them from that contract.
    "unit_conversion": {
        # Transcribed audio and video are charged their real length, rounded up.
        "min_minutes_per_transcription": 1,
        # A video whose captions we buy costs one flat provider fee, so it costs
        # one minute whatever its length.
        "captions_minutes": 1,
        # LlamaParse bills at least one credit per page: five pages of document are
        # worth about one minute of transcription budget.
        "document_pages_per_minute": 5,
        # A text file (.txt, .md, .rtf) costs nothing: it has no pages to price,
        # and no provider is called to read it -- the worker decodes the bytes
        # itself (task-380). Zero is the *value*, not a missing figure, and it is
        # stated here rather than assumed by the worker so the paywall can print
        # it next to the four other conversions. Same rule as an article: what is
        # charged is a provider call, and there is none.
        "text_file_minutes": 0,
        # A generation over a folder is the only AI action that scales with the
        # amount of content behind it. Single-item generations are free.
        "folder_sources_per_minute": 5,
    },
    # --- Usage gauge (what the app shows before the wall) ---
    "usage_gauge": {
        "warning_threshold_pct": 80,
    },
    # --- Shared provider pools (benchmark §3.3) ---
    # The daily burst guards that sat here were deleted with task-548: the beta
    # budget bounds what one account can spend, so a log-only daily signal no
    # longer protects anything (rule 16 of the task-547 decision).
    # Apify credit and LlamaParse credits are *fixed monthly pools shared by every
    # user*, so no per-user cap can protect them. Capacities are expressed in the
    # unit each provider bills, counted across all users, and the percentages are
    # where the owner is warned and where new spend on that provider stops.
    "provider_pools": {
        "apify": {
            "plan": "free",
            "monthly_capacity": 1160,
            "capacity_unit": "results",
            "alarm_pct": 60,
            "stop_pct": 90,
        },
        "llamaparse": {
            "plan": "free",
            "monthly_capacity": 10000,
            "capacity_unit": "pages",
            "alarm_pct": 60,
            "stop_pct": 90,
        },
    },
    # --- Provider configuration ---
    "providers": {
        "transcription": {
            "provider": "deepgram",
            "model": "nova-3",
            # Descriptive only: what a transcription costs is the barème of
            # `provider_tariffs`, valued by the beta budget (task-549).
        },
        # One model for the chat, every artifact, the blurbs and their
        # re-translation (task-439), and the full-text translation (task-556).
        # Descriptive only: the model called is `llm_config.LLM_MODEL`, its
        # price lives in `llm_pricing`.
        "llm": {
            "model": "gpt-6-luna",
            "processing": "standard",
        },
        "document_parsing": {
            "primary": "llamaparse",
            "fallback": "unstructured",
        },
        "search": {
            "provider": "algolia",
            "plan": "build_free",
        },
    },
    # --- Revenue model ---
    "revenue_model": {
        "store_commission_pct": 15.0,
        "tva_pct": 20.0,
        "distribution_channel": "app_store_play_store",
    },
    # --- Infrastructure cost baseline (informational) ---
    "infra_cost_baseline": {
        "total_monthly_eur_at_100u": 14.6,
        "per_user_eur_at_100u": 0.145,
        "components": {
            "ec2_t4g_small": 10.55,
            "algolia_build_free": 0.0,
            "aws_misc": 4.0,
        },
    },
}


def _is_cache_valid() -> bool:
    """Check if the in-memory cache is still within TTL."""
    if not _cache:
        return False
    return (time.time() - _cache_loaded_at) < _CACHE_TTL_SECONDS


def _merge_defaults(defaults: Any, stored: Any) -> Any:
    """Overlay the stored config on the defaults, leaf by leaf.

    Seeding only happens when the table is *empty*, so a key added to the
    defaults after the first seed would otherwise never reach an environment
    whose table is already populated — and a quota whose key is missing reads as
    0, i.e. no limit at all. That is how `minutes_per_month` would have been
    silently inert on dev, and it is what gives a `beta_access` block stored with
    only `enabled` and `ends_at` the budget keys of the defaults.

    A stored value always wins, including a stored 0: the point is to fill gaps,
    never to override what the owner has set in DynamoDB.

    The reverse does not happen on its own: a top-level key *removed* from the
    defaults stays in the table until it is deleted there. That is why dropping a
    section here comes with a matching delete on `pricing_config-<env>`.
    """
    if isinstance(defaults, dict) and isinstance(stored, dict):
        merged = dict(defaults)
        for key, value in stored.items():
            merged[key] = (
                _merge_defaults(defaults[key], value) if key in defaults else value
            )
        return merged
    return stored


async def _load_from_db() -> Dict[str, Any]:
    """Load config from DynamoDB. Seed defaults if table is empty."""
    from media_summarizer.utils import pricing_config_db

    try:
        config = await pricing_config_db.get_all_config()
    except Exception as e:
        logger.warning(
            "Failed to read pricing config from DynamoDB, using defaults: %s", e
        )
        return dict(DEFAULT_PRICING_CONFIG)

    if not config:
        # Seed defaults
        logger.info("Pricing config table is empty, seeding default values.")
        try:
            await pricing_config_db.put_config_batch(DEFAULT_PRICING_CONFIG)
        except Exception as e:
            logger.error("Failed to seed pricing config defaults: %s", e)
        return dict(DEFAULT_PRICING_CONFIG)

    return _merge_defaults(DEFAULT_PRICING_CONFIG, config)


async def get_pricing_config() -> Dict[str, Any]:
    """
    Return the full pricing config dict from cache or DynamoDB.
    Cache is refreshed every 5 minutes.
    """
    global _cache, _cache_loaded_at

    if _is_cache_valid():
        return _cache

    config = await _load_from_db()
    _cache = config
    _cache_loaded_at = time.time()
    return _cache


async def get_config_value(key: str, default: Any = None) -> Any:
    """Get a single pricing config value by key."""
    config = await get_pricing_config()
    return config.get(key, default)


async def update_config_values(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update one or more pricing config values.
    Writes to DynamoDB and invalidates cache immediately.
    Returns the full updated config.
    """
    global _cache, _cache_loaded_at
    from media_summarizer.utils import pricing_config_db

    await pricing_config_db.put_config_batch(updates)

    # Invalidate cache to force reload on next access
    _cache_loaded_at = 0.0

    # Reload and return
    return await get_pricing_config()


def invalidate_cache() -> None:
    """Force cache invalidation (useful for testing)."""
    global _cache, _cache_loaded_at
    _cache = {}
    _cache_loaded_at = 0.0
