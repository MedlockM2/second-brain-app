/**
 * The Markdown of a chat answer, read into blocks the thread can draw.
 *
 * The model writes its answers in Markdown — bold lead-ins, bullet and numbered
 * lists, the odd heading — and cites its sources with the corpus tags `[S1]`,
 * `[S2]`… (`llm_corpus.source_label`). Printed as plain text, all of it showed:
 * the `**` and the `- ` of every item, and opaque tags no reader could map back
 * to a media.
 *
 * A local reader rather than a Markdown library, for three reasons:
 *
 * - The subset is small and known — what a chat model writes, not arbitrary
 *   documents: paragraphs, headings, lists (nested), quotes, code, rules; bold,
 *   italic, inline code and links inline. Tables are not read: an answer kept to
 *   "a few short paragraphs" (`chat_prompt.chat_instructions`) has none.
 * - A citation is a first-class inline token here, not text a renderer has to
 *   find again after the fact.
 * - An answer is read while it is being written. `live` mode treats what has not
 *   arrived yet as still to come: a `**` without its closer bolds what follows
 *   instead of showing, and a delimiter or tag cut in half by a fragment
 *   boundary (`*`, `[S1`, a lone `-` starting a line) is held back until the
 *   next fragment completes it. A finished answer is read strictly: an unclosed
 *   delimiter is then a literal character.
 *
 * Pure TypeScript with no React Native import, so it is as at home in the
 * thread as anywhere else an answer has to be read.
 */

export interface TextSpan {
  kind: "text";
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

export interface CitationSpan {
  kind: "citation";
  /** The tags cited together, in order and without duplicates: `[S2]`, `[S5]`. */
  refs: string[];
}

export type Span = TextSpan | CitationSpan;

export interface ListItem {
  ordered: boolean;
  /** The item's number in its list; meaningful when `ordered`. */
  number: number;
  /** 0 for a top-level item, 1 and 2 for nested ones (deeper nests are drawn at 2). */
  depth: number;
  spans: Span[];
}

export type Block =
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "heading"; level: 1 | 2 | 3; spans: Span[] }
  | { kind: "list"; items: ListItem[] }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "code"; text: string }
  | { kind: "rule" };

export interface ChatMarkdownOptions {
  /** The answer is still being written: what is unfinished is held back, not printed. */
  live: boolean;
}

const MAX_DEPTH = 2;

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const ITEM = /^(\s*)(?:([-*+\u2022])|(\d{1,3})[.)])\s+(.*)$/;
/** A last line that is only the start of a block marker the next fragment will finish. */
const PARTIAL_MARKER = /^\s*(?:#{1,6}|[-*+\u2022]|\d{1,3}[.)]?|>|`{1,3}\w*|~{1,3}\w*)\s*$/;

const CITATION = /^\[S\d+(?:\s*[,;]\s*S?\d+)*\]/;
/** The beginning of a tag cut by the end of what has arrived: `[`, `[S`, `[S1`, `[S1, S`. */
const PARTIAL_CITATION = /^\[(?:S\d*(?:\s*[,;]\s*S?\d*)*)?$/;
const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)/;
const ESCAPABLE = "\\`*_[]()#+-.!>~|";
/** Latin letters with their accents: what `_` must not open or close inside of. */
const WORD_CHAR = /[\w\u00C0-\u024F]/;
const SPACE = /\s/;

/** The blocks of an answer, for drawing. */
export function parseChatMarkdown(source: string, { live }: ChatMarkdownOptions): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (live && lines.length > 0 && PARTIAL_MARKER.test(lines[lines.length - 1])) {
    lines.pop();
  }
  return parseBlocks(lines, live);
}

/** Every tag the blocks cite, in order of first citation. */
export function citedRefs(blocks: readonly Block[]): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const visitSpans = (spans: readonly Span[]) => {
    for (const span of spans) {
      if (span.kind !== "citation") continue;
      for (const ref of span.refs) {
        if (seen.has(ref)) continue;
        seen.add(ref);
        refs.push(ref);
      }
    }
  };
  const visit = (list: readonly Block[]) => {
    for (const block of list) {
      switch (block.kind) {
        case "paragraph":
        case "heading":
          visitSpans(block.spans);
          break;
        case "list":
          block.items.forEach((item) => visitSpans(item.spans));
          break;
        case "quote":
          visit(block.blocks);
          break;
        default:
          break;
      }
    }
  };
  visit(blocks);
  return refs;
}

/**
 * The spans with only the citations worth drawing.
 *
 * A tag `keep` refuses is removed, and a citation left with no tag goes with the
 * space that set it apart from its sentence — "poursuivi [S1]." reads
 * "poursuivi." rather than "poursuivi .".
 */
