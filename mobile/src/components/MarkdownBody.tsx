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
}

const EMPTY_SOURCES: ReadonlyMap<string, ChatSource> = new Map();
const ignoreSource = () => {};

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
}: MarkdownBodyProps): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const { width: windowWidth } = useWindowDimensions();
  const blocks = useMemo(() => parseChatMarkdown(text, { live }), [text, live]);
  const keep = (ref: string) => transcript || (showSources && sources.has(ref));

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

  const renderSpans = (spans: readonly Span[]) =>
    spans.map((span, index) => {
      if (span.kind === "text") {
        const speaker = transcript && index === 0 ? /^(Speaker\s+\d+)\s*:\s*/i.exec(span.text) : null;
        return (
          <Text
            key={index}
            style={[
              span.bold && styles.bold,
              span.italic && styles.italic,
              span.code && styles.inlineCode,
            ]}
          >
            {speaker ? <><Text style={styles.bold}>{speaker[1]}: </Text>{span.text.slice(speaker[0].length)}</> : span.text}
          </Text>
        );
      }
      if (transcript) return <Text key={index}>{span.refs.join(" ")}</Text>;
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
  ) => {
    const shown = keepCitations(spans, keep);
    return (
      <Text key={key} selectable={transcript} style={style} accessibilityLabel={spoken(shown)}
        accessibilityActions={citationActions(shown)}
        onAccessibilityAction={(event) => openAccessibleSource(event.nativeEvent.actionName)}
      >
        {renderSpans(shown)}
      </Text>
    );
  };

  const renderItem = (item: ListItem, key: React.Key) => (
    <View key={key} style={[styles.item, { paddingStart: item.depth * Spacing.md }]}>
      {/* A bullet is layout and stays silent; a number is read, since it may be a step. */}
      <Text
        style={[styles.marker, item.ordered ? styles.orderedMarker : styles.bulletMarker]}
        importantForAccessibility={item.ordered ? "auto" : "no"}
        accessibilityElementsHidden={!item.ordered}
      >
        {item.ordered ? `${item.number}.` : BULLETS[item.depth] ?? BULLETS[0]}
      </Text>
      {renderParagraph(item.spans, "text", [styles.paragraph, styles.itemText])}
    </View>
  );

  const renderBlock = (block: Block, key: React.Key): React.ReactNode => {
    switch (block.kind) {
      case "paragraph":
        return renderParagraph(block.spans, key);
      case "heading":
        return (
          <Text
            key={key}
            selectable={transcript}
            style={block.level === 3 ? styles.subheading : styles.heading}
            accessibilityRole="header"
            accessibilityActions={citationActions(keepCitations(block.spans, keep))}
            onAccessibilityAction={(event) => openAccessibleSource(event.nativeEvent.actionName)}
          >
            {renderSpans(keepCitations(block.spans, keep))}
          </Text>
        );
      case "list":
        return (
          <View key={key} style={styles.list}>
            {block.items.map((item, index) => renderItem(item, index))}
          </View>
        );
      case "quote":
        return (
          <View key={key} style={styles.quote}>
            {block.blocks.map((inner, index) => renderBlock(inner, index))}
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
            <View>
              {row(block.header, true, "header")}
              {block.rows.map((cells, index) => row(cells, false, index))}
            </View>
          </ScrollView>
        );
      }
      case "code":
        return (
          <View key={key} style={styles.codeBlock}>
            <Text selectable={transcript} style={styles.codeText}>{block.text}</Text>
          </View>
        );
      case "rule":
        return <View key={key} style={styles.rule} />;
    }
  };

  return (
    <View style={styles.answer}>
      {blocks.map((block, index) => renderBlock(block, index))}
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
