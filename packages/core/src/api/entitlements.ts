import type { ApiClient } from "./apiClient";
import type { BudgetForecast, EntitlementStatus } from "../types/entitlements";
import type { ArtifactGenerationParameters } from "../types/artifacts";

export interface ForecastRequest {
  operation: "audio_import" | "document_import" | "generation" | "chat_turn";
  duration_seconds?: number;
  document_units?: number;
  document_unit?: "page" | "sheet";
  /** Complete request, including instructions, schema and chat history. */
  input_tokens?: number;
  include_translation?: boolean;
  scope?: "media" | "folder";
  scope_id?: string;
  artifact_type?: "summary_short" | "notes" | "flashcards" | "quiz";
  parameters?: ArtifactGenerationParameters;
  conversation_id?: string;
  question?: string;
}

export function artifactForecast(
  scope: "media" | "folder", scopeId: string, type: string, parameters: ArtifactGenerationParameters,
): ForecastRequest | null {
  if (type !== "summary_short" && type !== "notes" && type !== "flashcards" && type !== "quiz") return null;
  return { operation: "generation", scope, scope_id: scopeId, artifact_type: type, parameters };
}

/** Platform transport and authentication are injected by the caller. */
export function createEntitlementsService(api: Pick<ApiClient, "apiRequest">) {
  return {
    status: () => api.apiRequest<EntitlementStatus>("/api/entitlements/status"),
    forecast: (body: ForecastRequest) => api.apiRequest<BudgetForecast>("/api/entitlements/forecast", { method: "POST", body }),
  };
}