export function keepCitations(spans: readonly Span[], keep: (ref: string) => boolean): Span[] {
  const out: Span[] = [];
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    if (span.kind === "text") {
      out.push(span);
      continue;
    }
    const refs = span.refs.filter(keep);
    if (refs.length > 0) {
      out.push({ kind: "citation", refs });
      continue;
    }
    const previous = out[out.length - 1];
    const next = spans[index + 1];
    const nextText = next?.kind === "text" ? next.text : "";
    if (previous?.kind === "text" && (nextText === "" || /^[\s.,;:!?)\]]/.test(nextText))) {
      const trimmed = previous.text.replace(/\s+$/, "");
      if (trimmed) out[out.length - 1] = { ...previous, text: trimmed };
      else out.pop();
    }
  }
  return out;
}

// --- Blocks -----------------------------------------------------------------

function indentWidth(indent: string): number {
  return indent.replace(/\t/g, "    ").length;
}

/** `live`: the end of these lines is the end of an answer still being written. */
function parseBlocks(lines: readonly string[], live: boolean): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let items: { ordered: boolean; number: number; depth: number; text: string }[] = [];
  let indents: number[] = [];
  let counters: (number | null)[] = [];
  /** Whether the open list's top-level items are numbered; null with no list open. */
  let topOrdered: boolean | null = null;
  let blankSinceItem = false;

  // Only what reaches the end of the lines can still be completed by the next
  // fragment: a block closed by a blank line or another block is read strictly.
  const flushParagraph = (atEnd = false) => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join("\n"), atEnd) });
    paragraph = [];
  };
  const flushList = (atEnd = false) => {
    if (items.length === 0) return;
    const last = items.length - 1;
    blocks.push({
      kind: "list",
      items: items.map((item, position) => ({
        ordered: item.ordered,
        number: item.number,
        depth: item.depth,
        spans: parseInline(item.text, atEnd && position === last),
      })),
    });
    items = [];
    indents = [];
    counters = [];
    topOrdered = null;
    blankSinceItem = false;
  };
  const flushAll = (atEnd = false) => {
    flushParagraph(atEnd);
    flushList(atEnd);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const fence = FENCE.exec(line);
    if (fence) {
      flushAll();
      const marker = fence[1];
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(marker)) {
        body.push(lines[index]);
        index += 1;
      }
      // An unclosed fence runs to the end: a code block still being written.
      if (body.length > 0) blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      if (items.length > 0) blankSinceItem = true;
      continue;
    }

    if (RULE.test(line)) {
      flushAll();
      blocks.push({ kind: "rule" });
      continue;
    }

    const item = ITEM.exec(line);
    if (item) {
      flushParagraph();
      const indent = indentWidth(item[1]);
      const ordered = item[3] !== undefined;
      // Bullets after numbers, or numbers after bullets, at the top: a new list.
      if (topOrdered !== null && topOrdered !== ordered && indent <= indents[0]) flushList();
      while (indents.length > 0 && indent < indents[indents.length - 1]) indents.pop();
      if (indents.length === 0 || indent > indents[indents.length - 1]) indents.push(indent);
      const depth = Math.min(indents.length - 1, MAX_DEPTH);
      if (depth === 0) topOrdered = ordered;
      counters = counters.slice(0, depth + 1);
      const previous = counters[depth];
      const number = ordered
        ? typeof previous === "number"
          ? previous + 1
          : Number(item[3])
        : 0;
      counters[depth] = ordered ? number : null;
      items.push({ ordered, number, depth, text: item[4] });
      blankSinceItem = false;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      const atEnd = live && index === lines.length - 1;
      blocks.push({ kind: "heading", level, spans: parseInline(heading[2], atEnd) });
      continue;
    }

    if (QUOTE.test(line)) {
      flushAll();
      const inner: string[] = [];
      while (index < lines.length) {
        const quoted = QUOTE.exec(lines[index]);
        if (!quoted) break;
        inner.push(quoted[1]);
        index += 1;
      }
      const quoteBlocks = parseBlocks(inner, live && index === lines.length);
      index -= 1;
      if (quoteBlocks.length > 0) blocks.push({ kind: "quote", blocks: quoteBlocks });
      continue;
    }

    if (items.length > 0) {
      // A line under an item belongs to it, unless a blank line closed the list
      // and the line is not indented under the item.
      if (!blankSinceItem || /^\s{2,}/.test(line)) {
        const last = items[items.length - 1];
        last.text = last.text ? `${last.text}\n${line.trim()}` : line.trim();
        blankSinceItem = false;
        continue;
      }
      flushList();
    }

    paragraph.push(line.trim());
  }

  flushAll(live);
  return blocks;
}

// --- Inline -----------------------------------------------------------------

interface InlineStyle {
  bold: boolean;
  italic: boolean;
  code: boolean;
}

const PLAIN: InlineStyle = { bold: false, italic: false, code: false };

