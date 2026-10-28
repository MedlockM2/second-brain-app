"""Public capacity, never prices or currency amounts (TASK-550)."""

from typing import Any, Dict, Literal, Optional, Union

from pydantic import BaseModel, Field

from media_summarizer.core.models.beta_budget import BudgetRefusal


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


class ForecastRequest(BaseModel):
    operation: Literal["audio_import", "document_import", "generation", "chat_turn"]
    duration_seconds: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False)
    document_units: Optional[int] = Field(default=None, gt=0)
    document_unit: Literal["page", "sheet"] = "page"
    # Complete request, including instructions, schema and (for chat) history.
    input_tokens: Optional[int] = Field(default=None, gt=0)
    include_translation: bool = True
    scope: Optional[Literal["media", "folder"]] = None
    scope_id: Optional[str] = Field(default=None, max_length=256)
    artifact_type: Optional[Literal["summary_short", "notes", "flashcards", "quiz"]] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    conversation_id: Optional[str] = Field(default=None, max_length=256)
    question: Optional[str] = Field(default=None, max_length=64000)


class BudgetForecast(BaseModel):
    state: Literal["estimated", "unavailable", "refused"]
    reservation_percent: Optional[float] = None
    available_percent: Optional[float] = None
    fits_available: Optional[bool] = None
    refusal: Optional[BudgetRefusal] = None
    params: Dict[str, Union[str, int]] = Field(default_factory=dict)
    resets_at: str
