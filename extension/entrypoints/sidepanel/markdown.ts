import { type Block, parseChatMarkdown, type Span } from "@media-summarizer/core/chat/markdown";
import { webDomain } from "@media-summarizer/core/chat/webSources";
import { icon } from "../../lib/icons";
import { el } from "./dom";

/**
 * Markdown drawn as elements through the shared reader (`core/chat/markdown`),
 * never as HTML: nothing a model or a page wrote can run here.
 *
 * - In an answer, `[S1]` names the media the panel already shows: left out, as
 *   the app does in a media's own conversation. A web page cited (`[W1]`) is a
 *   chip with the site's name that opens it.
 * - In a source's text (`transcript`), a tag stays literal text.
 */
export interface MarkdownOptions {
  live?: boolean;
  transcript?: boolean;
  /** The web pages an answer cites, by tag (`W1`). */
  webSources?: ReadonlyMap<string, string>;
}

export function drawMarkdown(parent: HTMLElement, text: string, options: MarkdownOptions = {}): void {
  drawBlocks(parent, parseChatMarkdown(text, { live: options.live ?? false }), options);
}

function drawBlocks(parent: HTMLElement, blocks: readonly Block[], options: MarkdownOptions): void {
  for (const block of blocks) {
    if (block.kind === "paragraph" || block.kind === "heading") {
      const element = el(block.kind === "paragraph" ? "p" : "h4");
      drawSpans(element, block.spans, options);
      parent.append(element);
    } else if (block.kind === "list") {
      const list = el(block.items[0]?.ordered ? "ol" : "ul");
      for (const entry of block.items) {
        const item = el("li");
        if (entry.ordered) item.value = entry.number;
        item.style.marginInlineStart = `${entry.depth * 16}px`;
        drawSpans(item, entry.spans, options);
        list.append(item);
      }
      parent.append(list);
    } else if (block.kind === "quote") {
      const quote = el("blockquote");
      drawBlocks(quote, block.blocks, options);
      parent.append(quote);
    } else if (block.kind === "code") {
      parent.append(el("pre", {}, el("code", { text: block.text })));
    } else if (block.kind === "rule") {
      parent.append(el("hr"));
    } else {
      const table = el("table");
      const head = table.createTHead().insertRow();
      for (const cell of block.header) drawSpans(head.appendChild(el("th")), cell, options);
      const body = table.createTBody();
      for (const row of block.rows) {
        const line = body.insertRow();
        for (const cell of row) drawSpans(line.insertCell(), cell, options);
      }
      parent.append(el("div", { className: "table-wrap" }, table));
    }
  }
}

function drawSpans(parent: HTMLElement, spans: readonly Span[], options: MarkdownOptions): void {
  for (const span of spans) {
    if (span.kind === "citation") {
      if (options.transcript) parent.append(span.refs.join(" "));
      continue;
    }
    if (span.kind === "webCitation") {
      if (options.transcript) { parent.append(`[${span.ref}]`); continue; }
      const url = options.webSources?.get(span.ref);
      if (!url || !/^https?:\/\//i.test(url)) continue;
      parent.append(" ", el("a", { className: "cite-web", attrs: { href: url, target: "_blank", rel: "noopener noreferrer" } }, icon("globe-outline", 13), webDomain(url)));
      continue;
    }
    let node: Node = document.createTextNode(span.text);
    for (const [on, tag] of [[span.code, "code"], [span.italic, "em"], [span.bold, "strong"]] as const) {
      if (on) node = el(tag, {}, node);
    }
    parent.append(node);
  }
}
