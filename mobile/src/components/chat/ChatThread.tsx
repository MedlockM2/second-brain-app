/**
 * The conversation: each question, then its answer, and the answer being written.
 *
 * An answer is drawn from its Markdown by `ChatAnswer`, which also turns the
 * source tags the prompt makes the model write (`[S1]`, `[S2]`…, the refs of the
 * conversation's frozen snapshot) into the titles of the media they name. An
 * answer that stopped early says why — stopped by the user, cut by the output
 * ceiling, or interrupted by an error — so a partial answer never passes for a
 * complete one.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import type { ChatMessage, ChatSource } from "@media-summarizer/core/types/chat";
import { ChatAnswer } from "./ChatAnswer";

export interface ChatThreadProps {
  messages: ChatMessage[];
  pendingQuestion: { question: string; status: "sending" | "failed" } | null;
  sources: ChatSource[];
  /** The answer being written for the live turn, with its turn index. */
  live: { turnIndex: number; text: string } | null;
  /** A turn is in flight but nothing has arrived yet. */
  waiting: boolean;
  /** Ask a question of an earlier turn again, as a new turn. */
  onRetry: (question: string) => void;
  retryDisabled: boolean;
  /**
   * Whether answers name the sources they cite. False in a media's conversation,
   * whose one source is the page it is opened on (see `ChatAnswer`).
   */
  showSources: boolean;
  /** Open a source an answer cites. */
  onOpenSource: (source: ChatSource) => void;
}

function statusLine(message: ChatMessage): string | null {
  if (message.status === "interrupted") {
    switch (message.interruption_cause) {
      case "cancelled":
        return t("chat.thread.interruptedCancelled");
      case "output_limit":
        return t("chat.thread.interruptedOutputLimit");
      default:
        return t("chat.thread.interruptedError");
    }
  }
  if (message.status === "failed") return t("chat.thread.failed");
  return null;
}

export function ChatThread({
  messages,
  pendingQuestion,
  sources,
  live,
  waiting,
  onRetry,
  retryDisabled,
  showSources,
  onOpenSource,
}: ChatThreadProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const sourcesByRef = useMemo(
    () => new Map(sources.map((source) => [source.ref, source])),
    [sources],
  );
  const questions = useMemo(
    () =>
      new Map(
        messages
          .filter((message) => message.role === "user")
          .map((message) => [message.turn_index, message.text ?? ""]),
      ),
    [messages],
  );

  return (
    <View style={styles.thread}>
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <View key={`${message.turn_id}-q`} style={styles.questionRow}>
              <Text
                style={styles.question}
                accessibilityLabel={t("chat.thread.questionA11y", { text: message.text ?? "" })}
              >
                {message.text}
              </Text>
            </View>
          );
        }
        const isLive = live !== null && live.turnIndex === message.turn_index;
        const text = isLive ? live.text : (message.text ?? "");
        const status = isLive ? null : statusLine(message);
        const canRetry =
          !isLive &&
          (message.status === "failed" ||
            (message.status === "interrupted" && message.interruption_cause === "provider_error"));
        return (
          <View key={`${message.turn_id}-a`} style={styles.answer}>
            {text ? (
              <ChatAnswer
                text={text}
                live={isLive}
                sources={sourcesByRef}
                showSources={showSources}
                onOpenSource={onOpenSource}
              />
            ) : null}
            {isLive && waiting && !text ? (
              <View style={styles.pending}>
                <ActivityIndicator size="small" color={Colors.textSubtle} />
              </View>
            ) : null}
            {status ? (
              <View style={styles.statusRow}>
                <Ionicons
                  name={
                    message.status === "failed" ? "alert-circle-outline" : "remove-circle-outline"
                  }
                  size={16}
                  color={message.status === "failed" ? Colors.error : Colors.textSubtle}
                />
                <Text style={message.status === "failed" ? styles.statusError : styles.statusText}>
                  {status}
                </Text>
              </View>
            ) : null}
            {canRetry ? (
              <Pressable
                style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
                onPress={() => onRetry(questions.get(message.turn_index) ?? "")}
                disabled={retryDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: retryDisabled }}
                accessibilityLabel={t("chat.thread.retry")}
              >
                <Ionicons name="refresh" size={16} color={Colors.textMain} />
                <Text style={styles.retryLabel}>{t("chat.thread.retry")}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {pendingQuestion ? (
        <>
          <View style={styles.questionRow}>
            <Text
              style={styles.question}
              accessibilityLabel={t("chat.thread.questionA11y", { text: pendingQuestion.question })}
            >
              {pendingQuestion.question}
            </Text>
          </View>
          {pendingQuestion.status === "sending" ? (
            <View style={styles.pending} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={Colors.textSubtle} />
              <Text style={styles.pendingText}>{t("chat.thread.sending")}</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
              onPress={() => onRetry(pendingQuestion.question)}
              disabled={retryDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: retryDisabled }}
              accessibilityLabel={t("chat.thread.retrySend")}
            >
              <Ionicons name="refresh" size={16} color={Colors.textMain} />
              <Text style={styles.retryLabel}>{t("chat.thread.retrySend")}</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    // Room around each question, so a long answer never runs into the next one.
    thread: {
      gap: Spacing.lg,
    },
    questionRow: {
      alignItems: "flex-end",
    },
    question: {
      maxWidth: "85%",
      backgroundColor: Colors.surfaceContainerHigh,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textMain,
    },
    answer: {
      gap: Spacing.sm,
    },
    pending: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    pendingText: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    statusText: {
      flex: 1,
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
    statusError: {
      flex: 1,
      fontSize: Typography.small.fontSize,
      color: Colors.error,
    },
    retry: {
      alignSelf: "flex-start",
      minHeight: TouchTarget.minimum,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerLow,
    },
    retryPressed: {
      backgroundColor: Colors.surfaceContainer,
    },
    retryLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
  });
