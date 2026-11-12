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

/**
 * Closes the text of a web article whose page reserves the rest to subscribers
 * (`media_summarizer/infrastructure/resolvers/article_markdown.py`). A `## [`
 * heading like the sections of a page with videos, so a translation keeps it.
 */
const INCOMPLETE_MARKER = /^[ \t]*## \[incomplete\][ \t]*$/m;
/** A first paragraph entirely in bold: the standfirst the page declared. */
const LEAD = /^\*\*([^*\n]+)\*\*[ \t]*(?:\n[ \t]*\n+|$)/;

export type ArticleText = {
  /** The standfirst, without its bold markers, drawn larger than the body. */
  lead: string | null;
  /** The rest of the text, to draw as any text. */
  body: string;
  /** The page reserves the rest of the article: the text stops where it does. */
  incomplete: boolean;
};

/**
 * The parts of a text the readers draw apart from its body: the standfirst of a
 * web article and the mark that the article goes on behind a paywall (TestFlight
 * feedback ANPCT7VWg0qWWuHgKePMPXA). Any other text comes back whole as `body`.
 */
export function splitArticleText(content: string): ArticleText {
  const incomplete = INCOMPLETE_MARKER.test(content);
  const text = (incomplete ? content.replace(INCOMPLETE_MARKER, "") : content).trim();
  const lead = LEAD.exec(text);
  return {
    lead: lead ? lead[1].trim() : null,
    body: lead ? text.slice(lead[0].length).trim() : text,
    incomplete,
  };
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
