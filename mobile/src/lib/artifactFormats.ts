/**
 * The four artifact formats the AI tab offers, and how each one is drawn.
 *
 * One list for the places a format appears: its tile in the "Generate" grid,
 * the icon in front of each of its entries in the list under it (task-534), and
 * the head of its "Personnaliser" screen (task-535). All read the same glyph and
 * the same pair of colours, which is what lets a scrolling list be read by
 * colour before the words.
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
  /** Title of the format's "Personnaliser" screen. */
  customizeTitleKey: TranslationKey;
  /** What the prompt field of that screen asks, before anything is typed. */
  promptHintKey: TranslationKey;
}

/** Display order of the "Generate" grid, read row by row. */
export const ARTIFACT_FORMATS: readonly ArtifactFormat[] = [
  {
    type: "summary_short",
    labelKey: "artifacts.type.summaryShort",
    icon: "document-text-outline",
    tint: "artifactSummaryTint",
    ink: "artifactSummaryInk",
    customizeTitleKey: "artifacts.customize.title.summaryShort",
    promptHintKey: "artifacts.customize.promptHint.summaryShort",
  },
  {
    type: "notes",
    labelKey: "artifacts.type.notes",
    icon: "book-outline",
    tint: "artifactNotesTint",
    ink: "artifactNotesInk",
    customizeTitleKey: "artifacts.customize.title.notes",
    promptHintKey: "artifacts.customize.promptHint.notes",
  },
  {
    type: "flashcards",
    labelKey: "artifacts.type.flashcards",
    icon: "card-outline",
    tint: "artifactFlashcardsTint",
    ink: "artifactFlashcardsInk",
    customizeTitleKey: "artifacts.customize.title.flashcards",
    promptHintKey: "artifacts.customize.promptHint.flashcards",
  },
  {
    type: "quiz",
    labelKey: "artifacts.type.quiz",
    icon: "help-circle-outline",
    tint: "artifactQuizTint",
    ink: "artifactQuizInk",
    customizeTitleKey: "artifacts.customize.title.quiz",
    promptHintKey: "artifacts.customize.promptHint.quiz",
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
