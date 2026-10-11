/**
 * Turn a refused chat action into a sentence, and say what can be done about it.
 *
 * The chat routes refuse with a typed `error_code` and its figures, never a
 * sentence (docs/CANONICAL_MEDIA_API_CONTRACT.md, "Chat conversations"). The
 * minute refusals are the ones every consuming route shares, worded by
 * `quotaError.ts` — including the beta wording without a paywall — and the
 * scope refusals are the artifacts' own, worded by `artifactRefusal.ts`.
 */

import type { HttpError } from "@media-summarizer/core/api/httpError";
import { describeArtifactRefusal } from "./artifactRefusal";
import { getFriendlyErrorMessage } from "./getFriendlyErrorMessage";
import { getQuotaErrorCode, getQuotaErrorMessage, quotaErrorOffersUpgrade } from "./quotaError";
import { formatNumber, t } from "../i18n";

export interface ChatRefusal {
  message: string;
  /** What the refusal lets the user do next, if anything. */
  action: "newConversation" | "seePlans" | null;
}

export function describeChatRefusal(
  err: unknown,
  scope: "media" | "folder",
): ChatRefusal {
  const httpError = err as HttpError | undefined;
  const details = httpError?.details ?? {};
  const number = (key: string) => formatNumber(Number(details[key] ?? 0));

  const quotaCode = getQuotaErrorCode(err);
  if (quotaCode) {
    // Under the beta regime there is nothing to buy: no route to the paywall.
    const offersUpgrade = quotaErrorOffersUpgrade(quotaCode) && details.beta_access !== true;
    return {
      message: getQuotaErrorMessage(err, quotaCode),
      action: offersUpgrade ? "seePlans" : null,
    };
  }

  switch (httpError?.code) {
    case "scope_empty":
    case "scope_too_large":
      return { message: describeArtifactRefusal(err, { scope }), action: null };
    case "scope_preparing":
      return {
        message: t("chat.refusal.scopePreparing", { count: number("pending_count") }),
        action: null,
      };
    case "question_too_long":
      return {
        message: t("chat.refusal.questionTooLong", {
          length: number("length"),
          max: number("max_chars"),
        }),
        action: null,
      };
    case "conversation_full":
      return {
        message: t("chat.refusal.conversationFull", { max: number("max_turns") }),
        action: "newConversation",
      };
    case "context_budget_exceeded":
      return { message: t("chat.refusal.contextBudget"), action: "newConversation" };
    case "turn_in_flight":
      return { message: t("chat.refusal.turnInFlight"), action: null };
    case "turn_count_changed":
      return { message: t("chat.refusal.turnCountChanged"), action: null };
    case "generation_stale":
      return { message: t("chat.refusal.stale"), action: null };
    case "conversation_not_found":
      return { message: t("chat.refusal.notFound"), action: "newConversation" };
    default:
      return {
        message: getFriendlyErrorMessage(err, { fallback: t("chat.refusal.generic") }),
        action: null,
      };
  }
}
