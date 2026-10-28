"""
The beta budget control (task-548): one budget per account and calendar month,
held before every paid provider call and settled on what the call really cost.

Owner decision: ``docs/research/task-547-beta-budget-control/README.md``, section
« Décision de l'owner : règles d'implémentation » (validated 2026-10-27), on top of
R.1–R.2 of ``docs/research/pricing-challenge/README.md``. Schema, transitions,
concurrency and period rules: ``docs/BETA_BUDGET_CONTROL.md``.

What this module owns, and nothing else does:

1. **The beta formula** — the attribution path of the beta. It is read from the
   ``beta_access`` block of ``pricing_config`` and from nothing else: not the
   commercial ``tiers``, not a subscription row, not the free trial. 5 EUR per
   account and per calendar month UTC, no carry-over, every current feature.
2. **The period** — the calendar month UTC. A month's counter is created with the
   full budget the first time something is reserved in it; nothing of the previous
   month is carried over, and a result arriving after midnight settles in the month
   it was reserved in.
3. **The valuation** — the versioned barème ``provider_tariffs`` (USD, normal
   prices, promotions and free volumes ignored), converted with the ECB rate of
   ``eur_usd_rate``. Each reservation records the tariff version and the rate it was
   computed with, and its settlement converts at that same rate.
4. **The bounds** — the maximal cost of a paid call, from the metadata measured
   before it (duration, pages, sheets, tokens). Above a per-item limit the call is
   refused as ``item_too_large``; when the measurement fails the per-item ceiling is
   reserved instead (rules 1–3).
5. **The ledger transitions** — :func:`reserve` (one conditional write),
   :func:`claim_send`, :func:`settle`, :func:`release`, :func:`release_expired` and
   :func:`charge_reuse`.

What it does not do: decide, per provider path, when to reserve, claim, settle or
release — that routing is ``core/services/budget_guard.py`` (task-549) — expose the
state to the apps (TASK-550, TASK-551), report on it (TASK-552), or refresh the
exchange rate (TASK-559).

**The tester's capacity and the provider's bill are two different ledgers.** A
release hands the hold back to the tester; it never erases the spend: when the
request may have left, its cost — measured, or the reserved bound when no metric
came back — is added to the month's ``operator_spend`` and stays there. Nothing in
this module lowers ``consumed`` or ``operator_spend``, and there is no manual reset
of a tester's capacity during the beta (rule 14).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import ROUND_CEILING, Decimal, InvalidOperation
from math import ceil
from typing import Any, Dict, List, Mapping, Optional, Sequence

from media_summarizer.core.models.beta_budget import (
    ATTEMPT_SK_PREFIX,
    NANO_EUR_PER_EUR,
    Admission,
    AttemptStatus,
    BudgetAttempt,
    BudgetRefusal,
    CloseOutcome,
    Component,
    CostBasis,
    ItemLimitExceeded,
    MeasuredCost,
    PeriodCounter,
    ProviderKind,
    ReleaseReason,
    ReservationLine,
)
from media_summarizer.core.services import pricing_config_service
from media_summarizer.core.services.llm_config import LLM_MODEL_MAX_OUTPUT_TOKENS
from media_summarizer.utils import beta_budget_db
from media_summarizer.utils.beta_budget_db import (
    AVAILABLE,
    CONSUMED,
    HELD,
    OPERATOR_SPEND,
    RELEASED,
    LedgerUnavailableError,
)
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

#: The only period the decision allows: the calendar month in UTC.
CALENDAR_MONTH_UTC = "calendar_month_utc"

#: How long ledger items outlive their end: thirteen months, so a full year of
#: months can be compared by TASK-552, and far beyond the 14-day retention of any
#: queue or dead-letter queue that could replay an operation. Open attempts carry no
#: TTL at all (docs/BETA_BUDGET_CONTROL.md §5).
LEDGER_RETENTION_DAYS = 400

DEEPGRAM_MODEL = "nova-3"


class ItemTooLargeError(Exception):
    """One item is above its per-item limit (rule 2). Not a budget refusal."""

    def __init__(self, exceeded: ItemLimitExceeded) -> None:
        super().__init__(f"{exceeded.quantity} {exceeded.measured} > {exceeded.limit}")
        self.exceeded = exceeded


# ---------------------------------------------------------------------------
# Configuration: the beta formula, the exchange rate, the barème
# ---------------------------------------------------------------------------


def _defaults(key: str) -> Mapping[str, Any]:
    value = pricing_config_service.DEFAULT_PRICING_CONFIG.get(key, {})
    return value if isinstance(value, Mapping) else {}


def _decimal(value: Any) -> Optional[Decimal]:
    """A configuration figure as an exact decimal, or None when it is not one.

    Read through ``str`` so a figure the owner typed as a JSON number is taken at
    its decimal face value (0.0043), never at its binary approximation.
    """
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    return parsed if parsed.is_finite() else None


def _positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _parse_instant(raw: Any) -> Optional[datetime]:
    """An ISO 8601 instant from the configuration, as an aware UTC datetime, or None.

    ``Z`` is spelled out as an offset because ``fromisoformat`` only learned to read
    it in 3.11 and the code is checked for 3.10, and a value with no offset is read
    as UTC: this field is typed by hand, and ``2027-01-15`` is a shape an owner writes.
    """
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None
    if text[-1] in ("Z", "z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class ItemLimits:
    """Above these, one item is refused whatever the budget (rule 2)."""

    audio_minutes: int
    document_pages: int
    spreadsheet_sheets: int


@dataclass(frozen=True)
class BetaFormula:
    """The beta formula, as the configuration states it."""

    enabled: bool
    ends_at: Optional[datetime]
    monthly_budget_nano_eur: int
    item_limits: ItemLimits
    #: Output ceiling of a full-text translation, as a multiple of its input (rule 11).
    translation_output_ratio: Decimal
    #: Upstream estimates of the text a medium produces (rule 10).
    text_tokens_per_audio_minute: int
    text_tokens_per_document_page: int
    #: Backstop after which an attempt still open is released (§3.5 of the doc).
    hold_expiry: timedelta

    def is_open(self, now: datetime) -> bool:
        """Whether the beta formula is in force at ``now``.

        Open while ``enabled`` says so and the end date it may carry is still ahead.
        An end date that cannot be read leaves the beta **open** (logged when the
        configuration is read): a typo must not take every tester's budget away in
        silence.
        """
        if not self.enabled:
            return False
        return self.ends_at is None or now < self.ends_at


def beta_formula(config: Mapping[str, Any]) -> BetaFormula:
    """Read the beta formula from the pricing configuration.

    The period and the carry-over are stated in the configuration so it describes
    the formula whole, but the decision fixes them: the calendar month UTC and no
    carry-over are the only behaviour implemented. Any other stored value is logged
    and ignored rather than half-applied.
    """
    block = config.get("beta_access", {}) or {}
    defaults = _defaults("beta_access")

    raw_end = block.get("ends_at")
    ends_at = _parse_instant(raw_end)
    if raw_end not in (None, "") and ends_at is None:
        # Event name kept from task-429: docs/V1_LAUNCH_PLAN.md tells the owner to
        # look for it after writing the end date.
        logger.error("quota.beta_access_ends_at_unreadable", extra={"ends_at": str(raw_end)})

    if block.get("period", CALENDAR_MONTH_UTC) != CALENDAR_MONTH_UTC or block.get("carry_over", False) is not False:
        logger.error(
            "beta_budget.config_unsupported",
            extra={"period": str(block.get("period")), "carry_over": str(block.get("carry_over"))},
        )

    budget_eur = _decimal(block.get("monthly_budget_eur"))
    if budget_eur is None or budget_eur < 0:
        logger.error("beta_budget.budget_unreadable", extra={"value": str(block.get("monthly_budget_eur"))})
        budget_eur = _decimal(defaults.get("monthly_budget_eur")) or Decimal(5)

    limits = block.get("item_limits", {}) or {}
    default_limits = defaults.get("item_limits", {}) or {}
    ratio = _decimal(block.get("translation_output_ratio"))
    if ratio is None or ratio <= 0:
        ratio = _decimal(defaults.get("translation_output_ratio")) or Decimal("1.5")

    return BetaFormula(
        enabled=bool(block.get("enabled")),
        ends_at=ends_at,
        monthly_budget_nano_eur=int(budget_eur * NANO_EUR_PER_EUR),
        item_limits=ItemLimits(
            audio_minutes=_positive_int(limits.get("audio_minutes"), int(default_limits.get("audio_minutes", 240))),
            document_pages=_positive_int(limits.get("document_pages"), int(default_limits.get("document_pages", 100))),
            spreadsheet_sheets=_positive_int(
                limits.get("spreadsheet_sheets"), int(default_limits.get("spreadsheet_sheets", 30))
            ),
        ),
        translation_output_ratio=ratio,
        text_tokens_per_audio_minute=_positive_int(
            block.get("estimated_text_tokens_per_audio_minute"),
            int(defaults.get("estimated_text_tokens_per_audio_minute", 200)),
        ),
        text_tokens_per_document_page=_positive_int(
            block.get("estimated_text_tokens_per_document_page"),
            int(defaults.get("estimated_text_tokens_per_document_page", 700)),
        ),
        hold_expiry=timedelta(
            minutes=_positive_int(block.get("hold_expiry_minutes"), int(defaults.get("hold_expiry_minutes", 360)))
        ),
    )


@dataclass(frozen=True)
class FxRate:
    """USD per EUR, as published by the ECB on ``published_on``."""

    usd_per_eur: Decimal
    published_on: str


def fx_rate(config: Mapping[str, Any]) -> FxRate:
    """The current EUR/USD rate (rule 15).

    Kept up to date by TASK-559, which leaves the last rate in place when the ECB
    file cannot be read. The rate only converts dollar tariffs into the euro budget:
    an unusable stored value falls back to the seeded rate, loudly, and never
    refuses a call.
    """
    block = config.get("eur_usd_rate", {}) or {}
    rate = _decimal(block.get("usd_per_eur"))
    published_on = str(block.get("published_on") or "")
    if rate is None or rate <= 0 or not published_on:
        defaults = _defaults("eur_usd_rate")
        logger.error("beta_budget.fx_rate_unreadable", extra={"value": str(block)})
        rate = _decimal(defaults.get("usd_per_eur")) or Decimal("1.1188")
        published_on = str(defaults.get("published_on") or "")
    return FxRate(usd_per_eur=rate, published_on=published_on)


@dataclass(frozen=True)
class LlmRates:
    """USD per 1M tokens. Each input token is billed at exactly one input rate."""

    input: Decimal
    cached_input: Decimal
    cache_write: Decimal
    output: Decimal


def _llm_rates(raw: Mapping[str, Any]) -> LlmRates:
    fresh = _decimal(raw.get("input")) or Decimal(0)
    return LlmRates(
        input=fresh,
        cached_input=_decimal(raw.get("cached_input")) or fresh,
        # A model with no distinct cache-write price bills written tokens as fresh
        # input (R.2.1).
        cache_write=_decimal(raw.get("cache_write")) or fresh,
        output=_decimal(raw.get("output")) or Decimal(0),
    )


class Tariffs:
    """The versioned barème of ``provider_tariffs``, in USD.

    A price the barème does not list falls back to the most expensive price of the
    same family, and the gap is logged: over-reserving is the safe direction for a
    missing figure, and refusing every call of a path because one key is missing
    would turn a configuration slip into an outage.
    """

    def __init__(self, raw: Mapping[str, Any]) -> None:
        self._raw = raw
        self._defaults = _defaults("provider_tariffs")
        self.version = str(raw.get("version") or self._defaults.get("version") or "")

    def _family(self, name: str) -> Mapping[str, Any]:
        family = self._raw.get(name)
        if isinstance(family, Mapping) and family:
            return family
        fallback = self._defaults.get(name)
        return fallback if isinstance(fallback, Mapping) else {}

    def _missing(self, family: str, key: str) -> None:
        logger.error("beta_budget.tariff_missing", extra={"family": family, "key": key, "version": self.version})

    def _price(self, family: str, key: str, field_name: str) -> Decimal:
        entries = self._family(family)
        entry = entries.get(key)
        price = _decimal(entry.get(field_name)) if isinstance(entry, Mapping) else None
        if price is not None and price >= 0:
            return price
        self._missing(family, key)
        candidates = [
            _decimal(value.get(field_name)) for value in entries.values() if isinstance(value, Mapping)
        ]
        known = [candidate for candidate in candidates if candidate is not None]
        return max(known) if known else Decimal(0)

    def transcription_per_minute(self, model: str) -> Decimal:
        return self._price("deepgram", model, "per_minute")

    def document_unit_price(self, provider: str, unit: str) -> Decimal:
        return self._price(provider, unit, "usd")

    def apify_per_result(self, actor_id: str) -> Decimal:
        return self._price("apify", actor_id.strip().replace("/", "~"), "per_result")

    def x_per_post(self) -> Decimal:
        return self._price("x_api", "post", "usd")

    def llm_rates(self, model: str, input_tokens: int) -> LlmRates:
        """The rates of ``model`` for a request of ``input_tokens``.

        Matched on the longest listed prefix, so a dated snapshot name reads the
        row of its model. Above ``long_context_threshold`` the long-context row
        applies to the **whole** request.
        """
        models = self._family("openai")
        normalized = (model or "").lower()
        matches = [name for name in models if normalized.startswith(name.lower())]
        if matches:
            prices = models[max(matches, key=len)]
        else:
            self._missing("openai", model)
            prices = max(
                (value for value in models.values() if isinstance(value, Mapping)),
                key=lambda value: _llm_rates(value.get("long") or value.get("short") or {}).input,
                default={},
            )
        threshold = prices.get("long_context_threshold")
        use_long = threshold is not None and prices.get("long") and input_tokens > int(threshold)
        return _llm_rates(prices.get("long") if use_long else prices.get("short") or {})


@dataclass(frozen=True)
class PricingContext:
    """Everything a bound or a cost is computed from, read once."""

    formula: BetaFormula
    fx: FxRate
    tariffs: Tariffs


async def load_pricing_context() -> PricingContext:
    """The formula, the rate and the barème, from the cached pricing configuration."""
    config = await pricing_config_service.get_pricing_config()
    raw_tariffs = config.get("provider_tariffs", {}) or {}
    return PricingContext(
        formula=beta_formula(config),
        fx=fx_rate(config),
        tariffs=Tariffs(raw_tariffs if isinstance(raw_tariffs, Mapping) else {}),
    )


# ---------------------------------------------------------------------------
# Period and money
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(now: Optional[datetime]) -> datetime:
    return (now or _now()).astimezone(timezone.utc)


def _iso(instant: datetime) -> str:
    """Every instant of the ledger in one fixed shape, so text order is time order.

    The open-attempts index and the lease condition compare these strings: UTC, and
    the microseconds always written, never a shorter form for a round second.
    """
    return instant.astimezone(timezone.utc).isoformat(timespec="microseconds")


def period_key(now: datetime) -> str:
    """The counter key of the month ``now`` falls in: ``YYYY-MM`` in UTC."""
    return now.astimezone(timezone.utc).strftime("%Y-%m")


def next_period_start(now: datetime) -> datetime:
    """First instant of the next calendar month UTC: where the budget renews."""
    now = now.astimezone(timezone.utc)
    return now.replace(
        year=now.year + 1 if now.month == 12 else now.year,
        month=1 if now.month == 12 else now.month + 1,
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def _ttl_epoch(instant: datetime) -> int:
    return int((instant + timedelta(days=LEDGER_RETENTION_DAYS)).timestamp())


def usd_to_nano_eur(usd: Decimal, usd_per_eur: Decimal) -> int:
    """A USD amount in nano-euros, rounded **up** to the next nano-euro.

    The only rounding of the ledger, applied once per amount: a reservation never
    falls short of its exact bound, and a settled cost overstates by less than one
    nano-euro. Nothing is rounded to a minute, a page or a cent.
    """
    if usd <= 0:
        return 0
    return int((usd * NANO_EUR_PER_EUR / usd_per_eur).to_integral_value(rounding=ROUND_CEILING))


# ---------------------------------------------------------------------------
# Bounds: the maximal cost of a paid call, measured before it is made
# ---------------------------------------------------------------------------


def _bounded(measured: Optional[int], limit: int, quantity: str) -> tuple[int, bool]:
    """The quantity to reserve, and whether it is a measurement.

    A measurement above the limit refuses the item; a failed measurement reserves
    the limit itself (rule 3) and is never replaced by a provisional minimum.
    """
    if measured is None or measured <= 0:
        return limit, False
    if measured > limit:
        raise ItemTooLargeError(ItemLimitExceeded(quantity=quantity, measured=measured, limit=limit))
    return measured, True


def transcription_line(
    ctx: PricingContext,
    *,
    duration_seconds: Optional[float],
    model: str = DEEPGRAM_MODEL,
) -> ReservationLine:
    """Bound of a Deepgram transcription, from the duration measured upstream."""
    limit_minutes = ctx.formula.item_limits.audio_minutes
    if duration_seconds is None or duration_seconds <= 0:
        # The probe could not read the duration: reserve the ceiling, never a
        # provisional minute (rule 3).
        seconds, measured = limit_minutes * 60, False
    else:
        minutes = ceil(duration_seconds / 60)
        if minutes > limit_minutes:
            raise ItemTooLargeError(ItemLimitExceeded(quantity="audio_minutes", measured=minutes, limit=limit_minutes))
        seconds, measured = ceil(duration_seconds), True
    per_minute = ctx.tariffs.transcription_per_minute(model)
    return ReservationLine(
        component=Component.TRANSCRIPTION,
        kind=ProviderKind.TRANSCRIPTION,
        provider="deepgram",
        model=model,
        quantities={"seconds": seconds},
        bound_usd=Decimal(seconds) * per_minute / 60,
        measured=measured,
    )


def document_line(
    ctx: PricingContext,
    *,
    provider: str,
    unit: str,
    count: Optional[int],
    part: str = "",
) -> ReservationLine:
    """Bound of a document parse: pages (``unit="page"``) or sheets (``unit="sheet"``).

    ``provider`` is ``llamaparse`` or ``unstructured``. The Unstructured fallback is
    a later try of the same step with its own line and reservation (rule 6), never
    folded into the first. ``part`` tells apart the files of one operation parsed
    one by one (the images of a carousel).
    """
    if unit == "sheet":
        limit, quantity = ctx.formula.item_limits.spreadsheet_sheets, "spreadsheet_sheets"
    else:
        limit, quantity = ctx.formula.item_limits.document_pages, "document_pages"
    units, measured = _bounded(count, limit, quantity)
    price = ctx.tariffs.document_unit_price(provider, unit)
    return ReservationLine(
        component=Component.DOCUMENT_PARSING,
        kind=ProviderKind.DOCUMENT_PARSING,
        provider=provider,
        model=unit,
        quantities={f"{unit}s": units},
        bound_usd=Decimal(units) * price,
        measured=measured,
        part=part,
    )


def llm_bound_usd(ctx: PricingContext, *, model: str, input_tokens: int, output_tokens: int) -> Decimal:
    """Maximal cost of one LLM call of ``input_tokens`` and at most ``output_tokens``.

    Every input token is priced at the dearer of the fresh and the cache-write rate
    — writing the cache costs more than fresh input on Luna — and no cache read is
    assumed: a discount is only counted once the provider's metrics confirm it.
    """
    rates = ctx.tariffs.llm_rates(model, input_tokens)
    per_input = max(rates.input, rates.cache_write)
    return (Decimal(input_tokens) * per_input + Decimal(output_tokens) * rates.output) / Decimal(1_000_000)


def llm_line(
    ctx: PricingContext,
    *,
    component: Component,
    model: str,
    input_tokens: Optional[int],
    max_input_tokens: int,
    max_output_tokens: int,
    measured: bool = True,
) -> ReservationLine:
    """Bound of a generation, a chat turn or the automatic blurb.

    ``input_tokens`` is the complete request measured before it is sent
    (instructions, schema, corpus, history, question); unknown, the model's largest
    accepted input is reserved. The output is the ``max_completion_tokens`` the call
    sends. ``measured=False`` marks an input that is an upstream estimate rather
    than a measurement (the blurb reserved with an import, rule 10).
    """
    tokens, is_measured = _bounded(input_tokens, max_input_tokens, "input_tokens")
    return ReservationLine(
        component=component,
        kind=ProviderKind.LLM,
        provider="openai",
        model=model,
        quantities={"input_tokens": tokens, "output_tokens": max_output_tokens},
        bound_usd=llm_bound_usd(ctx, model=model, input_tokens=tokens, output_tokens=max_output_tokens),
        measured=measured and is_measured,
    )


def translation_max_completion_tokens(ctx: PricingContext, input_tokens: int) -> int:
    """``max_completion_tokens`` of a full-text translation: 1.5 × its input (rule 11).

    Sent with every translation call, and the same figure its reservation is
    bounded with, so the bound and the provider's ceiling cannot disagree. Never
    above the model's own output maximum (128 000 tokens on Luna, reasoning
    included): past about 85 300 input tokens the ratio would ask for a ceiling the
    provider refuses, so the model maximum is sent and reserved instead (task-549).
    """
    ratio_ceiling = max(1, ceil(Decimal(max(0, input_tokens)) * ctx.formula.translation_output_ratio))
    return min(ratio_ceiling, LLM_MODEL_MAX_OUTPUT_TOKENS)


def translation_line(
    ctx: PricingContext,
    *,
    model: str,
    input_tokens: int,
    measured: bool,
) -> ReservationLine:
    """Bound of a full-text translation of ``input_tokens``.

    Reserved with the import from the upstream estimate (``measured=False``, see
    :func:`estimated_text_tokens`), or later, when a translation is asked again,
    from the text measured before the call.
    """
    output = translation_max_completion_tokens(ctx, input_tokens)
    tokens = max(1, input_tokens)
    return ReservationLine(
        component=Component.TRANSLATION,
        kind=ProviderKind.LLM,
        provider="openai",
        model=model,
        quantities={"input_tokens": tokens, "output_tokens": output},
        bound_usd=llm_bound_usd(ctx, model=model, input_tokens=tokens, output_tokens=output),
        measured=measured,
    )


def estimated_text_tokens(
    ctx: PricingContext,
    *,
    duration_seconds: Optional[float] = None,
    page_count: Optional[int] = None,
) -> int:
    """Tokens of the text a medium will produce, estimated from its upstream measure.

    About 200 tokens per minute of speech and 700 per page (rule 10). The gap with
    the real text is settled on the real cost (rule 8).
    """
    if duration_seconds is not None and duration_seconds > 0:
        return ceil(Decimal(str(duration_seconds)) / 60 * ctx.formula.text_tokens_per_audio_minute)
    if page_count is not None and page_count > 0:
        return page_count * ctx.formula.text_tokens_per_document_page
    return 0


def apify_line(ctx: PricingContext, *, actor_id: str) -> ReservationLine:
    """Bound of one Apify run: the price of its single result."""
    return ReservationLine(
        component=Component.COLLECTION,
        kind=ProviderKind.APIFY,
        provider="apify",
        model=actor_id.strip().replace("/", "~"),
        quantities={"results": 1},
        bound_usd=ctx.tariffs.apify_per_result(actor_id),
    )


def x_post_line(ctx: PricingContext) -> ReservationLine:
    """Bound of one X API post read: its fixed price."""
    return ReservationLine(
        component=Component.COLLECTION,
        kind=ProviderKind.X_API,
        provider="x_api",
        model="post",
        quantities={"posts": 1},
        bound_usd=ctx.tariffs.x_per_post(),
    )


# ---------------------------------------------------------------------------
# Measured costs: what a delivered result really cost
# ---------------------------------------------------------------------------


def transcription_cost(ctx: PricingContext, *, billed_seconds: float, model: str = DEEPGRAM_MODEL) -> MeasuredCost:
    """Cost of the duration Deepgram reports, to the second, never rounded to the minute."""
    seconds = Decimal(str(max(0.0, billed_seconds)))
    return MeasuredCost(
        usd=seconds * ctx.tariffs.transcription_per_minute(model) / 60,
        usage={"seconds": ceil(seconds)},
        tariff_version=ctx.tariffs.version,
    )


def document_cost(ctx: PricingContext, *, provider: str, unit: str, count: int) -> MeasuredCost:
    """Cost of the pages or sheets the parser reports as billed."""
    units = max(0, count)
    return MeasuredCost(
        usd=Decimal(units) * ctx.tariffs.document_unit_price(provider, unit),
        usage={f"{unit}s": units},
        tariff_version=ctx.tariffs.version,
    )


def llm_cost(
    ctx: PricingContext,
    *,
    model: str,
    prompt_tokens: int,
    cached_tokens: int,
    cache_write_tokens: int,
    completion_tokens: int,
) -> MeasuredCost:
    """Cost of one call from the provider's usage block.

    Cached and cache-written tokens are subsets of ``prompt_tokens``: they replace
    the fresh rate on those tokens, they are never added on top. Reasoning tokens
    are already inside ``completion_tokens`` and are not counted twice.
    """
    prompt = max(0, prompt_tokens)
    rates = ctx.tariffs.llm_rates(model, prompt)
    cached = max(0, min(cached_tokens, prompt))
    written = max(0, min(cache_write_tokens, prompt - cached))
    fresh = prompt - cached - written
    output = max(0, completion_tokens)
    usd = (
        Decimal(fresh) * rates.input
        + Decimal(cached) * rates.cached_input
        + Decimal(written) * rates.cache_write
        + Decimal(output) * rates.output
    ) / Decimal(1_000_000)
    return MeasuredCost(
        usd=usd,
        usage={
            "prompt_tokens": prompt,
            "cached_tokens": cached,
            "cache_write_tokens": written,
            "completion_tokens": output,
        },
        tariff_version=ctx.tariffs.version,
    )


def apify_cost(ctx: PricingContext, *, actor_id: str, results: int) -> MeasuredCost:
    """Cost of the result events a run was charged."""
    count = max(0, results)
    return MeasuredCost(
        usd=Decimal(count) * ctx.tariffs.apify_per_result(actor_id),
        usage={"results": count},
        tariff_version=ctx.tariffs.version,
    )


def x_cost(ctx: PricingContext, *, posts: int) -> MeasuredCost:
    """Cost of the posts read. The API reports no per-request cost: the fixed price stands."""
    count = max(0, posts)
    return MeasuredCost(
        usd=Decimal(count) * ctx.tariffs.x_per_post(),
        usage={"posts": count},
        tariff_version=ctx.tariffs.version,
    )


# ---------------------------------------------------------------------------
# Ledger items <-> models
# ---------------------------------------------------------------------------


def step_key(component: Component, part: str = "") -> str:
    """The step part of an attempt id: the component, qualified by ``part`` if any."""
    return f"{component.value}.{part}" if part else component.value


def attempt_id(operation_id: str, component: Component, try_number: int, part: str = "") -> str:
    """Durable identity of one try of one step of an operation.

    ``operation_id`` is the logical operation — a job, an artifact generation, a
    chat turn — never a queue message: a redelivery of the same message is the same
    attempt, a new try of the same step is a new one with its own reservation.
    """
    return f"{operation_id}:{step_key(component, part)}:{try_number}"


def _int(value: Any) -> int:
    return int(value or 0)


def _optional_int(value: Any) -> Optional[int]:
    return None if value is None else int(value)


def _attempt_from_item(item: Mapping[str, Any]) -> BudgetAttempt:
    return BudgetAttempt(
        user_id=str(item["user_id"]),
        attempt_id=str(item["attempt_id"]),
        operation_id=str(item.get("operation_id", "")),
        component=str(item.get("component", "")),
        try_number=_int(item.get("try_number")),
        status=AttemptStatus(str(item["status"])),
        kind=str(item.get("kind", "")),
        provider=str(item.get("provider", "")),
        model=str(item.get("model", "")),
        period_key=str(item["period_key"]),
        reserved_nano_eur=_int(item.get("reserved_nano_eur")),
        tariff_version=str(item.get("tariff_version", "")),
        usd_per_eur=_decimal(item.get("usd_per_eur")) or Decimal(1),
        fx_published_on=str(item.get("fx_published_on", "")),
        created_at=str(item.get("created_at", "")),
        measured=bool(item.get("measured", True)),
        claimed_at=item.get("claimed_at"),
        closed_at=item.get("closed_at"),
        consumed_nano_eur=_optional_int(item.get("consumed_nano_eur")),
        operator_cost_nano_eur=_optional_int(item.get("operator_cost_nano_eur")),
        cost_basis=item.get("cost_basis"),
        release_reason=item.get("release_reason"),
    )


def _counter_from_item(user_id: str, key: str, item: Optional[Mapping[str, Any]], budget: int) -> PeriodCounter:
    if item is None:
        # Nothing reserved this month yet: the full budget, nothing carried over.
        return PeriodCounter(user_id=user_id, period_key=key, budget_nano_eur=budget, available_nano_eur=budget)
    return PeriodCounter(
        user_id=user_id,
        period_key=key,
        budget_nano_eur=_int(item.get("budget_nano_eur")),
        available_nano_eur=_int(item.get(AVAILABLE)),
        held_nano_eur=_int(item.get(HELD)),
        consumed_nano_eur=_int(item.get(CONSUMED)),
        released_nano_eur=_int(item.get(RELEASED)),
        operator_spend_nano_eur=_int(item.get(OPERATOR_SPEND)),
    )


async def _read_attempt(user_id: str, attempt: str) -> Optional[BudgetAttempt]:
    item = await beta_budget_db.get_item(user_id, beta_budget_db.attempt_sk(attempt))
    return _attempt_from_item(item) if item else None


def _log(level: int, event: str, message: str, **fields: Any) -> None:
    log_event(logger, level, event, message, **fields)


# ---------------------------------------------------------------------------
# Admission
# ---------------------------------------------------------------------------


def refusal_for_item_limit(exceeded: ItemLimitExceeded) -> Admission:
    """The ``item_too_large`` refusal of a line builder's :class:`ItemTooLargeError`."""
    return Admission.refused(
        BudgetRefusal.ITEM_TOO_LARGE,
        quantity=exceeded.quantity,
        measured=exceeded.measured,
        limit=exceeded.limit,
    )


