/**
 * A web page read together with the videos it embeds, as the reader draws it.
 *
 * The backend stores such a page as one Markdown text in which every part opens
 * with a `## [...]` heading (`media_summarizer/core/web_page.py`,
 * `compose_sections`):
 *
 *     ## [page] Frénésie : photos, vidéos, recrutement
 *     …the page's text…
 *     ## [video 1/3 · 1:14 · vimeo · https://i.vimeocdn.com/…] Rencontrez Benoît
 *     …what is said in the video…
 *
 * The tag in brackets is never translated (the translation prompt keeps it), so
 * a translated text parses the same. A text without such a heading is not
 * sectioned and is drawn as before: `parseTranscriptSections` returns null.
 */

export type TranscriptSection =
  | { kind: "page"; title: string | null; body: string }
  | {
      kind: "video";
      title: string | null;
      body: string;
      /** 1-based position among the page's videos, and their count. */
      index: number;
      count: number;
      durationSeconds: number | null;
      provider: string | null;
      thumbnailUrl: string | null;
    };

const HEADING = /^## \[(page|video)([^\]]*)\][ \t]*(.*)$/;

function parseClock(value: string): number | null {
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function videoFields(tag: string) {
  // " 1/3 · 1:14 · vimeo · https://…" — position first, then optional fields.
  const fields = tag
    .split("·")
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
  const position = /^(\d+)\s*\/\s*(\d+)$/.exec(fields.shift() ?? "");
  let durationSeconds: number | null = null;
  let provider: string | null = null;
  let thumbnailUrl: string | null = null;
  for (const field of fields) {
    if (field.startsWith("https://")) thumbnailUrl = field;
    else if (/^\d+(:\d{1,2}){1,2}$/.test(field)) durationSeconds = parseClock(field);
    else if (/^[a-z0-9_-]+$/i.test(field)) provider = field.toLowerCase();
  }
  return {
    index: position ? Number(position[1]) : 0,
    count: position ? Number(position[2]) : 0,
    durationSeconds,
    provider,
    thumbnailUrl,
  };
}

/** The sections of a page-with-videos text, or null for any other text. */
export function parseTranscriptSections(content: string): TranscriptSection[] | null {
  const lines = content.split(/\r?\n/);
  const sections: TranscriptSection[] = [];
  let current: TranscriptSection | null = null;
  let body: string[] = [];

  const close = () => {
    if (current) sections.push({ ...current, body: body.join("\n").trim() });
    body = [];
  };

  for (const line of lines) {
    const match = HEADING.exec(line.trim());
    if (!match) {
      body.push(line);
      continue;
    }
    close();
    const title = match[3].trim() || null;
    current =
      match[1] === "page"
        ? { kind: "page", title, body: "" }
        : { kind: "video", title, body: "", ...videoFields(match[2]) };
  }
  close();

  if (!sections.some((section) => section.kind === "video")) return null;
  return sections;
}

/** "1:14" for a chip, or null when the length is unknown. */
export function formatSectionClock(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}
