/**
 * The options of a generation, as the "Personnaliser" screen offers them and the
 * API names them (task-531, task-535; `docs/CANONICAL_MEDIA_API_CONTRACT.md` §3).
 *
 * Here and not in an app: which option a format takes, and what its default is,
 * is a fact of the contract, the same on the phone and on the web. Getting either
 * wrong is not cosmetic — an option sent to a type that does not take it is a
 * `422`, and a default sent or left out decides which entry a request lands on.
 */

import type {
  ArtifactGenerationParameters,
  Difficulty,
  ItemCount,
  SummaryLength,
} from "../types/artifacts";
import type { ArtifactType } from "../types/media";

/** In display order, which is also the order of depth. */
export const SUMMARY_LENGTHS: readonly SummaryLength[] = [
  "short",
  "medium",
  "long",
];
export const ITEM_COUNTS: readonly ItemCount[] = ["fewer", "standard", "more"];
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

/** What a request that does not set the option gets, and what is never sent. */
export const DEFAULT_LENGTH: SummaryLength = "short";
export const DEFAULT_COUNT: ItemCount = "standard";
export const DEFAULT_DIFFICULTY: Difficulty = "medium";

/** Ceiling of `focus` once its whitespace is collapsed, as the backend counts it. */
export const MAX_FOCUS_CHARS = 300;

/** An option that belongs to some formats only. `focus` belongs to every one. */
export type ArtifactFormatOption = "length" | "count" | "difficulty";

const FORMAT_OPTIONS: Partial<
  Record<ArtifactType, readonly ArtifactFormatOption[]>
> = {
  summary_short: ["length"],
  notes: [],
  flashcards: ["count", "difficulty"],
  quiz: ["count", "difficulty"],
};

/**
 * The options of a format besides `focus`, in screen order. Empty for a type that
 * takes none — the notes, and any type the "Generate" grid does not offer.
 */
export function formatOptionsOf(
  type: ArtifactType,
): readonly ArtifactFormatOption[] {
  return FORMAT_OPTIONS[type] ?? [];
}

/**
 * The focus as the backend reads it: trimmed, every run of whitespace — newlines
 * included — collapsed to one space. Two prompts that only differ by their
 * spacing are then the same request.
 */
export function cleanFocus(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

/**
 * The `parameters` to send: everything at its default left out, and a focus
 * cleaned, or dropped when nothing is left of it.
 *
 * The backend drops a default before the hash anyway, so this changes no
 * `artifact_id`; it keeps the request to what the user actually chose. The
 * language and the sources go through as given — whether they are the default
 * depends on the reader and on the folder, which the caller knows and this does
 * not (task-536).
 */
export function withoutDefaults(
  parameters: ArtifactGenerationParameters,
): ArtifactGenerationParameters {
  const sent: ArtifactGenerationParameters = {};
  if (parameters.length && parameters.length !== DEFAULT_LENGTH)
    sent.length = parameters.length;
  if (parameters.count && parameters.count !== DEFAULT_COUNT)
    sent.count = parameters.count;
  if (parameters.difficulty && parameters.difficulty !== DEFAULT_DIFFICULTY)
    sent.difficulty = parameters.difficulty;
  const focus = parameters.focus ? cleanFocus(parameters.focus) : "";
  if (focus) sent.focus = focus;
  if (parameters.language) sent.language = parameters.language;
  if (parameters.source_ids?.length)
    sent.source_ids = [...parameters.source_ids];
  return sent;
}
