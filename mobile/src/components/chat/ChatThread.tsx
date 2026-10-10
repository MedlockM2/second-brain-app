/**
 * The conversation: each question, then its answer, and the answer being written.
 *
 * Source references are what the prompt makes the model cite (`[S1]`, `[S2]`…,
 * the refs of the conversation's frozen snapshot); they are drawn as small tags
 * and spoken by the screen reader as the source they name. An answer that
 * stopped early says why — stopped by the user, cut by the output ceiling, or
 * interrupted by an error — so a partial answer never passes for a complete one.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import type { ChatMessage, ChatSource } from "../../types/chat";

export interface ChatThreadProps {
  messages: ChatMessage[];
  sources: ChatSource[];
  /** The answer being written for the live turn, with its turn index. */
  live: { turnIndex: number; text: string } | null;
  /** A turn is in flight but nothing has arrived yet. */
  waiting: boolean;
  /** Ask a question of an earlier turn again, as a new turn. */
  onRetry: (question: string) => void;
  retryDisabled: boolean;
}

const REF_PATTERN = /\[S\d+\]/g;

function splitRefs(text: string): { text: string; ref: boolean }[] {
  const parts: { text: string; ref: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(REF_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), ref: false });
    parts.push({ text: match[0], ref: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), ref: false });
  return parts;
}

function spokenText(text: string, titles: Map<string, string>): string {
  return text.replace(REF_PATTERN, (ref) =>
    t("chat.thread.sourceA11y", { ref: ref.slice(1, -1), title: titles.get(ref) ?? "" }),
  );
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
  sources,
  live,
  waiting,
  onRetry,
  retryDisabled,
}: ChatThreadProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const titles = useMemo(
    () => new Map(sources.map((source) => [source.ref, source.title ?? ""])),
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

  const renderAnswerText = (text: string) => (
    <Text style={styles.answerText} accessibilityLabel={spokenText(text, titles)}>
      {splitRefs(text).map((part, index) =>
        part.ref ? (
          <Text key={index} style={styles.ref}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
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
            {text ? renderAnswerText(text) : null}
            {isLive && waiting && !text ? (
              <View style={styles.pending}>
                <ActivityIndicator size="small" color={Colors.textSubtle} />
                <Text style={styles.pendingText}>{t("chat.thread.waiting")}</Text>
              </View>
            ) : null}
            {isLive && text ? (
              <Text style={styles.pendingText}>{t("chat.thread.writing")}</Text>
            ) : null}
            {status ? (
              <View style={styles.statusRow}>
                <Ionicons
                  name={message.status === "failed" ? "alert-circle-outline" : "remove-circle-outline"}
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
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    thread: {
      gap: Spacing.md,
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
    answerText: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textMain,
    },
    ref: {
      fontSize: Typography.small.fontSize,
      fontWeight: "600",
      color: Colors.onHighlight,
      backgroundColor: Colors.highlight,
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