async def next_try_number(user_id: str, operation_id: str, component: Component, part: str = "") -> int:
    """The try number of the next attempt of ``component``, from the ledger itself.

    Read from the attempts already recorded rather than from a queue's receive
    count, so the identity of a try survives a redelivery and a dead-letter replay.
    How many tries a component gets stays the business of each worker's existing
    retry configuration (rule 6).
    """
    prefix = f"{ATTEMPT_SK_PREFIX}{operation_id}:{step_key(component, part)}:"
    items = await beta_budget_db.query_prefix(user_id, prefix)
    return 1 + max((_int(item.get("try_number")) for item in items), default=0)


async def _replayed(user_id: str, ids: Sequence[str], operation_id: str) -> Admission:
    """The admission of attempts that already exist: hold nothing, return them.

    All of them existing is the same admission arriving twice. Only some of them
    existing means a caller reused a try number for a different set of components:
    nothing is admitted, and the mismatch is logged for the owner.
    """
    try:
        found = [attempt for attempt in [await _read_attempt(user_id, value) for value in ids] if attempt]
    except LedgerUnavailableError:
        return Admission.refused(BudgetRefusal.BUDGET_UNAVAILABLE)
    if len(found) == len(ids):
        _log(logging.INFO, "beta_budget.admission_replayed", "Admission replayed", user_id=user_id, operation_id=operation_id)
        return Admission(admitted=True, attempts=tuple(found), replayed=True)
    _log(
        logging.ERROR,
        "beta_budget.partial_replay",
        "Some attempts of this admission already exist, others do not",
        user_id=user_id,
        operation_id=operation_id,
        attempt_ids=list(ids),
    )
    return Admission.refused(BudgetRefusal.BUDGET_UNAVAILABLE)


