"""Authenticated capacity reads and advisory forecasts from the common budget."""

from fastapi import APIRouter, Depends

from media_summarizer.api.dependencies.auth import require_verified_email
from media_summarizer.core.models.budget_contracts import (
    BudgetForecast,
    EntitlementStatus,
    ForecastRequest,
)
from media_summarizer.core.services import budget_capacity, quota_enforcer

router = APIRouter()


@router.get("/entitlements/status", response_model=EntitlementStatus)
async def get_entitlements_status(current_user=Depends(require_verified_email)):
    snapshot = await quota_enforcer.get_entitlement_snapshot(current_user.id)
    return EntitlementStatus(
        user_id=current_user.id,
        subscription_tier=snapshot.subscription_tier,
        subscription_status=snapshot.subscription_status,
        is_active=snapshot.is_entitled,
        is_free_trial=snapshot.is_free_trial,
        is_beta_access=snapshot.is_beta_access,
        auto_renew_status=snapshot.auto_renew,
        budget=await budget_capacity.get_capacity(current_user.id),
    )


@router.post("/entitlements/forecast", response_model=BudgetForecast)
async def forecast_budget(request: ForecastRequest, current_user=Depends(require_verified_email)):
    """No provider request or reservation: actual admission remains atomic later."""
    return await budget_capacity.forecast(current_user.id, request)
