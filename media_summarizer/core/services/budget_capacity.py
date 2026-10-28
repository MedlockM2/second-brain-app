"""Read-only projections of the common ledger. Forecasting never admits a call."""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List

from media_summarizer.core.models.beta_budget import BudgetRefusal, Component, ReservationLine
from media_summarizer.core.models.budget_contracts import BudgetForecast, BudgetState, ForecastRequest
from media_summarizer.core.services import beta_budget, budget_guard, pricing_config_service
from media_summarizer.core.services.llm_config import (
    LLM_MAX_COMPLETION_TOKENS,
    LLM_MODEL,
    LLM_MODEL_MAX_INPUT_TOKENS,
)
from media_summarizer.utils import beta_budget_db
from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)


def percent(amount: int, budget: int) -> float:
    if budget <= 0:
        raise ValueError("A capacity percentage requires a positive budget")
    return float(Decimal(amount) * 100 / Decimal(budget))


async def get_capacity(user_id: str) -> BudgetState:
    now = datetime.now(timezone.utc)
    reset = beta_budget.next_period_start(now).isoformat()
    try:
        ctx = await beta_budget.load_pricing_context()
        if not ctx.formula.is_open(now):
            return BudgetState(state="closed", resets_at=reset)
        counter = await beta_budget.get_period_counter(user_id, now=now)
        config = await pricing_config_service.get_pricing_config()
        warning_threshold = float((config.get("usage_gauge") or {}).get("warning_threshold_pct", 80))
        # Old-month operations may still be running; only the current counter's
        # reservations affect the current percentages.
        # The sparse open-attempt index avoids reading months of closed calls
        # each time the account screen refreshes. Counts are informational and
        # eventually consistent; the authoritative amounts come from the counter.
        items = await beta_budget_db.query_open_attempts_before(user_id, now.isoformat())
        opened = [item for item in items if item.get("status") in {"held", "sending"}]
        return BudgetState(
            state="available" if counter.available_nano_eur > 0 else "exhausted",
            consumed_percent=percent(counter.consumed_nano_eur, counter.budget_nano_eur),
            reserved_percent=percent(counter.held_nano_eur, counter.budget_nano_eur),
            available_percent=max(0, percent(counter.available_nano_eur, counter.budget_nano_eur)),
            open_operations=len({item["operation_id"] for item in opened}),
            open_reservations=len(opened), resets_at=reset,
            warning_threshold_percent=warning_threshold,
        )
    except Exception as exc:  # An unreadable ledger is never an unused budget.
        log_event(logger, logging.ERROR, "budget_capacity.unavailable", "Capacity could not be read",
                  user_id=user_id, error_type=type(exc).__name__)
        return BudgetState(state="unavailable", resets_at=reset)


def _lines(ctx: beta_budget.PricingContext, request: ForecastRequest) -> List[ReservationLine]:
    if request.operation in {"generation", "chat_turn"}:
        return [beta_budget.llm_line(
            ctx, component=Component.GENERATION if request.operation == "generation" else Component.CHAT_TURN,
            model=LLM_MODEL, input_tokens=request.input_tokens,
            max_input_tokens=LLM_MODEL_MAX_INPUT_TOKENS, max_output_tokens=LLM_MAX_COMPLETION_TOKENS,
            measured=False,
        )]
    if request.operation == "audio_import":
        lines = [beta_budget.transcription_line(ctx, duration_seconds=request.duration_seconds)]
        estimate = budget_guard.TextEstimate(duration_seconds=request.duration_seconds)
    else:
        lines = [beta_budget.document_line(ctx, provider="llamaparse", unit=request.document_unit,
                                           count=request.document_units)]
        # Sheets have no trustworthy text-to-page equivalence.
        estimate = budget_guard.TextEstimate(
            page_count=request.document_units if request.document_unit == "page" else None, document=True,
        )
    tokens = estimate.tokens(ctx)
    lines.append(budget_guard.blurb_line(ctx, text_tokens=tokens))
    if request.include_translation:
        lines.append(budget_guard.import_translation_line(ctx, text_tokens=tokens))
    return lines


async def forecast(user_id: str, request: ForecastRequest) -> BudgetForecast:
    now = datetime.now(timezone.utc)
    reset = beta_budget.next_period_start(now).isoformat()
    try:
        ctx = await beta_budget.load_pricing_context()
        if not ctx.formula.is_open(now):
            return BudgetForecast(state="refused", refusal=BudgetRefusal.NOT_ENTITLED, resets_at=reset)
        lines = _lines(ctx, request)
        # Round each component exactly as reserve(), rather than rounding a sum.
        amount = sum(beta_budget.usd_to_nano_eur(line.bound_usd, ctx.fx.usd_per_eur) for line in lines)
        counter = await beta_budget.get_period_counter(user_id, now=now)
        fits = amount <= counter.available_nano_eur
        return BudgetForecast(
            state="estimated", reservation_percent=percent(amount, counter.budget_nano_eur),
            available_percent=max(0, percent(counter.available_nano_eur, counter.budget_nano_eur)),
            fits_available=fits, refusal=None if fits else BudgetRefusal.BUDGET_EXHAUSTED,
            params={} if fits else {"period_end": reset}, resets_at=reset,
        )
    except beta_budget.ItemTooLargeError as exc:
        return BudgetForecast(state="refused", refusal=BudgetRefusal.ITEM_TOO_LARGE,
                              params=beta_budget.refusal_for_item_limit(exc.exceeded).params, resets_at=reset)
    except Exception as exc:
        log_event(logger, logging.WARNING, "budget_capacity.forecast_unavailable", "Forecast could not be priced",
                  user_id=user_id, error_type=type(exc).__name__)
        return BudgetForecast(state="unavailable", refusal=BudgetRefusal.BUDGET_UNAVAILABLE, resets_at=reset)