async def _release_expired_quietly(user_id: str, ctx: PricingContext, now: datetime) -> None:
    """Run the backstop before an admission, without ever being the reason it fails."""
    try:
        await release_expired(user_id, now=now, ctx=ctx)
    except Exception as exc:  # the admission below fails closed on its own
        _log(
            logging.WARNING,
            "beta_budget.expiry_sweep_failed",
            "Expired holds could not be released before an admission",
            user_id=user_id,
            error_type=type(exc).__name__,
        )


async def reserve(
    user_id: str,
    *,
    operation_id: str,
    lines: Sequence[ReservationLine],
    try_number: int = 1,
    now: Optional[datetime] = None,
) -> Admission:
    """Admit an operation and hold the bound of each of its lines, in one write.

    The single admission of rule 4: the month's available amount is checked and
    decremented by the sum of the bounds in the same conditional transaction that
    writes one ``held`` attempt per line. Either every line of the operation is
    admitted — an import with its blurb and its translation (rule 10) — or none is.

    Idempotent: the same ``operation_id`` and ``try_number`` arriving again hold
    nothing more and return the original attempts (``replayed``).

    Refuses with ``budget_exhausted`` when the month does not cover the bounds,
    ``not_entitled`` when the beta formula is closed, and ``budget_unavailable``
    whenever the ledger cannot be read or written (rule 7: no fail-open).
    """
    if not lines:
        raise ValueError("an admission needs at least one line")
    ids = [attempt_id(operation_id, line.component, try_number, line.part) for line in lines]
    if len(set(ids)) != len(ids):
        raise ValueError("two lines of one admission cannot share a step: give each call its own part")
    now = _utc(now)
    try:
        ctx = await load_pricing_context()
    except Exception as exc:  # an unreadable configuration refuses, it never admits
        _log(logging.ERROR, "beta_budget.unavailable", "Pricing context unreadable", user_id=user_id, error_type=type(exc).__name__)
        return Admission.refused(BudgetRefusal.BUDGET_UNAVAILABLE)
    if not ctx.formula.is_open(now):
        return Admission.refused(BudgetRefusal.NOT_ENTITLED)

    key = period_key(now)
    reset_at = next_period_start(now)
    reserved = [usd_to_nano_eur(line.bound_usd, ctx.fx.usd_per_eur) for line in lines]
    total = sum(reserved)
    budget = ctx.formula.monthly_budget_nano_eur
    if total > budget:
        _log(
            logging.INFO,
            "beta_budget.refused",
            "Operation bound above the whole monthly budget",
            user_id=user_id,
            operation_id=operation_id,
            refusal=BudgetRefusal.BUDGET_EXHAUSTED.value,
            required_nano_eur=total,
        )
        return Admission.refused(
            BudgetRefusal.BUDGET_EXHAUSTED, period_end=reset_at.isoformat(), required_nano_eur=total
        )

    await _release_expired_quietly(user_id, ctx, now)

    now_iso = _iso(now)
    items: List[Dict[str, Any]] = []
    for value, line, amount in zip(ids, lines, reserved):
        items.append(
            {
                "user_id": user_id,
                "sk": beta_budget_db.attempt_sk(value),
                "item_type": "attempt",
                "attempt_id": value,
                "operation_id": operation_id,
                "component": step_key(line.component, line.part),
                "try_number": try_number,
                "status": AttemptStatus.HELD.value,
                "kind": line.kind.value,
                "provider": line.provider,
                "model": line.model,
                "quantities": {name: int(count) for name, count in line.quantities.items()},
                "measured": line.measured,
                "bound_usd": str(line.bound_usd),
                "reserved_nano_eur": amount,
                "tariff_version": ctx.tariffs.version,
                "usd_per_eur": str(ctx.fx.usd_per_eur),
                "fx_published_on": ctx.fx.published_on,
                "period_key": key,
                "created_at": now_iso,
                # Only open attempts carry it: it is the key of the sparse index the
                # backstop reads.
                "open_since": now_iso,
            }
        )

    try:
        codes = await beta_budget_db.admit(
            user_id=user_id,
            period_key=key,
            budget_nano_eur=budget,
            held_nano_eur=total,
            consumed_nano_eur=0,
            counter_ttl_epoch=_ttl_epoch(reset_at),
            attempt_items=items,
            now_iso=now_iso,
        )
    except LedgerUnavailableError:
        _log(
            logging.ERROR,
            "beta_budget.unavailable",
            "Admission refused: ledger unavailable",
            user_id=user_id,
            operation_id=operation_id,
        )
        return Admission.refused(BudgetRefusal.BUDGET_UNAVAILABLE)

    if codes is not None:
        if any(code == "ConditionalCheckFailed" for code in codes[1:]):
            return await _replayed(user_id, ids, operation_id)
        _log(
            logging.INFO,
            "beta_budget.refused",
            "Monthly budget does not cover the operation",
            user_id=user_id,
            operation_id=operation_id,
            refusal=BudgetRefusal.BUDGET_EXHAUSTED.value,
            required_nano_eur=total,
            period_key=key,
        )
        return Admission.refused(
            BudgetRefusal.BUDGET_EXHAUSTED, period_end=reset_at.isoformat(), required_nano_eur=total
        )

    _log(
        logging.INFO,
        "beta_budget.admitted",
        "Operation admitted",
        user_id=user_id,
        operation_id=operation_id,
        period_key=key,
        held_nano_eur=total,
        attempt_ids=ids,
        measured=all(line.measured for line in lines),
    )
    return Admission(admitted=True, attempts=tuple(_attempt_from_item(item) for item in items))


