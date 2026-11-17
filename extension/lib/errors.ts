import { browser } from "wxt/browser";
import { parseErrorResponse } from "@media-summarizer/core/api/httpError";
import type { BudgetRefusalCode } from "@media-summarizer/core/types/entitlements";
import { msg } from "./i18n";

type RefusalCode =
  | "scope_empty"
  | "scope_too_large"
  | "scope_preparing"
  | "question_too_long"
  | "conversation_full"
  | "context_budget_exceeded"
  | "turn_in_flight"
  | "turn_count_changed"
  | "conversation_not_found"
  | "FOLDER_NAME_CONFLICT";
type FailureCode = BudgetRefusalCode | RefusalCode | "network" | "session_expired" | "source_refused" | "unavailable" | "unknown";
export interface SaveFailure {
  code: FailureCode;
  periodEnd?: string;
  /** The figures a typed refusal carries (`max`, `length`), never a sentence. */
  params?: Record<string, number>;
}
const MESSAGES: Record<FailureCode, string> = {
  budget_exhausted: "budgetExhausted", item_too_large: "itemTooLarge",
  budget_unavailable: "budgetUnavailable", not_entitled: "processingClosed",
  provider_suspended: "providerSuspended", network: "networkError",
  session_expired: "pairExpired", source_refused: "sourceRefused",
  unavailable: "budgetUnavailable", unknown: "saveFailed",
  scope_empty: "artifactMediaEmpty", scope_too_large: "artifactTooMuchText", scope_preparing: "chatWaiting",
  question_too_long: "chatQuestionTooLong", conversation_full: "chatConversationFull",
  context_budget_exceeded: "chatContextBudget", turn_in_flight: "chatTurnInFlight",
  turn_count_changed: "chatTurnCountChanged", conversation_not_found: "chatNotFound",
  FOLDER_NAME_CONFLICT: "folderDuplicate",
};
/** The figures each refusal's sentence names, under the names its sentence uses. */
const PARAMS: Partial<Record<FailureCode, Record<string, string>>> = {
  question_too_long: { length: "length", max: "max_chars" },
  conversation_full: { max: "max_turns" },
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
  const params: Record<string, number> = {};
  for (const [name, field] of Object.entries(PARAMS[code] ?? {})) {
    const value = Number(parsed.details?.[field]);
    if (Number.isFinite(value)) params[name] = value;
  }
  return new ExtensionRequestError({
    code,
    ...(periodEnd ? { periodEnd } : {}),
    ...(Object.keys(params).length ? { params } : {}),
  });
}

/** A refusal the same request will meet again: offering to retry it would only fail twice. */
const FINAL: readonly FailureCode[] = ["budget_exhausted", "item_too_large", "not_entitled", "source_refused"];
export function retryable(failure: SaveFailure): boolean {
  return !FINAL.includes(failure.code);
}

export function saveFailure(error: unknown): SaveFailure {
  if (error instanceof ExtensionRequestError) return error.failure;
  if (error && typeof error === "object" && "code" in error && error.code === "session_expired") {
    return { code: "session_expired" };
  }
  return { code: error instanceof TypeError ? "network" : "unknown" };
}

/**
 * The sentence for a failure. `fallback` names the message of an unexplained
 * failure where it happened: a save, a summary, a question.
 */
export function failureMessage(failure: SaveFailure, fallback = "saveFailed"): string {
  const periodEnd = validDate(failure.periodEnd);
  if (failure.code === "budget_exhausted" && periodEnd) {
    const date = new Intl.DateTimeFormat(browser.i18n.getUILanguage(), {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(periodEnd));
    return msg("budgetExhaustedUntil").replace("{date}", date);
  }
  const sentence = msg(failure.code === "unknown" ? fallback : MESSAGES[failure.code]);
  const format = new Intl.NumberFormat(browser.i18n.getUILanguage());
  return sentence.replace(/\{(\w+)\}/g, (match, name: string) =>
    failure.params && name in failure.params ? format.format(failure.params[name]) : match);
}

/**
 * What a right-click save carried, kept so the side panel can send it again.
 * Session storage only: memory, gone with the browser, closed to pages.
 */
export type ContextSave =
  | { kind: "selection"; text: string; url: string | null; folderId: string | null }
  | { kind: "link"; url: string; folderId: string | null };
export interface ContextFailure { failure: SaveFailure; save: ContextSave }

/** The failed right-click save, until the side panel has shown it. */
export async function rememberContextFailure(error: unknown, save: ContextSave): Promise<void> {
  await browser.storage.session.set({ [CONTEXT_FAILURE_KEY]: { failure: saveFailure(error), save } satisfies ContextFailure });
}

/** Forget it, and the "!" on the toolbar button that announced it. */
export async function clearContextFailure(): Promise<void> {
  await browser.storage.session.remove(CONTEXT_FAILURE_KEY);
  await browser.action.setBadgeText({ text: "" });
}

export async function contextFailure(): Promise<ContextFailure | null> {
  const stored = (await browser.storage.session.get(CONTEXT_FAILURE_KEY))[CONTEXT_FAILURE_KEY] as ContextFailure | undefined;
  if (!stored?.failure || !Object.hasOwn(MESSAGES, stored.failure.code) || !stored.save) return null;
  const periodEnd = validDate(stored.failure.periodEnd);
  return { failure: { code: stored.failure.code, ...(periodEnd ? { periodEnd } : {}) }, save: stored.save };
}

export function onContextFailureChange(listener: () => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && CONTEXT_FAILURE_KEY in changes) listener();
  });
}