function parseInline(source: string, live: boolean): Span[] {
  const spans: Span[] = [];
  walk(source, PLAIN, live, spans);
  return groupCitations(spans);
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

function isSpace(char: string | undefined): boolean {
  return char === undefined || SPACE.test(char);
}

function refsOf(tag: string): string[] {
  return tag
    .slice(1, -1)
    .split(/[,;]/)
    .map((part) => part.trim().replace(/^S?/, ""))
    .filter((digits) => digits.length > 0)
    .map((digits) => `[S${digits}]`);
}

/**
 * Where the emphasis opened by `delimiter` closes, or -1.
 *
 * A closer follows a non-space character; `_` also has to end a word, so that
 * `snake_case` stays a word. A single `*` skips the `**` of a nested bold, and
 * a `***` run closes both levels at once.
 */
function findCloser(source: string, from: number, delimiter: string): number {
  const char = delimiter[0];
  let cursor = from;
  while (cursor < source.length) {
    const at = source.indexOf(char, cursor);
    if (at === -1) return -1;
    let run = 1;
    while (source[at + run] === char) run += 1;
    const closes =
      at > from && !isSpace(source[at - 1]) && (char === "*" || !isWordChar(source[at + run]));
    if (closes) {
      if (delimiter.length === 2 && run >= 2) return run === 3 ? at + 1 : at;
      if (delimiter.length === 1 && run !== 2) return at + run - 1;
    }
    cursor = at + run;
  }
  return -1;
}

/**
 * Reads `source` into `out`, in `style`.
 *
 * `live` is true only for a run that reaches the end of an answer still being
 * written — the one place where what is missing may still arrive.
 */
function walk(source: string, style: InlineStyle, live: boolean, out: Span[]): void {
  let text = "";
  const pushText = () => {
    if (!text) return;
    out.push({ kind: "text", text, ...style });
    text = "";
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index];

    if (char === "\\" && index + 1 < source.length && ESCAPABLE.includes(source[index + 1])) {
      text += source[index + 1];
      index += 2;
      continue;
    }

    if (char === "`") {
      const close = source.indexOf("`", index + 1);
      if (close > index + 1) {
        pushText();
        out.push({ kind: "text", text: source.slice(index + 1, close), ...style, code: true });
        index = close + 1;
        continue;
      }
      if (live && close === -1) {
        pushText();
        const rest = source.slice(index + 1);
        if (rest) out.push({ kind: "text", text: rest, ...style, code: true });
        return;
      }
      text += char;
      index += 1;
      continue;
    }

    if (char === "[") {
      const rest = source.slice(index);
      const citation = CITATION.exec(rest);
      if (citation) {
        pushText();
        out.push({ kind: "citation", refs: refsOf(citation[0]) });
        index += citation[0].length;
        continue;
      }
      if (live && PARTIAL_CITATION.test(rest)) {
        pushText();
        return;
      }
      const link = LINK.exec(rest);
      if (link) {
        pushText();
        walk(link[1], style, false, out);
        index += link[0].length;
        continue;
      }
      text += char;
      index += 1;
      continue;
    }

    if (char === "*" || char === "_") {
      const double = source[index + 1] === char;
      const delimiter = double ? char + char : char;
      const after = source[index + delimiter.length];
      const before = source[index - 1];
      const canOpen = !isSpace(after) && (char === "*" || !isWordChar(before));
      const inner: InlineStyle = double ? { ...style, bold: true } : { ...style, italic: true };
      if (canOpen) {
        const close = findCloser(source, index + delimiter.length, delimiter);
        if (close !== -1) {
          pushText();
          walk(source.slice(index + delimiter.length, close), inner, false, out);
          index = close + delimiter.length;
          continue;
        }
        if (live) {
          // Opened and not closed yet: what follows is emphasised as it arrives.
          pushText();
          walk(source.slice(index + delimiter.length), inner, true, out);
          return;
        }
      } else if (live && after === undefined) {
        // `*` that may become `**`, or `**` waiting for its first word.
        pushText();
        return;
      }
      text += delimiter;
      index += delimiter.length;
      continue;
    }

    text += char;
    index += 1;
  }
  pushText();
}

/** `[S2] [S5]` and `[S2][S5]` are one citation of two sources, not two citations. */
function groupCitations(spans: readonly Span[]): Span[] {
  const out: Span[] = [];
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    if (span.kind !== "citation") {
      out.push(span);
      continue;
    }
    const refs = [...span.refs];
    while (index + 1 < spans.length) {
      const next = spans[index + 1];
      const afterNext = spans[index + 2];
      if (next.kind === "citation") {
        refs.push(...next.refs);
        index += 1;
      } else if (next.text.trim() === "" && afterNext?.kind === "citation") {
        refs.push(...afterNext.refs);
        index += 2;
      } else {
        break;
      }
    }
    out.push({ kind: "citation", refs: [...new Set(refs)] });
  }
  return out;
}
