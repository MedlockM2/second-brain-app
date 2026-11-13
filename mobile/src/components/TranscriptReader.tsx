/**
 * The readable body of a media item: the "Full text" section of the Reader tab
 * of `CompletedDetailView`.
 *
 * Rendering only — fetching, translation polling and retrying live in the screen
 * that owns the state, and are handed over through `content`. That split is what
 * lets the screen keep loading (and keep a translation poll alive) while the
 * user is looking at another tab.
 *
 * The title row can carry one control, `translationToggle`: on a media served
 * translated, the way back to what was actually said (task-419).
 *
 * Opened from a search hit, the body also finds the passage the hit quoted,
 * highlights its matched words and reports where they landed (`passageFocus`,
 * see `SearchPassage`), so the page can open on them.
 *
 * Memoised because its parent re-renders as the page scrolls past the points
 * where the collapsed bar and its tabs appear, and this is the one subtree whose
 * size grows with the source: a long transcript is hundreds of `Text` nodes that
 * have nothing to redraw when a bar fades in above them.
 */

import { hasStructuredMarkdown } from "@media-summarizer/core/chat/markdown";
import { locateSearchPassage } from "@media-summarizer/core/media/searchPassage";
import { splitArticleText } from "@media-summarizer/core/media/transcript";
import {
  formatSectionClock,
  parseTranscriptSections,
  type TranscriptSection,
} from "@media-summarizer/core/media/transcriptSections";
import { Image } from "expo-image";
import { MarkdownBody } from "./MarkdownBody";
import {
  PassageMarks,
  useSearchPassageAnchor,
  type SearchPassageFocus,
} from "./SearchPassage";
import React, { memo, useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";
import type {
  MediaStatusResponse,
  ProcessingJobLifecycleStatus,
} from "@media-summarizer/core/types/media";

/**
 * Lifecycle of the transcript body, as fetched by the owning screen.
 *
 * The three `translation_*` states carry the original text, and each says so
 * above it: still being translated and polled, still being translated but no
 * longer polled (`translation_stalled`, the poll's budget is spent — task-415),
 * or failed for good. Only `ready` is shown as the text to read.
 */
export type TranscriptContentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "translation_pending"; content: string }
  | { status: "translation_stalled"; content: string }
  | { status: "translation_failed"; content: string }
  | { status: "not_available" }
  | { status: "error"; message: string };

/** Blank-line separator between transcript paragraphs, tolerating trailing spaces. */
const PARAGRAPH_SEPARATOR = /\n[ \t]*\n+/;
/** Optional in-band speaker label emitted when Deepgram diarization is enabled. */
const SPEAKER_PREFIX = /^(Speaker\s+\d+)\s*:\s*/i;

type TranscriptParagraph = {
  /** Speaker label without its trailing colon, when the paragraph carries one. */
  speaker: string | null;
  text: string;
};

/**
 * The switch between the translation and the source text, on the title row.
 *
 * `null` on the prop when there is nothing to switch to — a media already in the
 * reading language, or a translation that has not landed yet — and then nothing
 * is rendered at all, not a disabled control (task-419).
 *
 * The screen decides all of it: what the two bodies are, which one is on screen,
 * and whether a read of the source text is in flight. This component only names
 * the language the tap switches *to*, which is what the label says.
 */
export type TranscriptTranslationToggle = {
  /** Whether the body currently on screen is the source text. */
  showingOriginal: boolean;
  /** Short tag of the language the tap switches to, for the visible label ("EN"). */
  languageCode: string;
  /** Its name, for the label a screen reader reads out ("English"). */
  languageName: string;
  /** A read of the source text is in flight; the pill shows it and ignores taps. */
  busy: boolean;
  onToggle: () => void;
};

/** A paragraph as it is drawn: its speaker label, then its text. */
function paragraphText(paragraph: TranscriptParagraph): string {
  return paragraph.speaker ? `${paragraph.speaker}: ${paragraph.text}` : paragraph.text;
}

/**
 * Splits the API's plain-text transcript into renderable paragraphs.
 *
 * The backend guarantees paragraphs are separated by a blank line and that no
 * paragraph exceeds ~900 characters (task-232, benchmark task-231 option B), so
 * there is deliberately no re-chunking heuristic on the client: legacy
 * single-block transcripts are already re-structured server-side at read time.
 */