async def charge_reuse(
    user_id: str,
    *,
    operation_id: str,
    value_nano_eur: int,
    source_operation_id: str,
    now: Optional[datetime] = None,
) -> Admission:
    """Charge a content another account already paid for, at its settled value (rule 12).

    No provider call, so nothing is held: one conditional write admits the charge
    and records it as consumed in the same transaction, refused like a new
    processing when the month does not cover it. ``value_nano_eur`` is the settled
    value stored with the content when it was first processed. The same account
    filing again a media it already holds is not charged at all (task-281), which is
    the caller's check, not this one's.
    """
    now = _utc(now)
    try:
        ctx = await load_pricing_context()
    except Exception as exc:  # an unreadable configuration refuses, it never admits
        _log(logging.ERROR, "beta_budget.unavailable", "Pricing context unreadable", user_id=user_id, error_type=type(exc).__name__)
        return Admission.refused(BudgetRefusal.BUDGET_UNAVAILABLE)
    if not ctx.formula.is_open(now):
        return Admission.refused(BudgetRefusal.NOT_ENTITLED)

    value = max(0, int(value_nano_eur))
    key = period_key(now)
    reset_at = next_period_start(now)
    if value > ctx.formula.monthly_budget_nano_eur:
        return Admission.refused(BudgetRefusal.BUDGET_EXHAUSTED, period_end=reset_at.isoformat(), required_nano_eur=value)

    now_iso = _iso(now)
    identity = attempt_id(operation_id, Component.REUSE, 1)
    item: Dict[str, Any] = {
        "user_id": user_id,
        "sk": beta_budget_db.attempt_sk(identity),
        "item_type": "attempt",
        "attempt_id": identity,
        "operation_id": operation_id,
        "component": Component.REUSE.value,
        "try_number": 1,
        "status": AttemptStatus.SETTLED.value,
        "kind": "reuse",
        "provider": "ledger",
        "model": "",
        "quantities": {},
        "measured": True,
        "bound_usd": "0",
        "reserved_nano_eur": 0,
        "consumed_nano_eur": value,
        "cost_basis": CostBasis.MEASURED.value,
        "source_operation_id": source_operation_id,
        "tariff_version": ctx.tariffs.version,
        "usd_per_eur": str(ctx.fx.usd_per_eur),
        "fx_published_on": ctx.fx.published_on,
        "period_key": key,
        "created_at": now_iso,
        "closed_at": now_iso,
        "ttl_epoch": _ttl_epoch(now),
    }
    try:
        codes = await beta_budget_db.admit(
            user_id=user_id,
            period_key=key,
            budget_nano_eur=ctx.formula.monthly_budget_nano_eur,
            held_nano_eur=0,
            consumed_nano_eur=value,
            counter_ttl_epoch=_ttl_epoch(reset_at),
            attempt_items=[item],
            now_iso=now_iso,
        )
    except LedgerUnavailableError:
        return Admission.refused(BudgetRefusal.BUDGET_UNAVAILABLE)
    if codes is not None:
        if len(codes) > 1 and codes[1] == "ConditionalCheckFailed":
            return await _replayed(user_id, [identity], operation_id)
        return Admission.refused(BudgetRefusal.BUDGET_EXHAUSTED, period_end=reset_at.isoformat(), required_nano_eur=value)
    _log(
        logging.INFO,
        "beta_budget.reuse_charged",
        "Reused content charged",
        user_id=user_id,
        operation_id=operation_id,
        source_operation_id=source_operation_id,
        consumed_nano_eur=value,
    )
    return Admission(admitted=True, attempts=(_attempt_from_item(item),))


