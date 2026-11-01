import { useReducer } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Flashcard } from "@media-summarizer/core/artifacts/content";
import {
  flashcardSessionReducer,
  isFlashcardRoundOver,
  startFlashcardSession,
} from "@media-summarizer/core/artifacts/flashcardSession";
import type { ArtifactTranslator } from "@media-summarizer/core/artifacts/i18n";
import {
  BorderRadius,
  Spacing,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";

/** Below this window height the identity and the question shrink (iPhone SE). */
const COMPACT_HEIGHT = 700;

/**
 * Flashcards, one at a time: reveal the answer, say whether you knew it, and
 * end on a summary that offers to go over the missed cards
 * (`mobile-design-mockups/flashcards_ux/`, direction B). The session logic is
 * shared with the web (`@media-summarizer/core/artifacts/flashcardSession`).
 *
 * `labels` speaks the artifact's language (QUESTION, "Card 3 of 12"), `t` the
 * interface's (the buttons), as on the quiz.
 */
export function FlashcardSession({
  cards,
  labels,
  kindLabel,
  sourceTitle,
  onFinish,
}: {
  cards: Flashcard[];
  labels: ArtifactTranslator;
  kindLabel: string;
  sourceTitle: string | null;
  onFinish: () => void;
}) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().height < COMPACT_HEIGHT;
  const [session, dispatch] = useReducer(
    flashcardSessionReducer,
    cards.length,
    startFlashcardSession,
  );
  const actionsPadding = { paddingBottom: insets.bottom + Spacing.md };

  if (isFlashcardRoundOver(session)) {
    const roundSize = session.order.length;
    const missed = session.again.length;
    return (
      <View style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.summary}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={styles.score}
            accessible
            accessibilityLabel={t("artifact.flashcards.scoreA11y", {
              known: session.known.length,
              total: roundSize,
            })}
          >
            <Text style={styles.scoreNumber}>{session.known.length}</Text>
            <Text style={styles.scoreTotal}>
              {t("artifact.flashcards.scoreTotal", { total: roundSize })}
            </Text>
          </View>
          <Text style={styles.summaryTitle} accessibilityRole="header">
            {t("artifact.flashcards.doneTitle")}
          </Text>
          <Text style={styles.summaryBody}>
            {missed > 0
              ? t("artifact.flashcards.doneSome")
              : t("artifact.flashcards.doneAll")}
          </Text>
          {missed > 0 ? (
            <>
              <View style={styles.missedHeader}>
                <Text style={styles.missedHeaderText}>
                  {t("artifact.flashcards.again").toUpperCase()}
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{missed}</Text>
                </View>
              </View>
              <View style={styles.missedList}>
                {session.again.map((cardIndex, i) => (
                  <View
                    key={cardIndex}
                    style={[styles.missedRow, i > 0 && styles.missedRowRule]}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={Colors.artifactFlashcardsInk}
                      style={styles.missedIcon}
                    />
                    <Text style={styles.missedText} numberOfLines={2}>
                      {cards[cardIndex].question}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
        <View style={[styles.actionsColumn, actionsPadding]}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              missed > 0 ? dispatch({ type: "reviewMissed" }) : onFinish()
            }
            accessibilityRole="button"
          >
            {missed > 0 ? (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={Colors.onPrimary}
              />
            ) : null}
            <Text style={[styles.buttonText, styles.buttonPrimaryText]}>
              {missed > 0
                ? t("artifact.flashcards.reviewMissed")
                : t("common.done")}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}
            onPress={() => dispatch({ type: "restart", cardCount: cards.length })}
            accessibilityRole="button"
          >
            <Text style={styles.quietButtonText}>
              {t("artifact.flashcards.restart")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const card = cards[session.order[session.position]];
  const roundSize = session.order.length;
  const index = session.position + 1;
  const reveal = () => dispatch({ type: "reveal" });

  return (
    <View style={styles.fill}>
      <View style={[styles.identity, compact && styles.identityCompact]}>
        <View style={styles.kindChip}>
          <Ionicons
            name="copy-outline"
            size={14}
            color={Colors.artifactFlashcardsInk}
          />
          <Text style={styles.kindChipText}>{kindLabel}</Text>
        </View>
        {sourceTitle ? (
          <Text
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={compact ? 1 : 2}
          >
            {sourceTitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {labels.t("artifact.cardPosition", { index, total: roundSize })}
          </Text>
          {session.known.length + session.again.length > 0 ? (
            <View
              style={styles.tally}
              accessible
              accessibilityLabel={t("artifact.flashcards.tallyA11y", {
                known: session.known.length,
                again: session.again.length,
              })}
            >
              <Ionicons name="checkmark" size={14} color={Colors.success} />
              <Text style={[styles.tallyText, { color: Colors.success }]}>
                {session.known.length}
              </Text>
              <Ionicons
                name="refresh-outline"
                size={14}
                color={Colors.artifactFlashcardsInk}
                style={styles.tallyGap}
              />
              <Text
                style={[styles.tallyText, { color: Colors.artifactFlashcardsInk }]}
              >
                {session.again.length}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={t("artifact.flashcards.progress")}
          accessibilityValue={{ min: 1, max: roundSize, now: index }}
        >
          <View
            style={[styles.trackFill, { width: `${(index / roundSize) * 100}%` }]}
          />
        </View>
      </View>

      <View style={[styles.deck, compact && styles.deckCompact]}>
        {roundSize - index > 1 ? <View style={[styles.edge, styles.edgeBack]} /> : null}
        {roundSize - index > 0 ? <View style={[styles.edge, styles.edgeMiddle]} /> : null}
        <Pressable
          style={styles.card}
          onPress={session.revealed ? undefined : reveal}
          disabled={session.revealed}
          accessibilityRole={session.revealed ? undefined : "button"}
          accessibilityHint={
            session.revealed ? undefined : t("artifact.flashcards.reveal")
          }
        >
          <ScrollView
            contentContainerStyle={[
              styles.cardContent,
              compact && styles.cardContentCompact,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {session.revealed ? (
              <>
                <Text style={styles.questionSmall}>{card.question}</Text>
                <View style={styles.rule} />
                <Text style={[styles.kicker, styles.kickerInk]}>
                  {labels.t("artifact.answer")}
                </Text>
                <Text style={styles.answer}>{card.answer}</Text>
              </>
            ) : (
              <>
                <Text style={styles.kicker}>{labels.t("artifact.question")}</Text>
                <Text style={[styles.question, compact && styles.questionCompact]}>
                  {card.question}
                </Text>
              </>
            )}
          </ScrollView>
        </Pressable>
      </View>

      {session.revealed ? (
        <View style={[styles.actionsRow, compact && styles.actionsCompact, actionsPadding]}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonAgain,
              compact && styles.buttonCompact,
              pressed && styles.pressed,
            ]}
            onPress={() => dispatch({ type: "rate", rating: "again" })}
            accessibilityRole="button"
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={Colors.artifactFlashcardsInk}
            />
            <Text style={[styles.buttonText, { color: Colors.artifactFlashcardsInk }]}>
              {t("artifact.flashcards.again")}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonKnown,
              compact && styles.buttonCompact,
              pressed && styles.pressed,
            ]}
            onPress={() => dispatch({ type: "rate", rating: "known" })}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={20} color={Colors.success} />
            <Text style={[styles.buttonText, { color: Colors.success }]}>
              {t("artifact.flashcards.known")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.actionsRow, compact && styles.actionsCompact, actionsPadding]}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              compact && styles.buttonCompact,
              pressed && styles.pressed,
            ]}
            onPress={reveal}
            accessibilityRole="button"
          >
            <Ionicons name="eye-outline" size={20} color={Colors.onPrimary} />
            <Text style={[styles.buttonText, styles.buttonPrimaryText]}>
              {t("artifact.flashcards.reveal")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },

    identity: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.md,
      gap: Spacing.sm,
    },
    identityCompact: {
      paddingHorizontal: Spacing.md,
      paddingTop: 0,
      paddingBottom: Spacing.sm,
      gap: Spacing.xs,
    },
    kindChip: {
      flexDirection: "row",
      alignSelf: "flex-start",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.artifactFlashcardsTint,
    },
    kindChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: Colors.artifactFlashcardsInk,
      letterSpacing: 0.5,
    },
    title: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      lineHeight: 26,
      letterSpacing: -0.2,
      color: Colors.textMain,
    },
    titleCompact: {
      fontSize: 15,
      lineHeight: 20,
    },

    progress: {
      paddingHorizontal: Spacing.lg,
    },
    progressRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.sm,
    },
    progressLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textSubtle,
    },
    tally: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    tallyGap: {
      marginLeft: Spacing.sm,
    },
    tallyText: {
      fontSize: 14,
      fontWeight: "700",
    },
    track: {
      height: Spacing.xs,
      overflow: "hidden",
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    trackFill: {
      height: "100%",
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
    },

    deck: {
      flex: 1,
      marginHorizontal: Spacing.lg,
      marginTop: 20,
      paddingBottom: Spacing.md,
    },
    deckCompact: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      paddingBottom: 12,
    },
    // The edges of the next cards, peeking under the current one: "there are more".
    edge: {
      position: "absolute",
      height: 40,
      borderRadius: BorderRadius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.outlineVariant,
    },
    edgeMiddle: {
      left: 10,
      right: 10,
      bottom: Spacing.sm,
      backgroundColor: Colors.surfaceContainerLow,
    },
    edgeBack: {
      left: 22,
      right: 22,
      bottom: 0,
      backgroundColor: Colors.surfaceContainer,
    },
    card: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.outlineVariant,
      overflow: "hidden",
      ...Shadows.soft,
    },
    cardContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
      paddingVertical: 28,
      gap: 12,
    },
    cardContentCompact: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 18,
    },
    kicker: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.7,
      color: Colors.textSubtle,
    },
    kickerInk: {
      color: Colors.artifactFlashcardsInk,
    },
    question: {
      fontSize: 24,
      fontWeight: "600",
      lineHeight: 32,
      letterSpacing: -0.3,
      color: Colors.textMain,
    },
    questionCompact: {
      fontSize: 19,
      lineHeight: 26,
    },
    questionSmall: {
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
      color: Colors.textSubtle,
    },
    rule: {
      width: 40,
      height: Spacing.xs,
      borderRadius: 2,
      backgroundColor: Colors.primary,
    },
    answer: {
      fontSize: 20,
      lineHeight: 31,
      color: Colors.textMain,
    },

    actionsRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: Spacing.lg,
      paddingTop: 20,
    },
    actionsCompact: {
      paddingHorizontal: Spacing.md,
      paddingTop: 12,
    },
    actionsColumn: {
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
    },
    button: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      minHeight: 56,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    buttonCompact: {
      minHeight: 48,
    },
    buttonPrimary: {
      backgroundColor: Colors.primary,
    },
    buttonAgain: {
      backgroundColor: Colors.artifactFlashcardsTint,
    },
    buttonKnown: {
      backgroundColor: Colors.successTint,
    },
    buttonText: {
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
    },
    buttonPrimaryText: {
      color: Colors.onPrimary,
    },
    quietButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    quietButtonText: {
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
      color: Colors.textSubtle,
    },
    pressed: {
      opacity: 0.85,
    },

    summary: {
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
    },
    score: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: Colors.successTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    scoreNumber: {
      fontSize: 34,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: Colors.success,
    },
    scoreTotal: {
      fontSize: 13,
      color: Colors.textSubtle,
    },
    summaryTitle: {
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: Colors.textMain,
      marginBottom: 6,
      textAlign: "center",
    },
    summaryBody: {
      fontSize: 15,
      lineHeight: 22,
      color: Colors.textSubtle,
      textAlign: "center",
      maxWidth: 320,
      marginBottom: Spacing.lg,
    },
    missedHeader: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginBottom: 10,
    },
    missedHeaderText: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.6,
      color: Colors.textSubtle,
    },
    countBadge: {
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm,
      backgroundColor: Colors.artifactFlashcardsTint,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: Colors.artifactFlashcardsInk,
    },
    missedList: {
      alignSelf: "stretch",
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      overflow: "hidden",
    },
    missedRow: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
    },
    missedRowRule: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.surfaceContainerHigh,
    },
    missedIcon: {
      marginTop: 3,
    },
    missedText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: Colors.textMain,
    },
  });
