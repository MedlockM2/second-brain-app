/**
 * The web pages a chat answer cites (task-614, drawn per task-615).
 *
 * An answer cites a web page with a `[W1]` tag, resolved through the message's
 * `web_sources` (or, while it is written, the latest list the stream sent). These
 * helpers are shared by the mobile and the web thread so both name a page, list
 * the pages and copy an answer the same way.
 */

import type { ChatWebSource } from "../types/chat";

const WEB_TAG = /\[(W\d+)\]/g;

/** The site a page is on, without `www.`: what the inline citation shows. */
export function webDomain(url: string): string {
  const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url)?.[1] ?? url;
  return host.toLowerCase().replace(/^www\./, "");
}

/** The title a page is named by: its own, else its site. */
export function webTitle(source: ChatWebSource): string {
  return source.title?.trim() || webDomain(source.url);
}

/** The sources by tag (`W1` → source). */
export function webSourcesByRef(
  sources: readonly ChatWebSource[] | null | undefined,
): ReadonlyMap<string, ChatWebSource> {
  return new Map((sources ?? []).map((source) => [source.ref, source]));
}

/**
 * The pages to list under an answer: the cited ones, once per URL, in order of
 * first citation. A source the text never tags is left out.
 */
export function citedWebSources(
  text: string,
  sources: readonly ChatWebSource[] | null | undefined,
): ChatWebSource[] {
  const byRef = webSourcesByRef(sources);
  const seen = new Set<string>();
  const out: ChatWebSource[] = [];
  for (const match of text.matchAll(WEB_TAG)) {
    const source = byRef.get(match[1]);
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    out.push(source);
  }
  return out;
}

/** The answer as copied: each `[W#]` becomes `[title](url)`, never a bare tag. */
export function withWebLinks(
  text: string,
  sources: readonly ChatWebSource[] | null | undefined,
): string {
  const byRef = webSourcesByRef(sources);
  if (byRef.size === 0) return text;
  return text.replace(WEB_TAG, (tag, ref: string) => {
    const source = byRef.get(ref);
    return source ? `[${webTitle(source).replace(/[[\]]/g, "")}](${source.url})` : tag;
  });
}
