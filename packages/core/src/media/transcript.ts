/**
 * The full text of a media, as the reader draws it.
 *
 * The backend serves a transcript as plain text whose paragraphs are separated
 * by a blank line and never exceed ~900 characters (task-232), so the client
 * only splits on blank lines. A leading "Speaker N:" is kept apart when
 * diarization put one there. Same rules as `mobile/src/components/TranscriptReader.tsx`,
 * shared with the web app from here.
 */

const PARAGRAPH_SEPARATOR = /\n[ \t]*\n+/;
const SPEAKER_PREFIX = /^(Speaker\s+\d+)\s*:\s*/i;

export type TranscriptParagraph = {
  /** Speaker label without its trailing colon, when the paragraph carries one. */
  speaker: string | null;
  text: string;
};

export function splitTranscriptParagraphs(content: string): TranscriptParagraph[] {
  return content
    .split(PARAGRAPH_SEPARATOR)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const match = block.match(SPEAKER_PREFIX);
      if (!match) return { speaker: null, text: block };
      return { speaker: match[1], text: block.slice(match[0].length) };
    });
}

/** The primary subtag of a language code, upper-cased ("EN"), or null. */
export function languageTag(code: string | null | undefined): string | null {
  const primary = code?.trim().split(/[-_]/)[0]?.toUpperCase();
  return primary || null;
}

/** The link to the source, when the stored URL is one a browser can open. */
export function resolveSourceLink(rawUrl: string | null | undefined): { url: string; host: string } | null {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.replace(/^www\./, "");
    return host ? { url: trimmed, host } : null;
  } catch {
    return null;
  }
}
