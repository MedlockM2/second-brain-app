"""Apify adapter codes, translated into what a reader of a failed item is told.

The failure classes themselves live in `core/models/ingestion_failures.py`.
"""

from __future__ import annotations

from typing import Dict

from media_summarizer.core.models.failure_codes import MediaFailureCode

#: `ApifyAdapterError.code` -> what the reader of a failed item should be told.
#:
#: Four workers hand Apify failures to the same three or four outcomes, so the
#: translation lives here instead of being re-decided per worker. Anything absent
#: is a network, server or client error: the attempt did not land, and that is
#: `PROVIDER_UNAVAILABLE`.
_APIFY_FAILURE_CODES: Dict[str, MediaFailureCode] = {
    "apify_payment_required": MediaFailureCode.PROVIDER_CREDITS_DEPLETED,
    "apify_pool_exhausted": MediaFailureCode.PROVIDER_CREDITS_DEPLETED,
    "apify_auth_error": MediaFailureCode.PROVIDER_AUTH_FAILED,
    "apify_rate_limited": MediaFailureCode.PROVIDER_RATE_LIMITED,
    "apify_token_missing": MediaFailureCode.PROVIDER_CONFIG_ERROR,
    "apify_actor_missing": MediaFailureCode.PROVIDER_CONFIG_ERROR,
    "apify_dataset_missing": MediaFailureCode.PROVIDER_CONFIG_ERROR,
    "apify_webhook_url_missing": MediaFailureCode.PROVIDER_CONFIG_ERROR,
    "apify_webhook_secret_missing": MediaFailureCode.PROVIDER_CONFIG_ERROR,
    "apify_invalid_json": MediaFailureCode.PROVIDER_RESULT_INVALID,
    "apify_invalid_run": MediaFailureCode.PROVIDER_RESULT_INVALID,
    "apify_invalid_dataset": MediaFailureCode.PROVIDER_RESULT_INVALID,
    # The beta budget refused the run before it started (task-549): the codes of
    # `budget_guard.BudgetRefusedError`, carried by `apify_orchestration`.
    "budget_exhausted": MediaFailureCode.BUDGET_EXHAUSTED,
    "not_entitled": MediaFailureCode.BUDGET_EXHAUSTED,
    "item_too_large": MediaFailureCode.ITEM_TOO_LARGE,
    "budget_unavailable": MediaFailureCode.BUDGET_UNAVAILABLE,
    "provider_suspended": MediaFailureCode.PROVIDER_SUSPENDED,
}


def apify_failure_code(adapter_code: str) -> MediaFailureCode:
    """The failure code an `ApifyAdapterError.code` amounts to for a reader."""
    return _APIFY_FAILURE_CODES.get(adapter_code, MediaFailureCode.PROVIDER_UNAVAILABLE)
