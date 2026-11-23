import { browser } from "wxt/browser";

/**
 * Reading the tab the reader clicked on — the page and the selection — through
 * `scripting.executeScript`, which `activeTab` opens to that tab only, and only
 * on the click, the context menu or the shortcut. Nothing is read before, nor
 * on any other tab: no content script, no host permission.
 *
 * The page goes to the server as cleaned HTML, which extracts it exactly as a
 * page it downloads itself (owner decision of 2026-11-17, way A of
 * docs/research/task-490-paywalled-page-capture/README.md): a paid or signed-in
 * page then arrives as the reader sees it.
 */

/** The server's own ceiling for a page (`ARTICLE_EXTRACT_MAX_HTML_BYTES`). */
const PAGE_HTML_MAX_BYTES = 2_000_000;

/**
 * Runs in the page. The document without what carries no text — measured
 * lossless for the extraction (task-490 §2) — or `null` past the ceiling: a cut
 * document reads badly, the address alone is sent instead. `null` too for a
 * document that is not HTML (a feed shown as XML): the server takes any page it
 * receives for an HTML page, whatever its address says.
 */
function cleanedDocument(maxBytes: number): string | null {
  if (document.contentType !== "text/html") return null;
  const copy = document.documentElement.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("script, style, noscript, svg, iframe, template, link").forEach((node) => node.remove());
  copy.querySelectorAll("[style]").forEach((node) => node.removeAttribute("style"));
  const html = `<!doctype html>\n${copy.outerHTML}`;
  return new TextEncoder().encode(html).length <= maxBytes ? html : null;
}

/** Runs in the page: the selection with its line breaks, which `selectionText` turns into spaces. */
function selectedText(): string {
  return window.getSelection()?.toString() ?? "";
}

/** The cleaned page, or `null` where the browser keeps pages from extensions (stores, settings, PDF viewer). */
export async function readPage(tabId: number): Promise<string | null> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: cleanedDocument,
      args: [PAGE_HTML_MAX_BYTES],
    });
    return typeof injection?.result === "string" ? injection.result : null;
  } catch {
    return null;
  }
}

/** The selection as the page holds it, or `null` when the frame cannot be read. */
export async function readSelection(tabId: number, frameId: number | undefined): Promise<string | null> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId ?? 0] },
      func: selectedText,
    });
    const text = typeof injection?.result === "string" ? injection.result : "";
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}
