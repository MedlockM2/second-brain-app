/**
 * The passage a search hit quotes, found again in the text the reader draws.
 *
 * Tapping a result used to open the media at the top of its text, however deep
 * in it the quoted words were — a beta tester's report. The hit carries no
 * offset: its excerpt is Algolia's snippet of the indexed
 * transcript, ~30 words around the match, `<mark>`-tagged and HTML-escaped
 * (`search_indexing.search_transcripts`). So the passage is found again by its
 * words, in the text as the reader draws it.
 *
 * The two are the same transcript but not the same string: `/raw-content`
 * re-paragraphs it (whitespace only, `normalize_transcript_text`), the reader
 * splits it into paragraphs or Markdown blocks and drops the Markdown syntax, and
 * Algolia escaped it. Both sides are therefore compared *folded* — letters and
 * digits only, lower-cased, without diacritics — so whatever a rendering adds,
 * drops or re-spaces is out of the comparison.
 *
 * The index holds each save's text in its reading language, the translation when
 * there is one, which is the text the reader opens on. What it cannot find is a
 * passage the reader does not show: a hit on the title alone, or the original of
 * a translated media once the reader switches to it. That answers `null`, and the
 * page opens at the top of the text as it always has.
 *
 * Pure string work, shared by the mobile and the web reader; each one highlights
 * and scrolls in its own way from the ranges returned here.
 */

import {
  focusHighlightSegments,
  parseHighlightSnippet,
  type HighlightSegment,
} from "./highlightSnippet";

/** How long the found passage stays highlighted once it is on screen (ms). */
export const SEARCH_PASSAGE_HIGHLIGHT_MS = 5000;

/**
 * How much of the excerpt travels with the tap. An Algolia snippet is well
 * inside it; the bound is for the backend's fallback to the whole highlighted
 * chunk (several KB) when the engine returns no snippet.
 */
const PASSAGE_WINDOW = { leadChars: 240, maxChars: 720 };

/**
 * Folded characters kept on each side of the first match when the passage is not
 * found whole — a Markdown link or a list number inside it, say — tried in this
 * order.
 */
const FALLBACK_CONTEXTS = [48, 24, 12];

/**
 * The shortest folded window a fallback may search for. A few words: a lone
 * short term would land on its first occurrence anywhere in the text.
 */
const MIN_FALLBACK_KEY = 16;

/**
 * Non-ASCII code units the comparison sets aside: spacing, punctuation and the
 * combining marks NFD splits off. A window cut with an ellipsis, a typographic
 * quote or a no-break space then compares like the text around it.
 */
const IGNORED_RANGES: readonly (readonly [number, number])[] = [
  [0x0080, 0x00bf], // Latin-1 controls, no-break space, « » ¡ ¿ · and other signs
  [0x0300, 0x036f], // combining diacritics
  [0x2000, 0x206f], // typographic spaces, dashes, quotes, ellipsis
  [0x3000, 0x303f], // CJK spacing and punctuation
  [0xfeff, 0xfeff], // byte-order mark
];

/** A stretch of one unit of text: `[start, end)` in its UTF-16 offsets. */
export interface PassageRange {
  unit: number;
  start: number;
  end: number;
}

/** Where a passage was found again, in the units it was searched in. */
export interface LocatedPassage {
  /** The start of the first matched word: what the reader is brought to. */
  anchor: { unit: number; offset: number };
  /** The matched words, one range per unit they fall in, in reading order. Never empty. */
  marks: PassageRange[];
}

/**
 * What a search hit hands to the media page: its excerpt, bounded, as a
 * `<mark>`-tagged string `locateSearchPassage` reads back.
 *
 * `null` when the excerpt holds no match — a hit on the title alone, whose
 * excerpt is just the start of the text. There is no passage to open on then.
 */
export function searchPassageFromSnippet(
  snippet: string | null | undefined,
): string | null {
  if (!snippet) return null;
  const segments = parseHighlightSnippet(snippet);
  if (!segments.some((segment) => segment.highlighted && segment.text.trim())) {
    return null;
  }
  return serializeSegments(focusHighlightSegments(segments, PASSAGE_WINDOW));
}

/**
 * Find a passage (`searchPassageFromSnippet`) in the text a reader draws.
 *
 * `units` are the pieces that text is drawn in — paragraphs, Markdown blocks,
 * DOM text nodes — in reading order; the passage may run across several. The
 * whole passage is searched first; failing that, shrinking windows around its
 * first match. The first occurrence wins: thirty words do not repeat.
 */
