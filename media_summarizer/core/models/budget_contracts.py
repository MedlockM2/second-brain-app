"""Public capacity, never prices or currency amounts (TASK-550)."""

from typing import Literal, Optional

from pydantic import BaseModel


class BudgetState(BaseModel):
    state: Literal["available", "exhausted", "unavailable", "closed"]
    consumed_percent: Optional[float] = None
    reserved_percent: Optional[float] = None
    available_percent: Optional[float] = None
    open_operations: Optional[int] = None
    open_reservations: Optional[int] = None
    warning_threshold_percent: Optional[float] = None
    resets_at: str


class EntitlementStatus(BaseModel):
    user_id: str
    subscription_tier: Optional[str] = None
    subscription_status: Optional[str] = None
    is_active: bool
    is_free_trial: bool
    is_beta_access: bool
    auto_renew_status: Optional[bool] = None
    budget: BudgetState
