import { SEARCH_PASSAGE_HIGHLIGHT_MS, locateSearchPassage } from "@media-summarizer/core/media/searchPassage";
import { useEffect, useState, type RefObject } from "react";

/** What the stylesheet draws the found words with: `::highlight(search-passage)`. */
const HIGHLIGHT = "search-passage";
/** Room left above the matched line: about two lines of the reader's text. */
const LEAD_PX = 48;
/** Text the reader draws that is not the source's own: paragraph numbers, the section head. */
const NOT_SOURCE_TEXT = ".pn, .reader-head";

/** The element that scrolls the reader: the reading pane's body, or the page. */
function scrollParent(node: HTMLElement): HTMLElement {
  for (let element = node.parentElement; element; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element);
    if (overflowY === "auto" || overflowY === "scroll") return element;
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement;
}

/**
 * Bring the reader to the passage a search result quoted, and highlight its
 * matched words for a few seconds — the web half of what the mobile reader does
 * (`mobile/src/components/SearchPassage.tsx`).
 *
 * The passage is looked for in the text nodes of `container` as drawn, prose or
 * Markdown alike, with `locateSearchPassage`. The scroll keeps following it while
 * what sits above it settles (the cover, "L'essentiel"), and stops at the first
 * wheel, touch, click or key: from then on the scroll is the reader's. A passage
 * the text does not hold — a hit on the title alone — changes nothing.
 *
 * `text` is the body on screen: the passage is looked for again when it changes.
 * The index holds the reading language, so a translated media shows the passage
 * in its translation, and a switch to the original no longer holds it.
 */
export function useSearchPassage(container: RefObject<HTMLElement | null>, passage: string | null, text: string | null): void {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const root = container.current;
    if (!active || !passage || !text || !root) return undefined;

    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest(NOT_SOURCE_TEXT) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
    const located = locateSearchPassage(
      nodes.map((node) => node.data),
      passage,
    );
    if (!located) return undefined;

    const ranges = located.marks.map((mark) => {
      const range = document.createRange();
      range.setStart(nodes[mark.unit], mark.start);
      range.setEnd(nodes[mark.unit], mark.end);
      return range;
    });
    const scroller = scrollParent(root);
    let following = true;
    const align = () => {
      if (!following) return;
      const viewportTop = scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
      scroller.scrollTop += ranges[0].getBoundingClientRect().top - viewportTop - LEAD_PX;
    };
    const stop = () => {
      following = false;
    };

    align();
    const observer = new ResizeObserver(align);
    for (const child of Array.from(scroller.children)) observer.observe(child);
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchstart", stop, { passive: true });
    scroller.addEventListener("pointerdown", stop);
    window.addEventListener("keydown", stop);
    // Older browsers without the Custom Highlight API still get the scroll.
    const registry = typeof Highlight === "undefined" ? null : CSS.highlights;
    registry?.set(HIGHLIGHT, new Highlight(...ranges));
    const timer = window.setTimeout(() => setActive(false), SEARCH_PASSAGE_HIGHLIGHT_MS);

    return () => {
      window.clearTimeout(timer);
      registry?.delete(HIGHLIGHT);
      observer.disconnect();
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchstart", stop);
      scroller.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [active, container, passage, text]);
}
