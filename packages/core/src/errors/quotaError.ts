/** Typed beta refusals, shared by mobile and web. No refusal offers a purchase. */
import type { HttpError } from "../api/httpError";
import type { BudgetRefusalCode } from "../types/entitlements";
import { formatDate, t } from "../i18n/runtime";

export type QuotaErrorCode = BudgetRefusalCode;
const CODES: readonly QuotaErrorCode[] = [
  "budget_exhausted",
  "item_too_large",
  "budget_unavailable",
  "not_entitled",
  "provider_suspended",
];

export function getQuotaErrorCode(error: unknown): QuotaErrorCode | null {
  if (!error || typeof error !== "object") return null;
  const candidate = (error as HttpError).quotaErrorCode ?? (error as HttpError).code;
  return CODES.includes(candidate as QuotaErrorCode) ? candidate as QuotaErrorCode : null;
}

export function quotaErrorOffersUpgrade(_code: QuotaErrorCode): boolean {
  return false;
}

export function getQuotaErrorTitle(_code: QuotaErrorCode): string {
  return t("budget.title");
}

export function getQuotaErrorMessage(error: unknown, code: QuotaErrorCode): string {
  const details = (error as HttpError | undefined)?.details ?? {};
  switch (code) {
    case "item_too_large": return t("budget.tooLarge");
    case "budget_unavailable": return t("budget.unavailable");
    case "not_entitled": return t("budget.closed");
    case "provider_suspended": return t("budget.suspended");
    case "budget_exhausted": {
      const end = typeof details.period_end === "string" ? new Date(details.period_end) : null;
      return end && Number.isFinite(end.getTime())
        ? t("budget.exhaustedUntil", { date: formatDate(end, { day: "numeric", month: "short", year: "numeric" }) })
        : t("budget.exhausted");
    }
  }
}
