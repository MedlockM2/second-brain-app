import { getQuotaErrorMessage } from "../errors/quotaError";
import { t } from "../i18n/runtime";
import type { ArtifactSummary } from "../types/artifacts";

/** A failed history entry's reason, without displaying server diagnostic prose. */
export function artifactFailureMessage(artifact: Pick<ArtifactSummary, "error_code" | "error_params">): string {
  switch (artifact.error_code?.toLowerCase()) {
    case "budget_exhausted": return getQuotaErrorMessage({ details: artifact.error_params }, "budget_exhausted");
    case "budget_unavailable": return getQuotaErrorMessage({}, "budget_unavailable");
    case "not_entitled": return getQuotaErrorMessage({}, "not_entitled");
    case "provider_suspended": return getQuotaErrorMessage({}, "provider_suspended");
    case "item_too_large": return getQuotaErrorMessage({}, "item_too_large");
    case "sources_changed":
    case "sources_preparation_failed": return t("artifacts.failure.sources");
    case "sources_preparation_timeout":
    case "generation_stalled":
    case "provider_timed_out": return t("artifacts.failure.timeout");
    case "validation_error":
    case "provider_result_invalid": return t("artifacts.failure.invalid");
    case "provider_unavailable": return t("artifacts.failure.provider");
    default: return t("artifacts.row.failed");
  }
}
