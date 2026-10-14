/** Retained, paginated conversation titles; refresh never hides existing rows. */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import type { ChatHistoryState } from "../../hooks/useChatHistory";
import type { ChatConversationSummary } from "@media-summarizer/core/types/chat";

export interface ChatHistoryListProps {
  history: ChatHistoryState;
  /** The conversation the modal shows now, marked in the list. */
  currentId: string | null;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => Promise<void>;
}

export function ChatHistoryList({
  history,
  currentId,
  onSelect,
  onDelete,
}: ChatHistoryListProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { items, cursor, loading, loadingMore, initialized, failed, load } = history;
  const confirmDelete = (summary: ChatConversationSummary) => {
    const title = summary.title || t("chat.history.untitled");
    Alert.alert(t("chat.history.confirmTitle"), t("chat.history.confirmBody", { title }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await onDelete(summary.conversation_id);
            history.remove(summary.conversation_id);
          } catch {
            Alert.alert(t("chat.history.error"));
          }
        },
      },
    ]);
  };

  if (loading && !initialized) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.textSubtle} />
      </View>
    );
  }

  return (
    <View style={styles.list} accessibilityRole="list">
      {items.length === 0 && !failed ? (
        <Text style={styles.muted}>{t("chat.history.empty")}</Text>
      ) : null}
      {items.map((summary) => {
        const title = summary.title || t("chat.history.untitled");
        const isCurrent = summary.conversation_id === currentId;
        return (
          <View key={summary.conversation_id} style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
              onPress={() => onSelect(summary.conversation_id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
              accessibilityLabel={title}
              testID={`chat-history-${summary.conversation_id}`}
            >
              <Text style={styles.rowTitle} numberOfLines={2}>
                {title}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              onPress={() => confirmDelete(summary)}
              accessibilityRole="button"
              accessibilityLabel={t("chat.history.deleteA11y", { title })}
              testID={`chat-history-delete-${summary.conversation_id}`}
            >
              <Ionicons name="trash-outline" size={24} color={Colors.textSubtle} />
            </Pressable>
          </View>
        );
      })}
      {failed ? (
        <Pressable
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          onPress={() => void history.retry()}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
        >
          <Text style={styles.error}>{t("chat.history.error")}</Text>
          <Text style={styles.moreLabel}>{t("common.retry")}</Text>
        </Pressable>
      ) : cursor ? (
        <Pressable
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          onPress={() => void load(cursor)}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={t("chat.history.loadMore")}
        >
          {loadingMore ? (
            <ActivityIndicator color={Colors.textSubtle} />
          ) : (
            <Text style={styles.moreLabel}>{t("chat.history.loadMore")}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    centered: {
      paddingVertical: Spacing.lg,
      alignItems: "center",
    },
    list: {
      gap: Spacing.sm,
    },
    muted: {
      fontSize: Typography.body.fontSize,
      color: Colors.textSubtle,
      paddingVertical: Spacing.lg,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: BorderRadius.lg,
    },
    rowMain: {
      flex: 1,
      minHeight: 72,
      justifyContent: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
    },
    rowTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textMain,
    },
    delete: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.full,
    },
    pressed: {
      backgroundColor: Colors.surfaceContainer,
    },
    more: {
      minHeight: TouchTarget.minimum,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.lg,
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
    },
    moreLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
    error: {
      fontSize: Typography.small.fontSize,
      color: Colors.error,
    },
  });
