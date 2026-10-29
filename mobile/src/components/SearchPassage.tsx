/**
 * The search passage a media page was opened on, as the reader body draws it.
 *
 * A search hit opens its media on the words its excerpt quotes rather than at
 * the top of the text (`@media-summarizer/core/media/searchPassage`). The page
 * (`CompletedDetailView`) holds the passage and owns the scroll; the body that
 * draws the text (`TranscriptReader`, `MarkdownBody`) finds the passage in its
 * own pieces with `locateSearchPassage`, highlights the matched words with
 * `PassageMarks`, and reports through `useSearchPassageAnchor` where the first of
 * them landed.
 */

import React, { useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  type NativeMethods,
  type TextLayoutEvent,
} from "react-native";
import type { PassageRange } from "@media-summarizer/core/media/searchPassage";
import type { Theme } from "../constants/theme";
import { useThemedStyles } from "../contexts/ThemeContext";

/** An element the page can measure against its scroll content. */
export type SearchPassageNode = Pick<NativeMethods, "measureLayout">;

/** Where the passage landed: the element holding its first match, and how far down it that match's line starts. */
export interface SearchPassageTarget {
  node: SearchPassageNode;
  offsetY: number;
}

/** What the page hands the reader body while the passage is being shown. */
export interface SearchPassageFocus {
  /** The `<mark>`-tagged excerpt, as `searchPassageFromSnippet` bounded it. */
  passage: string;
  /** Called every time the element holding the first match is laid out again. */
  onLayout: (target: SearchPassageTarget) => void;
}

/** The props that make one element of the body the passage's anchor. */
export interface SearchPassageAnchorProps {
  ref: (node: SearchPassageNode | null) => void;
  onLayout: () => void;
  /** Only for a `Text` anchor: finds the line the first match sits on. */
  onTextLayout: (event: TextLayoutEvent) => void;
}

/**
 * The anchor props for the body's element that holds the first match.
 *
 * `offset` is where that match starts in the element's text, and picks its line
 * out of the text layout; `null` for an element that is not text (a table, a
 * code block), which is measured from its top.
 */
export function useSearchPassageAnchor(
  focus: SearchPassageFocus | null | undefined,
  offset: number | null,
): SearchPassageAnchorProps {
  const nodeRef = useRef<SearchPassageNode | null>(null);
  const lineYRef = useRef(0);

  const report = useCallback(() => {
    if (focus && nodeRef.current) {
      focus.onLayout({ node: nodeRef.current, offsetY: lineYRef.current });
    }
  }, [focus]);

  const ref = useCallback((node: SearchPassageNode | null) => {
    nodeRef.current = node;
    lineYRef.current = 0;
  }, []);

  const onTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      if (offset === null) return;
      let consumed = 0;
      let lineY = 0;
      for (const line of event.nativeEvent.lines) {
        lineY = line.y;
        consumed += line.text.length;
        if (consumed > offset) break;
      }
      lineYRef.current = lineY;
      report();
    },
    [offset, report],
  );

  return { ref, onLayout: report, onTextLayout };
}

/**
 * `text` with the matched words of the passage drawn on the search highlight,
 * the same amber the result's excerpt showed them on. Colours only: a weight
 * change would rewrap the paragraph when the highlight goes.
 *
 * `marks` are ranges of the unit the passage was searched in; `shift` is where
 * `text` starts in that unit (after a speaker label, say). Rendered inside the
 * caller's `Text`.
 */
export function PassageMarks({
  text,
  marks,
  shift = 0,
}: {
  text: string;
  marks: readonly PassageRange[];
  shift?: number;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, index) => {
    const start = Math.max(cursor, mark.start - shift);
    const end = Math.min(text.length, mark.end - shift);
    if (end <= start) return;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <Text key={index} style={styles.match}>
        {text.slice(start, end)}
      </Text>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    match: {
      backgroundColor: Colors.highlight,
      color: Colors.onHighlight,
    },
  });