# ---------------------------------------------------------------------------
# Sending, settling, releasing
# ---------------------------------------------------------------------------


async def claim_send(user_id: str, attempt: str, *, now: Optional[datetime] = None) -> bool:
    """Take the right to send the request of a ``held`` attempt.

    Persisted before the HTTP call. False means another delivery holds it or the
    attempt is closed: the caller must not send under this reservation. A retry
    needs a new attempt with its own reservation (rule 6) — after releasing a
    ``sending`` attempt whose lease is over with :data:`ReleaseReason.LOST_IN_FLIGHT`.
    Raises :class:`LedgerUnavailableError` when the ledger cannot be written; the
    request is then not sent either.
    """
    return await beta_budget_db.claim_send(user_id=user_id, attempt_id=attempt, now_iso=_iso(_utc(now)))


async def _closed_outcome(
    user_id: str,
    attempt: str,
    wanted: AttemptStatus,
    *,
    still_open: CloseOutcome = CloseOutcome.CONFLICT,
) -> CloseOutcome:
    """Why a close was refused, read back from the attempt itself.

    An attempt still open after its close was refused either is inside the lease the
    release waited for (``still_open=STILL_IN_LEASE``), or has lost its month's
    counter — which only an erasure in progress or a manual deletion can do, and
    which is logged rather than papered over.
    """
    current = await _read_attempt(user_id, attempt)
    if current is None:
        return CloseOutcome.MISSING
    if current.status == wanted:
        return CloseOutcome.ALREADY_CLOSED
    if current.is_open and still_open == CloseOutcome.CONFLICT:
        _log(
            logging.ERROR,
            "beta_budget.counter_missing",
            "An open attempt could not be closed: its month counter is missing",
            user_id=user_id,
            attempt_id=attempt,
            period_key=current.period_key,
        )
    return still_open if current.is_open else CloseOutcome.CONFLICT


