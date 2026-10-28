import type { ApiClient } from "./apiClient";
import type { BudgetForecast, EntitlementStatus } from "../types/entitlements";

export interface ForecastRequest {
  operation: "audio_import" | "document_import" | "generation" | "chat_turn";
  duration_seconds?: number;
  document_units?: number;
  document_unit?: "page" | "sheet";
  /** Complete request, including instructions, schema and chat history. */
  input_tokens?: number;
  include_translation?: boolean;
}

/** Platform transport and authentication are injected by the caller. */
export function createEntitlementsService(api: Pick<ApiClient, "apiRequest">) {
  return {
    status: () => api.apiRequest<EntitlementStatus>("/api/entitlements/status"),
    forecast: (body: ForecastRequest) => api.apiRequest<BudgetForecast>("/api/entitlements/forecast", { method: "POST", body }),
  };
}
