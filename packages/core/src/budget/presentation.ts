import { formatDate, formatNumber, t } from "../i18n/runtime";
import type { BudgetState } from "../types/entitlements";

/** Capacity labels round for readability; admission and gauges keep raw values. */
export function capacityPercentage(value: number): string {
  return `${formatNumber(value, { maximumFractionDigits: 0 })}%`;
}

export function capacityLines(budget: BudgetState): string[] {
  if (budget.state === "unavailable") return [t("budget.unavailable")];
  if (budget.state === "closed") return [t("budget.closed")];
  const lines: string[] = [];
  if (budget.available_percent !== null) lines.push(t("budget.available", { percent: capacityPercentage(budget.available_percent) }));
  if (budget.reserved_percent !== null && budget.reserved_percent > 0) lines.push(t("budget.reserved", { percent: capacityPercentage(budget.reserved_percent) }));
  if (budget.consumed_percent !== null && budget.warning_threshold_percent !== null
    && budget.consumed_percent >= budget.warning_threshold_percent) {
    lines.push(t("budget.warning", {
      percent: capacityPercentage(budget.consumed_percent),
      date: formatDate(new Date(budget.resets_at), { day: "numeric", month: "short", year: "numeric" }),
    }));
  }
  return lines;
}