export function locateSearchPassage(
  units: readonly string[],
  passage: string,
): LocatedPassage | null {
  const segments = parseHighlightSnippet(passage);
  const needle = fold(segments.map((segment) => segment.text));
  const marked = needle.units.map((segment) => segments[segment].highlighted);
  const markStart = marked.indexOf(true);
  if (markStart < 0) return null;
  let markEnd = markStart;
  while (markEnd < marked.length && marked[markEnd]) markEnd += 1;

  const text = fold(units);
  for (const [from, to] of searchWindows(needle.key.length, markStart, markEnd)) {
    const at = text.key.indexOf(needle.key.slice(from, to));
    if (at >= 0) return describeMatch(units, text, at - from, from, to, marked);
  }
  return null;
}

/** A text reduced to what is compared, and where each kept character came from. */
interface FoldedText {
  key: string;
  /** For each character of `key`, the unit it was read from. */
  units: number[];
  /** For each character of `key`, its UTF-16 offset in that unit. */
  offsets: number[];
}

function fold(units: readonly string[]): FoldedText {
  const key: string[] = [];
  const unitOf: number[] = [];
  const offsetOf: number[] = [];
  units.forEach((text, unit) => {
    let offset = 0;
    while (offset < text.length) {
      const width = codePointWidth(text, offset);
      const code = text.charCodeAt(offset);
      // ASCII, nearly all of most texts, without a `normalize` per character.
      const folded =
        code < 0x80
          ? code >= 0x41 && code <= 0x5a
            ? String.fromCharCode(code + 0x20)
            : text[offset]
          : text.slice(offset, offset + width).normalize("NFD").toLowerCase();
      for (let index = 0; index < folded.length; index += 1) {
        if (!isCompared(folded.charCodeAt(index))) continue;
        key.push(folded[index]);
        unitOf.push(unit);
        offsetOf.push(offset);
      }
      offset += width;
    }
  });
  return { key: key.join(""), units: unitOf, offsets: offsetOf };
}

function isCompared(code: number): boolean {
  if (code < 0x80) {
    return (code >= 0x30 && code <= 0x39) || (code >= 0x61 && code <= 0x7a);
  }
  return !IGNORED_RANGES.some(([low, high]) => code >= low && code <= high);
}

function codePointWidth(text: string, offset: number): number {
  const code = text.charCodeAt(offset);
  return code >= 0xd800 && code <= 0xdbff && offset + 1 < text.length ? 2 : 1;
}

/** The whole passage, then shrinking windows around its first match. */
function searchWindows(
  length: number,
  markStart: number,
  markEnd: number,
): [number, number][] {
  const windows: [number, number][] = [[0, length]];
  for (const context of FALLBACK_CONTEXTS) {
    const from = Math.max(0, markStart - context);
    const to = Math.min(length, markEnd + context);
    const [lastFrom, lastTo] = windows[windows.length - 1];
    if (to - from < MIN_FALLBACK_KEY || (from === lastFrom && to === lastTo)) continue;
    windows.push([from, to]);
  }
  return windows;
}

/**
 * The matched words of the window `[from, to)` of the passage, found at
 * `shift + from` in the text, as ranges of the units they were read from.
 */
function describeMatch(
  units: readonly string[],
  text: FoldedText,
  shift: number,
  from: number,
  to: number,
  marked: readonly boolean[],
): LocatedPassage | null {
  const marks: PassageRange[] = [];
  let previous = -1;
  for (let index = from; index < to; index += 1) {
    if (!marked[index]) continue;
    const unit = text.units[index + shift];
    const start = text.offsets[index + shift];
    const end = start + codePointWidth(units[unit], start);
    const last = marks[marks.length - 1];
    // One range per run of matched characters within a unit; whatever the fold
    // dropped between them (an apostrophe, a hyphen) is part of the word.
    if (last && previous === index - 1 && last.unit === unit) {
      last.end = Math.max(last.end, end);
    } else {
      marks.push({ unit, start, end });
    }
    previous = index;
  }
  if (marks.length === 0) return null;
  return { anchor: { unit: marks[0].unit, offset: marks[0].start }, marks };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Segments back to the `<mark>`-tagged, escaped form `parseHighlightSnippet` reads. */
function serializeSegments(segments: readonly HighlightSegment[]): string {
  return segments
    .map((segment) =>
      segment.highlighted
        ? `<mark>${escapeHtml(segment.text)}</mark>`
        : escapeHtml(segment.text),
    )
    .join("");
}
