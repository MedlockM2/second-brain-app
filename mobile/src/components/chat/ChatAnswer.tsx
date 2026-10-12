/**
 * One answer of the chat, drawn from its Markdown (see `@media-summarizer/core/chat/markdown`).
 *
 * Laid out for reading: a paragraph's gap between blocks, a smaller one between
 * the items of a list, and the 1.6 line height the design system asks of all
 * body text.
 *
 * A citation names its source. The tags the model writes (`[S5]`) say nothing
 * to a reader, so each is drawn as a small tag carrying the short title of the
 * media it designates, and the media an answer cites are listed under it once
 * it is written, each one a row that opens the media. Inline tags are not
 * touchable on purpose: inside a line of text they cannot reach the 48px a
 * touch target needs, the rows below can.
 *
 * `showSources` is false in a media's own conversation: its one source is the
 * page the conversation is opened on, so every tag would name what is already on
 * screen. Its tags are then left out altogether.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import {
  citedRefs,
  keepCitations,
  parseChatMarkdown,
  type Block,
  type ListItem,
  type Span,
} from "@media-summarizer/core/chat/markdown";
import { resolveMediaTitle } from "../../lib/mediaTitle";
import type { ChatSource } from "@media-summarizer/core/types/chat";

export interface ChatAnswerProps {
  text: string;
  /** The answer is still being written. */
  live: boolean;
  /** The conversation's sources, by tag. A tag absent from it is not drawn. */
  sources: ReadonlyMap<string, ChatSource>;
  showSources: boolean;
  onOpenSource: (source: ChatSource) => void;
}

/** Characters of a title an inline citation keeps; the list under the answer shows it whole. */
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

export function ChatAnswer({
  text,
  live,
  sources,
  showSources,
  onOpenSource,
}: ChatAnswerProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const blocks = useMemo(() => parseChatMarkdown(text, { live }), [text, live]);
  const cited = useMemo(
    () =>
      showSources
        ? citedRefs(blocks)
            .map((ref) => sources.get(ref))
            .filter((source): source is ChatSource => source !== undefined)
        : [],
    [blocks, showSources, sources],
  );

  const keep = (ref: string) => showSources && sources.has(ref);

  const spoken = (spans: readonly Span[]): string | undefined => {
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
        return (
          <Text
            key={index}
            style={[
              span.bold && styles.bold,
              span.italic && styles.italic,
              span.code && styles.inlineCode,
            ]}
          >
            {span.text}
          </Text>
        );
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
                <Text style={styles.citation}>
                  {`${NO_BREAK_SPACE}${shortTitle(sourceTitle(source))}${NO_BREAK_SPACE}`}
                </Text>
              </Text>
            );
          })}
        </Text>
      );
    });

  const renderParagraph = (
    spans: readonly Span[],
    key: React.Key,
    style: StyleProp<TextStyle> = styles.paragraph,
  ) => {
    const shown = keepCitations(spans, keep);
    return (
      <Text key={key} style={style} accessibilityLabel={spoken(shown)}>
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
            style={block.level === 3 ? styles.subheading : styles.heading}
            accessibilityRole="header"
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
      case "code":
        return (
          <View key={key} style={styles.codeBlock}>
            <Text style={styles.codeText}>{block.text}</Text>
          </View>
        );
      case "rule":
        return <View key={key} style={styles.rule} />;
    }
  };

  return (
    <View style={styles.answer}>
      {blocks.map((block, index) => renderBlock(block, index))}
      {!live && cited.length > 0 ? (
        <View style={styles.sources}>
          <Text style={styles.sourcesLabel} accessibilityRole="header">
            {t("chat.thread.sources")}
          </Text>
          {cited.map((source) => {
            const title = sourceTitle(source);
            return (
              <Pressable
                key={source.ref}
                style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
                onPress={() => onOpenSource(source)}
                accessibilityRole="button"
                accessibilityLabel={t("chat.thread.openSourceA11y", { title })}
              >
                <Ionicons name="document-text-outline" size={18} color={Colors.textSubtle} />
                <Text style={styles.sourceTitle} numberOfLines={2}>
                  {title}
                </Text>
                <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={16} color={Colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
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
    sources: {
      gap: Spacing.xs,
    },
    sourcesLabel: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textSubtle,
    },
    sourceRow: {
      minHeight: TouchTarget.minimum,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerLow,
    },
    sourceRowPressed: {
      backgroundColor: Colors.surfaceContainer,
    },
    sourceTitle: {
      flex: 1,
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
  });
