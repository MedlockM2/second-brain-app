/**
 * The four artifact formats the AI tab offers, and how each one is drawn.
 *
 * One list for the two places a format appears (task-534): its tile in the
 * "Generate" grid, and the icon in front of each of its entries in the list
 * under it. Both read the same glyph and the same pair of colours, which is
 * what lets a scrolling list be read by colour before the words.
 *
 * The colours are named, not resolved: a format holds the *key* of its tint and
 * of its ink in the theme, and the caller reads them off `useThemeColors()`, so
 * the light and the dark palette are both reachable from this one constant.
 * The label is a catalogue key for the same reason — this array is built once
 * at import time, and a resolved string would freeze the language the app was
 * launched in.
 */

import type { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "../constants/theme";
import type { TranslationKey } from "../i18n";
import type { ArtifactType } from "@media-summarizer/core/types/media";

export interface ArtifactFormat {
  type: ArtifactType;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  /** Fill of the format's tile, and of its icon box while it is generated. */
  tint: keyof ThemeColors;
  /** Colour of the format's icon, on its tint and alone on the page. */
  ink: keyof ThemeColors;
}

/** Display order of the "Generate" grid, read row by row. */
export const ARTIFACT_FORMATS: readonly ArtifactFormat[] = [
  {
    type: "summary_short",
    labelKey: "artifacts.type.summaryShort",
    icon: "document-text-outline",
    tint: "artifactSummaryTint",
    ink: "artifactSummaryInk",
  },
  {
    type: "notes",
    labelKey: "artifacts.type.notes",
    icon: "book-outline",
    tint: "artifactNotesTint",
    ink: "artifactNotesInk",
  },
  {
    type: "flashcards",
    labelKey: "artifacts.type.flashcards",
    icon: "copy-outline",
    tint: "artifactFlashcardsTint",
    ink: "artifactFlashcardsInk",
  },
  {
    type: "quiz",
    labelKey: "artifacts.type.quiz",
    icon: "help-circle-outline",
    tint: "artifactQuizTint",
    ink: "artifactQuizInk",
  },
];

/**
 * The format of an entry, or `undefined` for a type the grid does not offer.
 *
 * `ArtifactType` still names the unscoped `summary` the backend no longer
 * produces; an entry of that type has no tile, and its row falls back to a
 * neutral glyph rather than borrowing another format's colours.
 */
export function artifactFormatOf(
  type: ArtifactType,
): ArtifactFormat | undefined {
  return ARTIFACT_FORMATS.find((format) => format.type === type);
}