async def settle(
    user_id: str,
    attempt: str,
    *,
    cost: MeasuredCost,
    metric_source: str,
    now: Optional[datetime] = None,
) -> CloseOutcome:
    """A result reached the user: charge the tester its real cost (rule 5).

    One transaction: the attempt becomes ``settled`` with its cost, quantities and
    the source of the metric, and its own month's counter swaps the hold for the
    real cost — ``held`` loses the reservation, ``consumed`` gains the cost,
    ``available`` gets the difference back. The cost is converted at the rate the
    reservation recorded.

    A cost above the reservation is applied as it is, even past the budget (rule 8):
    the overrun is logged, never masked, and the next admission is refused
    naturally. Settling twice moves nothing (``already_closed``). A result arriving
    after the attempt was released moves nothing either (``conflict``): the hold
    went back to the tester, its bound stays the operator's spend, and the real
    cost is in the log line for the owner.
    """
    now = _utc(now)
    current = await _read_attempt(user_id, attempt)
    if current is None:
        _log(logging.WARNING, "beta_budget.settle_missing", "Settlement of an unknown attempt", user_id=user_id, attempt_id=attempt)
        return CloseOutcome.MISSING
    if current.status == AttemptStatus.SETTLED:
        return CloseOutcome.ALREADY_CLOSED
    if current.status == AttemptStatus.RELEASED:
        _log(
            logging.WARNING,
            "beta_budget.settle_after_release",
            "A result arrived for an attempt already released",
            user_id=user_id,
            attempt_id=attempt,
            release_reason=current.release_reason,
            cost_usd=str(cost.usd),
        )
        return CloseOutcome.CONFLICT

    consumed = usd_to_nano_eur(cost.usd, current.usd_per_eur)
    reserved = current.reserved_nano_eur
    applied = await beta_budget_db.close_attempt(
        user_id=user_id,
        attempt_id=attempt,
        period_key=current.period_key,
        expected_statuses=[AttemptStatus.HELD.value, AttemptStatus.SENDING.value],
        attempt_set={
            "status": AttemptStatus.SETTLED.value,
            "closed_at": _iso(now),
            "consumed_nano_eur": consumed,
            "cost_usd": str(cost.usd),
            "cost_basis": CostBasis.MEASURED.value,
            "usage": {name: int(count) for name, count in cost.usage.items()},
            "metric_source": metric_source,
            "settled_tariff_version": cost.tariff_version,
            "ttl_epoch": _ttl_epoch(now),
        },
        counter_add={HELD: -reserved, CONSUMED: consumed, AVAILABLE: reserved - consumed},
        now_iso=_iso(now),
    )
    if not applied:
        return await _closed_outcome(user_id, attempt, AttemptStatus.SETTLED)

    if consumed > reserved:
        _log(
            logging.WARNING,
            "beta_budget.overrun",
            "Settled cost above its reservation",
            user_id=user_id,
            attempt_id=attempt,
            reserved_nano_eur=reserved,
            consumed_nano_eur=consumed,
            measured=current.measured,
        )
    _log(
        logging.INFO,
        "beta_budget.settled",
        "Attempt settled",
        user_id=user_id,
        attempt_id=attempt,
        period_key=current.period_key,
        reserved_nano_eur=reserved,
        consumed_nano_eur=consumed,
        metric_source=metric_source,
    )
    return CloseOutcome.APPLIED


