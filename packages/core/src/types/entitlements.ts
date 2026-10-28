/** The authenticated beta capacity contract. Percentages never represent money. */
export type BudgetRefusalCode =
  | "budget_exhausted"
  | "item_too_large"
  | "budget_unavailable"
  | "not_entitled";

export interface BudgetState {
  state: "available" | "exhausted" | "unavailable" | "closed";
  /** Final settled usage only, possibly above 100 after a provider overrun. */
  consumed_percent: number | null;
  reserved_percent: number | null;
  available_percent: number | null;
  open_operations: number | null;
  open_reservations: number | null;
  warning_threshold_percent: number | null;
  resets_at: string;
}

export interface EntitlementStatus {
  user_id: string;
  subscription_tier: "S" | "M" | "L" | null;
  subscription_status: string | null;
  is_active: boolean;
  is_free_trial: boolean;
  is_beta_access: boolean;
  auto_renew_status: boolean | null;
  budget: BudgetState;
}

export interface BudgetForecast {
  state: "estimated" | "unavailable" | "refused";
  /** A maximum reservation estimate, never the final consumption. */
  reservation_percent: number | null;
  available_percent: number | null;
  fits_available: boolean | null;
  refusal: BudgetRefusalCode | null;
  params: Record<string, string | number>;
  resets_at: string;
}
