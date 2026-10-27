/**
 * A source body or chat answer, drawn from its Markdown (see `@media-summarizer/core/chat/markdown`).
 *
 * Laid out for reading: a paragraph's gap between blocks, a smaller one between
 * the items of a list, and the 1.6 line height the design system asks of all
 * body text.
 *
 * Inline citations open their sources. Paragraph accessibility actions also
 * expose each link when a screen reader groups nested text as one element.
 *
 * `showSources` is false in a media's own conversation: its one source is the
 * page the conversation is opened on, so every tag would name what is already on
 * screen. Its tags are then left out altogether.
 *
 * A source body opened from a search hit gets `passageFocus` (see
 * `SearchPassage`): the passage is looked for block by block — list items one by
 * one — its matched words are highlighted in the text blocks they fall in, and
 * the block holding the first one is the anchor the page measures. A quote, a
 * table or a code block is an anchor as a whole, with no highlight inside.
 */

import React, { useMemo } from "react";
import {
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { BorderRadius, Spacing, Typography, type Theme } from "../constants/theme";
import { useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";
import {
  keepCitations,
  parseChatMarkdown,
  type Block,
  type ListItem,
  type Span,
} from "@media-summarizer/core/chat/markdown";
import { resolveMediaTitle } from "../lib/mediaTitle";
import type { ChatSource } from "@media-summarizer/core/types/chat";
import {
  locateSearchPassage,
  type PassageRange,
} from "@media-summarizer/core/media/searchPassage";
import {
  PassageMarks,
  useSearchPassageAnchor,
  type SearchPassageAnchorProps,
  type SearchPassageFocus,
} from "./SearchPassage";

export interface MarkdownBodyProps {
  text: string;
  /** The answer is still being written. */
  live?: boolean;
  /** The conversation's sources, by tag. A tag absent from it is not drawn. */
  sources?: ReadonlyMap<string, ChatSource>;
  showSources?: boolean;
  /** Source text preserves literal citation tags and permits text selection. */
  transcript?: boolean;
  onOpenSource?: (source: ChatSource) => void;
  /** A source body opened from a search hit: the passage to highlight and report. */
  passageFocus?: SearchPassageFocus | null;
}

const EMPTY_SOURCES: ReadonlyMap<string, ChatSource> = new Map();
const ignoreSource = () => {};
const NO_MARKS: readonly PassageRange[] = [];

/** One piece of a source body the search passage is looked for in. */
type PassageUnit = {
  /** Index of the top-level block. */
  block: number;
  /** Index of the item, for a list: each item is its own piece. */
  item: number | null;
  /** The text as drawn: citations of a source body are drawn as their tags. */
  text: string;
};

/** Where a block or list item sits in the source body; `block` is null when nested in a quote. */
type PassagePosition = { block: number | null; item: number | null };

const NOWHERE: PassagePosition = { block: null, item: null };

function spansText(spans: readonly Span[]): string {
  return spans
    .map((span) => (span.kind === "text" ? span.text : span.refs.join(" ")))
    .join("");
}

function blockText(block: Block): string {
  switch (block.kind) {
    case "paragraph":
    case "heading":
      return spansText(block.spans);
    case "list":
      return block.items.map((item) => spansText(item.spans)).join(" ");
    case "quote":
      return block.blocks.map(blockText).join(" ");
    case "table":
      return [block.header, ...block.rows].flat().map(spansText).join(" ");
    case "code":
      return block.text;
    case "rule":
      return "";
  }
}

function passageUnits(blocks: readonly Block[]): PassageUnit[] {
  return blocks.flatMap((block, index): PassageUnit[] =>
    block.kind === "list"
      ? block.items.map((item, position) => ({
          block: index,
          item: position,
          text: spansText(item.spans),
        }))
      : [{ block: index, item: null, text: blockText(block) }],
  );
}

/** Characters of a title an inline citation keeps; the accessible link names it whole. */
const SHORT_TITLE_LENGTH = 28;

/** Bullet, white bullet, small square: one per nesting level. */
const BULLETS = ["\u2022", "\u25E6", "\u25AA"] as const;

/** Keeps a citation's tag in one piece and pads its highlight (a nested Text takes no padding). */
const NO_BREAK_SPACE = "\u00A0";

/** The title cut at a word boundary, so a tag stays a tag and not half a line. */
function shortTitle(title: string): string {
  if (title.length <= SHORT_TITLE_LENGTH) return title;
  const cut = title.slice(0, SHORT_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > SHORT_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,;:.|\-\u2013\u2014]+$/, "")}\u2026`;
}

function sourceTitle(source: ChatSource): string {
  return resolveMediaTitle({ title: source.title });
}

export function MarkdownBody({
  text,
  live = false,
  sources = EMPTY_SOURCES,
  showSources = false,
  transcript = false,
  onOpenSource = ignoreSource,
  passageFocus,
}: MarkdownBodyProps): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const { width: windowWidth } = useWindowDimensions();
  const blocks = useMemo(() => parseChatMarkdown(text, { live }), [text, live]);
  const keep = (ref: string) => transcript || (showSources && sources.has(ref));

  // The search passage, in a source body only: citations are drawn as their tags
  // there, which is what `spansText` reads.
  const passage = transcript ? passageFocus?.passage ?? null : null;
  const units = useMemo(() => (passage ? passageUnits(blocks) : []), [passage, blocks]);
  const located = useMemo(
    () => (passage ? locateSearchPassage(units.map((unit) => unit.text), passage) : null),
    [passage, units],
  );
  const anchorUnit = located ? units[located.anchor.unit] : null;
  const anchorIsText =
    anchorUnit !== null &&
    (anchorUnit.item !== null ||
      blocks[anchorUnit.block].kind === "paragraph" ||
      blocks[anchorUnit.block].kind === "heading");
  const anchor = useSearchPassageAnchor(
    passageFocus,
    located && anchorIsText ? located.anchor.offset : null,
  );
  const isAnchor = (at: PassagePosition) =>
    anchorUnit !== null && anchorUnit.block === at.block && anchorUnit.item === at.item;
  const anchorProps = (at: PassagePosition): Partial<SearchPassageAnchorProps> =>
    isAnchor(at) ? anchor : {};
  // A quote, a table or a code block is not one `Text`: no line to find in it.
  const viewAnchorProps = (
    block: number | null,
  ): Partial<Pick<SearchPassageAnchorProps, "ref" | "onLayout">> =>
    isAnchor({ block, item: null }) ? { ref: anchor.ref, onLayout: anchor.onLayout } : {};
  const marksAt = (at: PassagePosition): readonly PassageRange[] => {
    if (!located || at.block === null) return NO_MARKS;
    const unit = units.findIndex(
      (candidate) => candidate.block === at.block && candidate.item === at.item,
    );
    return located.marks.filter((mark) => mark.unit === unit);
  };

  const spoken = (spans: readonly Span[]): string | undefined => {
    if (transcript) return undefined;
    if (!spans.some((span) => span.kind === "citation")) return undefined;
    return spans
      .map((span) =>
        span.kind === "text"
          ? span.text
          : ` (${span.refs
              .map((ref) => {
                const source = sources.get(ref);
                return t("chat.thread.sourceA11y", { title: source ? sourceTitle(source) : "" });
              })
              .join(", ")})`,
      )
      .join("");
  };

  // `marks` are ranges of the text these spans draw (`spansText`): each span
  // highlights the part of them that falls in it.
  const renderSpans = (spans: readonly Span[], marks: readonly PassageRange[] = NO_MARKS) => {
    let drawn = 0;
    return spans.map((span, index) => {
      if (span.kind === "text") {
        const start = drawn;
        drawn += span.text.length;
        const speaker = transcript && index === 0 ? /^(Speaker\s+\d+)\s*:\s*/i.exec(span.text) : null;
        const body = speaker ? span.text.slice(speaker[0].length) : span.text;
        const shift = start + (speaker ? speaker[0].length : 0);
        const shown = marks.length > 0 ? <PassageMarks text={body} marks={marks} shift={shift} /> : body;
        return (
          <Text
            key={index}
            style={[
              span.bold && styles.bold,
              span.italic && styles.italic,
              span.code && styles.inlineCode,
            ]}
          >
            {speaker ? <><Text style={styles.bold}>{speaker[1]}: </Text>{shown}</> : shown}
          </Text>
        );
      }
      if (transcript) {
        drawn += span.refs.join(" ").length;
        return <Text key={index}>{span.refs.join(" ")}</Text>;
      }
      const previous = spans[index - 1];
      const spaced = previous?.kind === "text" && !/\s$/.test(previous.text);
      return (
        <Text key={index}>
          {spaced ? " " : ""}
          {span.refs.map((ref, position) => {
            const source = sources.get(ref);
            if (!source) return null;
            return (
              <Text key={ref}>
                {position > 0 ? " " : ""}
                <Text
                  style={styles.citation}
                  onPress={() => onOpenSource(source)}
                  accessibilityRole="link"
                  accessibilityLabel={t("chat.thread.openSourceA11y", { title: sourceTitle(source) })}
                  suppressHighlighting={false}
                >
                  {`${NO_BREAK_SPACE}${shortTitle(sourceTitle(source))}${NO_BREAK_SPACE}`}
                </Text>
              </Text>
            );
          })}
        </Text>
      );
    });
  };

  const citationActions = (spans: readonly Span[]) =>
    [...new Set(spans.flatMap((span) => span.kind === "citation" ? span.refs : []))]
      .flatMap((ref) => {
        const source = sources.get(ref);
        return source ? [{ name: ref, label: t("chat.thread.openSourceA11y", { title: sourceTitle(source) }) }] : [];
      });

  const openAccessibleSource = (ref: string) => {
    const source = sources.get(ref);
    if (source) onOpenSource(source);
  };

  const renderParagraph = (
    spans: readonly Span[],
    key: React.Key,
    style: StyleProp<TextStyle> = styles.paragraph,
    at: PassagePosition = NOWHERE,
  ) => {
    const shown = keepCitations(spans, keep);
    return (
      <Text key={key} selectable={transcript} style={style} accessibilityLabel={spoken(shown)}
        accessibilityActions={citationActions(shown)}
        onAccessibilityAction={(event) => openAccessibleSource(event.nativeEvent.actionName)}
        {...anchorProps(at)}
      >
        {renderSpans(shown, marksAt(at))}
      </Text>
    );
  };

  const renderItem = (item: ListItem, key: React.Key, at: PassagePosition) => (
    <View key={key} style={[styles.item, { paddingStart: item.depth * Spacing.md }]}>
      {/* A bullet is layout and stays silent; a number is read, since it may be a step. */}
      <Text
        style={[styles.marker, item.ordered ? styles.orderedMarker : styles.bulletMarker]}
        importantForAccessibility={item.ordered ? "auto" : "no"}
        accessibilityElementsHidden={!item.ordered}
      >
        {item.ordered ? `${item.number}.` : BULLETS[item.depth] ?? BULLETS[0]}
      </Text>
      {renderParagraph(item.spans, "text", [styles.paragraph, styles.itemText], at)}
    </View>
  );

  // `top` is the block's index among the top-level blocks, which is how the
  // search passage names it; `null` for a block nested in a quote.
  const renderBlock = (block: Block, key: React.Key, top: number | null): React.ReactNode => {
    switch (block.kind) {
      case "paragraph":
        return renderParagraph(block.spans, key, styles.paragraph, { block: top, item: null });
      case "heading":
        return (
          <Text
            key={key}
            selectable={transcript}
            style={block.level === 3 ? styles.subheading : styles.heading}
            accessibilityRole="header"
            accessibilityActions={citationActions(keepCitations(block.spans, keep))}
            onAccessibilityAction={(event) => openAccessibleSource(event.nativeEvent.actionName)}
            {...anchorProps({ block: top, item: null })}
          >
            {renderSpans(keepCitations(block.spans, keep), marksAt({ block: top, item: null }))}
          </Text>
        );
      case "list":
        return (
          <View key={key} style={styles.list}>
            {block.items.map((item, index) =>
              renderItem(item, index, top === null ? NOWHERE : { block: top, item: index }))}
          </View>
        );
      case "quote":
        return (
          <View key={key} style={styles.quote} {...viewAnchorProps(top)}>
            {block.blocks.map((inner, index) => renderBlock(inner, index, null))}
          </View>
        );
      case "table": {
        const width = Math.max(160, (windowWidth - Spacing.lg * 2) / Math.min(2, block.header.length));
        const row = (cells: Span[][], header: boolean, index: React.Key) => (
          <View key={index} style={[styles.tableRow, header && styles.tableHeader]}>
            {cells.map((cell, column) => (
              <View key={column} style={[styles.cell, { width }]}>
                <Text selectable={transcript} accessibilityRole={header ? "header" : undefined}
                  style={[styles.paragraph, header && styles.bold, { textAlign: block.align[column] }]}>
                  {renderSpans(keepCitations(cell, keep))}
                </Text>
              </View>
            ))}
          </View>
        );
        return (
          <ScrollView key={key} horizontal nestedScrollEnabled directionalLockEnabled
            style={styles.table} contentContainerStyle={styles.tableContent}
            showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
            <View {...viewAnchorProps(top)}>
              {row(block.header, true, "header")}
              {block.rows.map((cells, index) => row(cells, false, index))}
            </View>
          </ScrollView>
        );
      }
      case "code":
        return (
          <View key={key} style={styles.codeBlock} {...viewAnchorProps(top)}>
            <Text selectable={transcript} style={styles.codeText}>{block.text}</Text>
          </View>
        );
      case "rule":
        return <View key={key} style={styles.rule} />;
    }
  };

  return (
    <View style={styles.answer}>
      {blocks.map((block, index) => renderBlock(block, index, index))}
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    table: { maxWidth: "100%", borderRadius: BorderRadius.md },
    tableContent: { paddingBottom: Spacing.sm },
    tableRow: { flexDirection: "row", backgroundColor: Colors.surfaceContainerLow },
    tableHeader: { backgroundColor: Colors.surfaceContainerHigh },
    cell: { padding: Spacing.sm },
    answer: {
      gap: Spacing.md,
    },
    paragraph: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textMain,
    },
    heading: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    subheading: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    bold: {
      fontWeight: Typography.headline.fontWeight,
    },
    italic: {
      fontStyle: "italic",
    },
    inlineCode: {
      fontSize: Typography.label.fontSize,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    citation: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.onHighlight,
      backgroundColor: Colors.highlight,
    },
    list: {
      gap: Spacing.sm,
    },
    item: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    marker: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textSubtle,
    },
    bulletMarker: {
      minWidth: Spacing.md,
      textAlign: "center",
    },
    orderedMarker: {
      minWidth: Spacing.lg,
      fontWeight: Typography.label.fontWeight,
    },
    itemText: {
      flex: 1,
    },
    // The callout aside of DESIGN.md: a 4px primary bar on a 5% primary wash.
    quote: {
      gap: Spacing.sm,
      borderStartWidth: Spacing.xs,
      borderStartColor: Colors.primary,
      backgroundColor: Colors.primaryTint,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    codeBlock: {
      backgroundColor: Colors.surfaceContainer,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    codeText: {
      fontSize: Typography.label.fontSize,
      color: Colors.textMain,
    },
    // A tonal band rather than a 1px line (the "No-Line" rule).
    rule: {
      height: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainer,
    },
  });