function splitTranscriptParagraphs(content: string): TranscriptParagraph[] {
  return content
    .split(PARAGRAPH_SEPARATOR)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const match = block.match(SPEAKER_PREFIX);
      if (!match) {
        return { speaker: null, text: block };
      }
      return {
        speaker: match[1],
        text: block.slice(match[0].length),
      };
    });
}

interface TranscriptReaderProps {
  transcript: MediaStatusResponse["media_item"]["transcript"];
  processingStatus: ProcessingJobLifecycleStatus;
  content: TranscriptContentState;
  onRetry: () => void;
  /** Look for the translation again, from the stalled line. */
  onCheckTranslation: () => void;
  /**
   * The translation / source-text switch on the title row, or `null` when the
   * body on screen is not a translation and there is nothing to switch to.
   */
  translationToggle: TranscriptTranslationToggle | null;
  /** The search passage to highlight and report, or nothing outside a search. */
  passageFocus?: SearchPassageFocus | null;
  /**
   * Scroll the page to a part of a page-with-videos text (a chip was pressed).
   * Only the page that scrolls passes it; without it the chips are not shown.
   */
  onJumpTo?: (node: View) => void;
  /**
   * Open the source in the browser, from the notice of an article whose page
   * reserves the rest to subscribers; `null` when the source cannot be opened.
   */
  onOpenSource?: (() => void) | null;
}

export const TranscriptReader = memo(function TranscriptReader({
  transcript,
  processingStatus,
  content,
  onRetry,
  onCheckTranslation,
  translationToggle,
  passageFocus,
  onJumpTo,
  onOpenSource,
}: TranscriptReaderProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  if (!transcript) {
    return (
      <View style={styles.empty}>
        <Ionicons
          name="document-text-outline"
          size={32}
          color={Colors.textMuted}
        />
        <Text style={styles.emptyText}>{t("transcript.empty")}</Text>
        {processingStatus !== "completed" &&
          processingStatus !== "failed" &&
          processingStatus !== "cancelled" && (
            <Text style={styles.emptyHint}>{t("transcript.emptyHint")}</Text>
          )}
      </View>
    );
  }

  const statusMessages: Record<string, string> = {
    pending: t("transcript.status.pending"),
    extracting: t("transcript.status.extracting"),
    transcribing: t("transcript.status.transcribing"),
    ready: t("transcript.status.ready"),
    failed: t("transcript.status.failed"),
  };

  const isReady = transcript.status === "ready";
  const isFailed = transcript.status === "failed";
  const isProcessing = !isReady && !isFailed;

  return (
    <View style={styles.container}>
      {/* The title, and to its right the switch between the translation and the
          source text. The switch sits here rather than under the text because it
          governs the whole section, and the section can be hundreds of
          paragraphs long — a control at the bottom would never be seen. */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t("transcript.heading")}
        </Text>
        {translationToggle ? (
          <TranslationToggle toggle={translationToggle} />
        ) : null}
      </View>

      {/* When the transcript is ready, surface the actual content inline.
          Until it's ready (or if fetching the body fails), keep the status row
          so the user knows where things stand. */}
      {isReady ? (
        <TranscriptContent
          state={content}
          onRetry={onRetry}
          onCheckTranslation={onCheckTranslation}
          passageFocus={passageFocus}
          onJumpTo={onJumpTo}
          onOpenSource={onOpenSource}
        />
      ) : (
        <View style={styles.statusRow}>
          {isProcessing && (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={styles.statusGlyph}
            />
          )}
          {isFailed && (
            <Ionicons
              name="close-circle"
              size={16}
              color={Colors.error}
              style={styles.statusGlyph}
            />
          )}
          <Text
            style={[styles.statusText, isFailed && styles.statusTextFailed]}
          >
            {statusMessages[transcript.status] || t("artifacts.processing")}
          </Text>
        </View>
      )}
    </View>
  );
});

/**
 * The pill on the title row that swaps the translation for the source text.
 *
 * Deliberately the same pill as the "Check again" of the stalled line: one shape
 * for the two secondary controls this section can carry, rather than a third
 * button style in the same view.
 *
 * The label names the language it switches *to* — "View the original (EN)" while
 * the translation is on screen, "View the translation (FR)" once it is not — so
 * a tap's outcome is readable before making it. The spoken label spells that
 * language out in full, where there is no width to save.
 */