async def release(
    user_id: str,
    attempt: str,
    *,
    reason: ReleaseReason,
    operator_cost: Optional[MeasuredCost] = None,
    lost_after: Optional[timedelta] = None,
    now: Optional[datetime] = None,
) -> CloseOutcome:
    """No result reached the user: hand the whole hold back to the tester (rule 5).

    One transaction: the attempt becomes ``released`` and its own month's counter
    moves the hold out of ``held`` into ``available`` (and into ``released``, the
    record of what was handed back). The provider cost of the attempt is added to
    ``operator_spend`` and recorded on it, because handing capacity back never
    erases a spend:

    - ``operator_cost`` given: the cost the provider reported for the failed call;
    - otherwise, an attempt that was ``sending`` may have been billed: its reserved
      bound stands in for the missing metric (basis ``bound``);
    - an attempt still ``held`` never left: zero (basis ``not_sent``).

    ``LOST_IN_FLIGHT`` only applies to a ``sending`` attempt claimed at least
    ``lost_after`` ago — the lease of the worker that claimed it — so a concurrent
    duplicate delivery cannot release a call that is still running.
    """
    now = _utc(now)
    if reason == ReleaseReason.LOST_IN_FLIGHT and lost_after is None:
        raise ValueError("a lost-in-flight release needs the lease it waited for")

    for _ in range(3):
        current = await _read_attempt(user_id, attempt)
        if current is None:
            return CloseOutcome.MISSING
        if current.status == AttemptStatus.RELEASED:
            return CloseOutcome.ALREADY_CLOSED
        if current.status == AttemptStatus.SETTLED:
            _log(
                logging.WARNING,
                "beta_budget.release_after_settle",
                "Release asked for an attempt already settled",
                user_id=user_id,
                attempt_id=attempt,
                reason=reason.value,
            )
            return CloseOutcome.CONFLICT
        if reason == ReleaseReason.LOST_IN_FLIGHT and current.status != AttemptStatus.SENDING:
            return CloseOutcome.CONFLICT

        reserved = current.reserved_nano_eur
        if operator_cost is not None:
            spend, basis = usd_to_nano_eur(operator_cost.usd, current.usd_per_eur), CostBasis.MEASURED
        elif current.status == AttemptStatus.SENDING:
            spend, basis = reserved, CostBasis.BOUND
        else:
            spend, basis = 0, CostBasis.NOT_SENT

        attempt_set: Dict[str, Any] = {
            "status": AttemptStatus.RELEASED.value,
            "closed_at": _iso(now),
            "release_reason": reason.value,
            "operator_cost_nano_eur": spend,
            "cost_basis": basis.value,
            "ttl_epoch": _ttl_epoch(now),
        }
        if operator_cost is not None:
            attempt_set["operator_cost_usd"] = str(operator_cost.usd)
            attempt_set["usage"] = {name: int(count) for name, count in operator_cost.usage.items()}

        claimed_before = _iso(now - lost_after) if reason == ReleaseReason.LOST_IN_FLIGHT and lost_after else None
        applied = await beta_budget_db.close_attempt(
            user_id=user_id,
            attempt_id=attempt,
            period_key=current.period_key,
            # The exact status the cost basis was decided on: an attempt claimed in
            # between must not be released as `not_sent`.
            expected_statuses=[current.status.value],
            attempt_set=attempt_set,
            counter_add={HELD: -reserved, AVAILABLE: reserved, RELEASED: reserved, OPERATOR_SPEND: spend},
            now_iso=_iso(now),
            claimed_before=claimed_before,
        )
        if applied:
            _log(
                logging.INFO,
                "beta_budget.released",
                "Attempt released",
                user_id=user_id,
                attempt_id=attempt,
                period_key=current.period_key,
                reason=reason.value,
                released_nano_eur=reserved,
                operator_cost_nano_eur=spend,
                cost_basis=basis.value,
            )
            return CloseOutcome.APPLIED
        if claimed_before is not None:
            outcome = await _closed_outcome(
                user_id, attempt, AttemptStatus.RELEASED, still_open=CloseOutcome.STILL_IN_LEASE
            )
            if outcome == CloseOutcome.STILL_IN_LEASE:
                return outcome
        # Otherwise the status moved between the read and the write: decide again.
    return await _closed_outcome(user_id, attempt, AttemptStatus.RELEASED)


