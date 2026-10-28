import type { ApiClient } from "../api/apiClient";
import { createEntitlementsService, type ForecastRequest } from "../api/entitlements";
import { formatDate, formatNumber, t } from "../i18n/runtime";
import type { BudgetForecast, BudgetState } from "../types/entitlements";
import { getQuotaErrorMessage } from "../errors/quotaError";

export function percentage(value: number): string {
  // A tiny positive reservation must never look free after rounding.
  if (value > 0 && value < 0.001) return `<${formatNumber(0.001, { maximumFractionDigits: 3 })}%`;
  return `${formatNumber(value, { maximumFractionDigits: 3 })}%`;
}

export function capacityLines(budget: BudgetState): string[] {
  if (budget.state === "unavailable") return [t("budget.unavailable")];
  if (budget.state === "closed") return [t("budget.closed")];
  const lines: string[] = [];
  if (budget.available_percent !== null) lines.push(t("budget.available", { percent: percentage(budget.available_percent) }));
  if (budget.reserved_percent !== null && budget.reserved_percent > 0) lines.push(t("budget.reserved", { percent: percentage(budget.reserved_percent) }));
  if (budget.consumed_percent !== null && budget.warning_threshold_percent !== null
    && budget.consumed_percent >= budget.warning_threshold_percent) {
    lines.push(t("budget.warning", {
      percent: percentage(budget.consumed_percent),
      date: formatDate(new Date(budget.resets_at), { day: "numeric", month: "short", year: "numeric" }),
    }));
  }
  return lines;
}

export function forecastLine(forecast: BudgetForecast | null): string {
  if (forecast?.state === "refused" && forecast.refusal) {
    return getQuotaErrorMessage({ details: forecast.params }, forecast.refusal);
  }
  if (forecast?.reservation_percent == null || forecast.state !== "estimated") return t("budget.forecastUnavailable");
  const estimate = t("budget.forecast", { percent: percentage(forecast.reservation_percent) });
  return forecast.fits_available === false
    ? `${estimate} ${t("budget.forecastOver")}`
    : estimate;
}

/** Debounce metadata edits and discard late replies; never gates or submits work. */
export function watchForecast(
  request: ForecastRequest | null,
  api: Pick<ApiClient, "apiRequest">,
  publish: (forecast: BudgetForecast | null) => void,
): () => void {
  let active = true;
  const timer = setTimeout(() => {
    if (!request) return;
    void createEntitlementsService(api).forecast(request)
      .then((value) => { if (active) publish(value); })
      .catch(() => { if (active) publish(null); });
  }, 600);
  return () => { active = false; clearTimeout(timer); };
}
