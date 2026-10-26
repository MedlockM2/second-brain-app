import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import type { IconName } from "../Icon";

/**
 * The four artifact formats the AI pane offers, and how each one is drawn — the
 * web side of `mobile/src/lib/artifactFormats.ts` (task-534, task-541).
 *
 * One list for the two places a format appears: its tile in the "Generate"
 * grid, and the icon in front of each of its entries in the list under it. Both
 * read the same glyph and the same pair of colours, which is what lets the list
 * be read by colour before the words. The colours are a class (`f-*` in
 * `styles.css`) that sets `--tint` and `--ink` from the theme's variables, so
 * the light and the dark palette both follow from this one constant.
 */
export interface ArtifactFormat {
  type: ArtifactType;
  labelKey: TranslationKey;
  icon: IconName;
  /** The class carrying the format's tint and ink. */
  tone: string;
}

/** Display order of the "Generate" grid, read row by row. */
export const ARTIFACT_FORMATS: readonly ArtifactFormat[] = [
  { type: "summary_short", labelKey: "artifacts.type.summaryShort", icon: "document-text-outline", tone: "f-summary" },
  { type: "notes", labelKey: "artifacts.type.notes", icon: "book-outline", tone: "f-notes" },
  { type: "flashcards", labelKey: "artifacts.type.flashcards", icon: "card-outline", tone: "f-flashcards" },
  { type: "quiz", labelKey: "artifacts.type.quiz", icon: "help-circle-outline", tone: "f-quiz" },
];

/**
 * The format of an entry, or `undefined` for a type the grid does not offer:
 * the unscoped `summary` the backend no longer produces has no tile, and its row
 * falls back to a neutral glyph rather than borrowing another format's colours.
 */
export function artifactFormatOf(type: ArtifactType): ArtifactFormat | undefined {
  return ARTIFACT_FORMATS.find((format) => format.type === type);
}