async def release_expired(
    user_id: str,
    *,
    now: Optional[datetime] = None,
    ctx: Optional[PricingContext] = None,
) -> int:
    """Backstop: release the account's attempts still open past ``hold_expiry_minutes``.

    For an attempt no worker will ever close — its message was lost to a dead-letter
    queue, its worker died with no redelivery. Run before every admission of the
    account, so a stale hold never refuses the tester. The default expiry (6 h) is
    above the longest legitimate chain of an import (three deliveries of a one-hour
    visibility timeout, then the blurb and the translation it reserved).

    Returns how many attempts this call released.
    """
    now = _utc(now)
    ctx = ctx or await load_pricing_context()
    cutoff = _iso(now - ctx.formula.hold_expiry)
    released = 0
    for item in await beta_budget_db.query_open_attempts_before(user_id, cutoff):
        outcome = await release(user_id, str(item["attempt_id"]), reason=ReleaseReason.EXPIRED, now=now)
        if outcome == CloseOutcome.APPLIED:
            released += 1
    if released:
        _log(logging.WARNING, "beta_budget.expired_released", "Expired holds released", user_id=user_id, count=released)
    return released


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


async def get_period_counter(user_id: str, *, now: Optional[datetime] = None) -> PeriodCounter:
    """The account's counter for the month ``now`` falls in.

    A month with nothing reserved yet reads as the full budget. Raises
    :class:`LedgerUnavailableError` when the ledger cannot be read: an unknown state
    is not a full budget.
    """
    now = _utc(now)
    ctx = await load_pricing_context()
    key = period_key(now)
    item = await beta_budget_db.get_item(user_id, beta_budget_db.period_sk(key))
    return _counter_from_item(user_id, key, item, ctx.formula.monthly_budget_nano_eur)


async def list_operation_attempts(user_id: str, operation_id: str) -> List[BudgetAttempt]:
    """Every attempt of one operation, all components and tries."""
    items = await beta_budget_db.query_prefix(user_id, f"{ATTEMPT_SK_PREFIX}{operation_id}:")
    return [_attempt_from_item(item) for item in items]


async def get_attempt(user_id: str, attempt: str) -> Optional[BudgetAttempt]:
    """One attempt, read strongly consistent, or None when it does not exist."""
    return await _read_attempt(user_id, attempt)
