"""Read-only projections of the common ledger."""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from media_summarizer.core.models.budget_contracts import BudgetState
from media_summarizer.core.services import beta_budget, pricing_config_service
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
            open_reservations=len(opened),
            resets_at=reset,
            warning_threshold_percent=warning_threshold,
        )
    except Exception as exc:  # An unreadable ledger is never an unused budget.
        log_event(
            logger,
            logging.ERROR,
            "budget_capacity.unavailable",
            "Capacity could not be read",
            user_id=user_id,
            error_type=type(exc).__name__,
        )
        return BudgetState(state="unavailable", resets_at=reset)