function TranslationToggle({
  toggle,
}: {
  toggle: TranscriptTranslationToggle;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { showingOriginal, languageCode, languageName, busy } = toggle;
  return (
    <Pressable
      style={[styles.checkTranslationButton, styles.headerPill]}
      onPress={busy ? undefined : toggle.onToggle}
      accessibilityLabel={
        showingOriginal
          ? t("transcript.viewTranslationA11y", { language: languageName })
          : t("transcript.viewOriginalA11y", { language: languageName })
      }
      accessibilityRole="button"
      accessibilityState={{ busy }}
      testID="transcript-toggle-original"
    >
      {busy ? <ActivityIndicator size="small" color={Colors.textMain} /> : null}
      <Text style={styles.checkTranslationText}>
        {showingOriginal
          ? t("transcript.viewTranslation", { language: languageCode })
          : t("transcript.viewOriginal", { language: languageCode })}
      </Text>
    </Pressable>
  );
}

/**
 * Prose keeps its paragraph and speaker rendering; structured extractions share
 * the Markdown reader used by chat answers.
 *
 * The backend stores and serves transcripts as plain text whose paragraphs are
 * separated by a blank line (task-232, benchmark task-231 option B), so the
 * client only has to split on blank lines — no heuristic here.
 *
 * A leading "Speaker N:" prefix is optional per paragraph (it only appears when
 * Deepgram diarization is enabled) and is rendered as a nested Text so the label
 * reflows with the body copy instead of becoming its own block.
 *
 * The search passage is looked for paragraph by paragraph, as they are drawn:
 * its matched words are highlighted wherever they fall, and the paragraph holding
 * the first one is the anchor the page measures.
 */
function TranscriptText({
  content,
  passageFocus,
  onJumpTo,
  onOpenSource,
}: {
  content: string;
  passageFocus?: SearchPassageFocus | null;
  onJumpTo?: (node: View) => void;
  onOpenSource?: (() => void) | null;
}) {
  const sections = useMemo(() => parseTranscriptSections(content), [content]);
  if (sections) {
    return (
      <SectionedTranscript
        sections={sections}
        passageFocus={passageFocus}
        onJumpTo={onJumpTo}
        onOpenSource={onOpenSource}
      />
    );
  }
  return <TranscriptBody content={content} passageFocus={passageFocus} onOpenSource={onOpenSource} />;
}

/**
 * A web article's standfirst opens the text one size up, and an article whose
 * page reserves the rest ends on a notice saying so (`splitArticleText`). In
 * prose the standfirst is the first paragraph the search passage is looked for
 * in; above a structured text it stands on its own.
 */
function TranscriptBody({
  content,
  passageFocus,
  onOpenSource,
}: {
  content: string;
  passageFocus?: SearchPassageFocus | null;
  onOpenSource?: (() => void) | null;
}) {
  const styles = useThemedStyles(makeStyles);
  const article = useMemo(() => splitArticleText(content), [content]);
  const structured = useMemo(() => hasStructuredMarkdown(article.body), [article.body]);
  const paragraphs = useMemo(() => {
    const body = splitTranscriptParagraphs(article.body);
    return article.lead && !structured ? [{ speaker: null, text: article.lead }, ...body] : body;
  }, [article, structured]);
  const passage = passageFocus?.passage ?? null;
  const located = useMemo(
    () =>
      passage && !structured
        ? locateSearchPassage(paragraphs.map(paragraphText), passage)
        : null,
    [passage, structured, paragraphs],
  );
  const anchor = useSearchPassageAnchor(
    passageFocus,
    located?.anchor.offset ?? null,
  );
  const notice = article.incomplete ? <IncompleteNotice onOpenSource={onOpenSource} /> : null;
  if (structured) {
    return (
      <>
        {article.lead ? (
          <Text selectable style={[styles.paragraph, styles.lead]}>
            {article.lead}
          </Text>
        ) : null}
        <MarkdownBody text={article.body} transcript passageFocus={passageFocus} />
        {notice}
      </>
    );
  }

  if (paragraphs.length === 0) {
    return notice;
  }

  return (
    <View style={styles.body}>
      {paragraphs.map((paragraph, index) => {
        const marks = located?.marks.filter((mark) => mark.unit === index) ?? [];
        return (
          <Text
            key={index}
            selectable
            style={[
              styles.paragraph,
              index === 0 && article.lead !== null && styles.lead,
              index === paragraphs.length - 1 && styles.paragraphLast,
            ]}
            {...(located?.anchor.unit === index ? anchor : {})}
          >
            {paragraph.speaker ? (
              <Text style={styles.speaker}>{paragraph.speaker}: </Text>
            ) : null}
            {marks.length > 0 ? (
              <PassageMarks
                text={paragraph.text}
                marks={marks}
                shift={paragraphText(paragraph).length - paragraph.text.length}
              />
            ) : (
              paragraph.text
            )}
          </Text>
        );
      })}
      {notice}
    </View>
  );
}

/**
 * The end of an article whose page reserves the rest to its subscribers: the
 * text stops there, the summary and the chat cover only that part, and the rest
 * is on the site.
 */
function IncompleteNotice({ onOpenSource }: { onOpenSource?: (() => void) | null }) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.incomplete}>
      <Ionicons name="lock-closed-outline" size={20} color={Colors.textSubtle} />
      <View style={styles.incompleteText}>
        <Text style={styles.incompleteTitle}>{t("transcript.incomplete.title")}</Text>
        <Text style={styles.incompleteBody}>{t("transcript.incomplete.body")}</Text>
        {onOpenSource ? (
          <Pressable
            onPress={onOpenSource}
            accessibilityRole="link"
            style={({ pressed }) => [styles.incompleteLink, pressed && styles.incompleteLinkPressed]}
          >
            <Ionicons name="open-outline" size={16} color={Colors.textMain} />
            <Text style={styles.incompleteLinkText}>{t("transcript.incomplete.open")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const PROVIDER_NAMES: Record<string, string> = {
  vimeo: "Vimeo",
  youtube: "YouTube",
  dailymotion: "Dailymotion",
  wistia: "Wistia",
  loom: "Loom",
};

function SectionGlyph({ kind }: { kind: TranscriptSection["kind"] }) {
  const Colors = useThemeColors();
  return (
    <Ionicons
      name={kind === "page" ? "document-text-outline" : "play"}
      size={16}
      color={Colors.primaryInk}
    />
  );
}

/**
 * A web page read with the videos it embeds (`parseTranscriptSections`): a row
 * of chips naming what the page holds, then each part under its own heading —
 * the page's text, then each video with its thumbnail, title and length — so the
 * reader always knows whether they are reading the page or what was said in a
 * video. Each part's body is drawn exactly like any other text.
 *
 * The chips jump to their section through `onJumpTo`, which only the page that
 * scrolls can honour; without it (the chat's view of the source) they are left
 * out.
 */
function SectionedTranscript({
  sections,
  passageFocus,
  onJumpTo,
  onOpenSource,
}: {
  sections: TranscriptSection[];
  passageFocus?: SearchPassageFocus | null;
  onJumpTo?: (node: View) => void;
  onOpenSource?: (() => void) | null;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useThemeColors();
  const nodes = useRef<(View | null)[]>([]);
  const jump = useCallback(
    (index: number) => {
      const node = nodes.current[index];
      if (node && onJumpTo) onJumpTo(node);
    },
    [onJumpTo],
  );

  return (
    <View style={styles.body}>
      {onJumpTo ? (
        <View style={styles.sectionChips}>
          {sections.map((section, index) => {
            const label =
              section.kind === "page"
                ? t("transcript.section.pageChip")
                : [
                    t("transcript.section.videoChip", { index: section.index }),
                    formatSectionClock(section.durationSeconds),
                  ]
                    .filter(Boolean)
                    .join(" · ");
            return (
              <Pressable
                key={index}
                onPress={() => jump(index)}
                accessibilityRole="button"
                accessibilityLabel={t("transcript.section.jumpA11y", { label })}
                style={({ pressed }) => [styles.sectionChip, pressed && styles.sectionChipPressed]}
              >
                <Ionicons
                  name={section.kind === "page" ? "document-text-outline" : "play"}
                  size={14}
                  color={Colors.textMain}
                />
                <Text style={styles.sectionChipText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {sections.map((section, index) => {
        const kicker =
          section.kind === "page"
            ? t("transcript.section.page")
            : t("transcript.section.video", { index: section.index, count: section.count });
        const meta =
          section.kind === "video"
            ? [
                formatSectionClock(section.durationSeconds),
                section.provider ? PROVIDER_NAMES[section.provider] ?? null : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "";
        return (
          <View
            key={index}
            ref={(node) => {
              nodes.current[index] = node;
            }}
            style={index > 0 ? styles.sectionSpaced : undefined}
          >
            <View style={styles.sectionKicker} accessibilityRole="header">
              <SectionGlyph kind={section.kind} />
              <Text style={styles.sectionKickerText}>{kicker}</Text>
              <View style={styles.sectionRule} />
            </View>
            {section.kind === "video" ? (
              <View style={styles.sectionVideo}>
                <View style={styles.sectionThumb}>
                  {section.thumbnailUrl ? (
                    <Image
                      source={{ uri: section.thumbnailUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                  <View style={styles.sectionPlay}>
                    <Ionicons name="play" size={12} color={Colors.onPrimary} />
                  </View>
                </View>
                <View style={styles.sectionVideoText}>
                  {section.title ? (
                    <Text style={styles.sectionVideoTitle} numberOfLines={2}>
                      {section.title}
                    </Text>
                  ) : null}
                  {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
                </View>
              </View>
            ) : null}
            <TranscriptBody content={section.body} passageFocus={passageFocus} onOpenSource={onOpenSource} />
          </View>
        );
      })}
    </View>
  );
}

function TranscriptContent({
  state,
  onRetry,
  onCheckTranslation,
  passageFocus,
  onJumpTo,
  onOpenSource,
}: {
  state: TranscriptContentState;
  onRetry: () => void;
  onCheckTranslation: () => void;
  passageFocus?: SearchPassageFocus | null;
  onJumpTo?: (node: View) => void;
  onOpenSource?: (() => void) | null;
}) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (state.status === "ready") {
    return (
      <View>
        <TranscriptText
          content={state.content}
          passageFocus={passageFocus}
          onJumpTo={onJumpTo}
          onOpenSource={onOpenSource}
        />
      </View>
    );
  }

  if (state.status === "translation_pending") {
    return (
      <View>
        <View style={styles.translationPendingBanner}>
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={styles.statusGlyph}
          />
          <Text style={styles.translationPendingText}>
            {t("transcript.translating")}
          </Text>
        </View>
        <TranscriptText
          content={state.content}
          passageFocus={passageFocus}
          onJumpTo={onJumpTo}
          onOpenSource={onOpenSource}
        />
      </View>
    );
  }

  // The poll's budget is spent and the translation is still on its way. The
  // original stays readable, but under a line that says so in full, with a still
  // glyph rather than the spinner — nothing is running any more — and the way to
  // look again. Never the original on its own, which is what `ready` looks like.
  if (state.status === "translation_stalled") {
    return (
      <View>
        <View style={styles.translationStalledBanner}>
          <View style={styles.translationStalledRow}>
            <Ionicons
              name="time-outline"
              size={16}
              color={Colors.textMuted}
              style={styles.statusGlyph}
            />
            <Text style={styles.translationStalledText}>
              {t("transcript.translationStalled")}
            </Text>
          </View>
          <Pressable
            style={styles.checkTranslationButton}
            onPress={onCheckTranslation}
            accessibilityLabel={t("transcript.checkTranslationA11y")}
            accessibilityRole="button"
            testID="transcript-check-translation"
          >
            <Ionicons name="refresh" size={16} color={Colors.textMain} />
            <Text style={styles.checkTranslationText}>
              {t("transcript.checkTranslation")}
            </Text>
          </Pressable>
        </View>
        <TranscriptText
          content={state.content}
          passageFocus={passageFocus}
          onJumpTo={onJumpTo}
          onOpenSource={onOpenSource}
        />
      </View>
    );
  }

  if (state.status === "translation_failed") {
    return (
      <View>
        <View style={styles.translationFailedBanner}>
          <Ionicons
            name="alert-circle"
            size={16}
            color={Colors.error}
            style={styles.statusGlyph}
          />
          <Text style={styles.translationFailedText}>
            {t("transcript.translationFailed")}
          </Text>
        </View>
        <TranscriptText
          content={state.content}
          passageFocus={passageFocus}
          onJumpTo={onJumpTo}
          onOpenSource={onOpenSource}
        />
      </View>
    );
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={styles.statusGlyph}
        />
        <Text style={styles.statusText}>{t("transcript.loading")}</Text>
      </View>
    );
  }

  if (state.status === "not_available") {
    return (
      <View style={styles.statusRow}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={Colors.textMuted}
          style={styles.statusGlyph}
        />
        <Text style={styles.statusText}>{t("transcript.notAvailable")}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.statusRow}>
        <Ionicons
          name="alert-circle"
          size={16}
          color={Colors.error}
          style={styles.statusGlyph}
        />
        <Text style={[styles.statusText, styles.statusTextFailed]}>
          {state.message}
        </Text>
      </View>
      <Pressable
        style={styles.retryButton}
        onPress={onRetry}
        accessibilityLabel={t("transcript.retryA11y")}
        accessibilityRole="button"
      >
        <Ionicons name="refresh" size={18} color={Colors.onPrimary} />
        <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      gap: Spacing.sm,
    },
    // The title and the translation switch share a row. The margin that used to
    // sit under the title belongs to the row now: with the pill in it, the row is
    // what the text has to clear.
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      flex: 1,
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
    },
    statusGlyph: {
      marginEnd: Spacing.sm,
    },
    statusText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMain,
      lineHeight: Typography.body.lineHeight,
    },
    statusTextFailed: {
      color: Colors.error,
    },
    translationPendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    translationPendingText: {
      fontSize: Typography.small.fontSize,
      color: Colors.textMuted,
      fontStyle: "italic",
    },
    // One tone above the pending line, so the two read as different states.
    translationStalledBanner: {
      gap: Spacing.sm,
      padding: Spacing.md,
      backgroundColor: Colors.surfaceContainer,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    translationStalledRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    translationStalledText: {
      flex: 1,
      fontSize: Typography.small.fontSize,
      color: Colors.textMain,
    },
    checkTranslationButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      alignSelf: "flex-start",
      minHeight: TouchTarget.minimum,
      paddingHorizontal: Spacing.md,
      backgroundColor: Colors.surfaceContainerHigh,
      borderRadius: BorderRadius.full,
    },
    checkTranslationText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
    // Where the same pill sits when it is on the title row instead of inside a
    // banner: centred against the title rather than pinned to the top of the row,
    // and never squeezed — the title is what gives way if the label is long.
    headerPill: {
      alignSelf: "center",
      flexShrink: 0,
    },
    translationFailedBanner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: Colors.errorContainer,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    translationFailedText: {
      fontSize: Typography.small.fontSize,
      color: Colors.error,
      flex: 1,
    },
    body: {
      paddingVertical: Spacing.sm,
    },
    paragraph: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textMain,
      marginBottom: Spacing.md,
    },
    paragraphLast: {
      marginBottom: 0,
    },
    // A web article's standfirst: one step above the body, medium weight.
    lead: {
      fontSize: 18,
      lineHeight: 28,
      fontWeight: "500",
    },
    incomplete: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginTop: Spacing.lg,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerLow,
    },
    incompleteText: {
      flex: 1,
      gap: 4,
    },
    incompleteTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    incompleteBody: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSubtle,
    },
    incompleteLink: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      minHeight: TouchTarget.minimum,
    },
    incompleteLinkPressed: {
      opacity: 0.6,
    },
    incompleteLinkText: {
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    speaker: {
      color: Colors.textMuted,
      fontWeight: "600",
    },
    sectionChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    sectionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: BorderRadius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.outlineVariant,
      backgroundColor: Colors.surface,
    },
    sectionChipPressed: {
      backgroundColor: Colors.surfaceContainer,
    },
    sectionChipText: {
      fontSize: Typography.small.fontSize,
      fontWeight: "500",
      color: Colors.textMain,
    },
    sectionSpaced: {
      marginTop: Spacing.xl,
    },
    sectionKicker: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    sectionKickerText: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.96,
      textTransform: "uppercase",
      color: Colors.textSubtle,
    },
    sectionRule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.outlineVariant,
    },
    sectionVideo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 10,
    },
    sectionThumb: {
      width: 96,
      aspectRatio: 16 / 9,
      borderRadius: BorderRadius.md,
      overflow: "hidden",
      backgroundColor: Colors.surfaceContainerHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionPlay: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(255, 255, 255, 0.92)",
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: 2,
    },
    sectionVideoText: {
      flex: 1,
      gap: 4,
    },
    sectionVideoTitle: {
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    sectionMeta: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
    empty: {
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.xl,
    },
    emptyText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
    },
    emptyHint: {
      fontSize: Typography.small.fontSize,
      color: Colors.textMuted,
      fontStyle: "italic",
      textAlign: "center",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      minHeight: TouchTarget.minimum,
      marginTop: Spacing.md,
      alignSelf: "flex-start",
    },
    retryButtonText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.onPrimary,
    },
  });
