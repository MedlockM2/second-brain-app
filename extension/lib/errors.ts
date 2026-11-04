import { browser } from "wxt/browser";
import { parseErrorResponse } from "@media-summarizer/core/api/httpError";
import type { BudgetRefusalCode } from "@media-summarizer/core/types/entitlements";
import { msg } from "./i18n";

type FailureCode = BudgetRefusalCode | "network" | "session_expired" | "source_refused" | "unavailable" | "unknown";
export interface SaveFailure { code: FailureCode; periodEnd?: string }
const MESSAGES: Record<FailureCode, string> = {
  budget_exhausted: "budgetExhausted", item_too_large: "itemTooLarge",
  budget_unavailable: "budgetUnavailable", not_entitled: "processingClosed",
  provider_suspended: "providerSuspended", network: "networkError",
  session_expired: "pairExpired", source_refused: "sourceRefused",
  unavailable: "budgetUnavailable", unknown: "saveFailed",
};
const CONTEXT_FAILURE_KEY = "contextSaveFailure";

function validDate(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 64 && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && Number.isFinite(new Date(value).getTime()) ? value : undefined;
}

/** Carries only allow-listed presentation data; no backend message or raw body. */
export class ExtensionRequestError extends Error {
  constructor(readonly failure: SaveFailure) { super(failure.code); }
}

export async function responseError(response: Response): Promise<ExtensionRequestError> {
  const parsed = await parseErrorResponse(response, "request_failed");
  const candidate = parsed.quotaErrorCode ?? parsed.code;
  const code: FailureCode = candidate && Object.hasOwn(MESSAGES, candidate)
    ? candidate as FailureCode
    : response.status === 401 ? "session_expired"
    : ["INVALID_URL", "UNSUPPORTED_URL", "VALIDATION_ERROR", "BAD_REQUEST"].includes(parsed.code ?? "")
      ? "source_refused"
      : response.status === 429 || response.status >= 500 ? "unavailable" : "unknown";
  const periodEnd = code === "budget_exhausted" ? validDate(parsed.details?.period_end) : undefined;
  return new ExtensionRequestError({ code, ...(periodEnd ? { periodEnd } : {}) });
}

export function saveFailure(error: unknown): SaveFailure {
  if (error instanceof ExtensionRequestError) return error.failure;
  if (error && typeof error === "object" && "code" in error && error.code === "session_expired") {
    return { code: "session_expired" };
  }
  return { code: error instanceof TypeError ? "network" : "unknown" };
}

export function failureMessage(failure: SaveFailure): string {
  const periodEnd = validDate(failure.periodEnd);
  if (failure.code === "budget_exhausted" && periodEnd) {
    const date = new Intl.DateTimeFormat(browser.i18n.getUILanguage(), {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(periodEnd));
    return msg("budgetExhaustedUntil").replace("{date}", date);
  }
  return msg(MESSAGES[failure.code]);
}

/** One transient code, consumed by the next popup. No selection, URL or account. */
export async function rememberContextFailure(error: unknown): Promise<void> {
  await browser.storage.session.set({ [CONTEXT_FAILURE_KEY]: saveFailure(error) });
}
export async function clearContextFailure(): Promise<void> {
  await browser.storage.session.remove(CONTEXT_FAILURE_KEY);
}
export async function takeContextFailure(): Promise<SaveFailure | null> {
  const stored = (await browser.storage.session.get(CONTEXT_FAILURE_KEY))[CONTEXT_FAILURE_KEY] as SaveFailure | undefined;
  await clearContextFailure();
  if (!stored || !Object.hasOwn(MESSAGES, stored.code)) return null;
  const periodEnd = validDate(stored.periodEnd);
  return { code: stored.code, ...(periodEnd ? { periodEnd } : {}) };
}
