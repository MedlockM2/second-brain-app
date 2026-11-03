import { t, type TranslationKey } from "../i18n/runtime";
import { resolveMediaTitle } from "../media/mediaTitle";
import type { RecentEngagement } from "../types/engagements";

const FORMATS = {
  summary_short: { label: "artifacts.type.summaryShort", icon: "document-text-outline", tone: "summary" },
  summary: { label: "artifacts.type.summaryShort", icon: "document-text-outline", tone: "summary" },
  notes: { label: "artifacts.type.notes", icon: "book-outline", tone: "notes" },
  flashcards: { label: "artifacts.type.flashcards", icon: "copy-outline", tone: "flashcards" },
  quiz: { label: "artifacts.type.quiz", icon: "help-circle-outline", tone: "quiz" },
} as const;

/** Resolve at render time so the badge and generic source name follow the locale. */
export function engagementDisplay(entry: RecentEngagement) {
  const format = entry.artifact_type ? FORMATS[entry.artifact_type] : null;
  const typeLabel = entry.kind === "conversation" ? t("home.discussion")
    : t((format?.label ?? "media.tab.ai") as TranslationKey);
  const title = entry.title?.trim() || typeLabel;
  const sourceTitle = entry.scope === "folder" ? entry.scope_title?.trim() || t("home.untitledFolder")
    : resolveMediaTitle({ title: entry.scope_title, title_label_key: entry.scope_title_label_key, created_at: entry.scope_created_at });
  const stateLabel = entry.state === "pending" ? t("home.learningPending")
    : entry.state === "failed" ? t("artifacts.row.failed") : null;
  return { title, sourceTitle, typeLabel, stateLabel,
    icon: entry.kind === "conversation" ? "chatbubbles-outline" as const : format?.icon ?? "sparkles-outline" as const,
    tone: entry.kind === "conversation" ? "discussion" as const : format?.tone ?? "summary",
    accessibilityLabel: [typeLabel, title, sourceTitle, stateLabel].filter(Boolean).join(", "),
  };
}
