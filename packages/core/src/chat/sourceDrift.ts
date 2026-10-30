/**
 * The banner of a folder conversation whose sources changed since it was opened
 * (task-572).
 *
 * The conversation keeps reading the sources frozen at its opening; the server
 * measures how far the folder has moved from them (`source_drift`) and the app
 * says so, offering a new conversation. Shared by the mobile and web apps.
 */

import { t, tCount } from "../i18n/runtime";
import type { ChatConversationDetail } from "../types/chat";

/**
 * A freshly read detail, carrying over the drift of the previous read when the
 * server did not measure it this time (a generation in flight), so the banner
 * does not disappear while an answer is written.
 */
export function withKnownSourceDrift(
  previous: ChatConversationDetail | null | undefined,
  next: ChatConversationDetail,
): ChatConversationDetail {
  if (next.source_drift != null) return next;
  if (previous?.conversation_id !== next.conversation_id || previous.source_drift == null) return next;
  return { ...next, source_drift: previous.source_drift };
}

/** The banner's sentence, or null when the conversation reads the folder as it is. */
export function describeSourceDrift(conversation: ChatConversationDetail | null | undefined): string | null {
  const drift = conversation?.scope === "folder" ? conversation.source_drift : null;
  if (!drift) return null;
  const { added, removed } = drift;
  if (added > 0 && removed > 0) {
    return t("chat.drift.both", {
      added: tCount("chat.drift.addedCount", added),
      removed: tCount("chat.drift.removedCount", removed),
    });
  }
  if (added > 0) return tCount("chat.drift.added", added);
  if (removed > 0) return tCount("chat.drift.removed", removed);
  return null;
}
