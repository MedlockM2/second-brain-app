import type { ApiClient } from "./apiClient";
import type { EntitlementStatus } from "../types/entitlements";

/** Platform transport and authentication are injected by the caller. */
export function createEntitlementsService(api: Pick<ApiClient, "apiRequest">) {
  return {
    status: () => api.apiRequest<EntitlementStatus>("/api/entitlements/status"),
  };
}
