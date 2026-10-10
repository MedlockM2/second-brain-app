/**
 * The past conversations of one media or one folder, inside the chat sheet
 * (task-469). Not a screen and not a tab: the UI decision of task-434 keeps the
 * chat in its sheet, so the history is a view the sheet swaps its thread for.
 *
 * Latest activity first, a page at a time, each row with what tells two
 * conversations apart: the first question, the date, how many questions, and
 * where the last one stands. A row resumes its conversation; its delete button
 * asks first.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { formatDate, t, tCount } from "../../i18n";
import { ChatService } from "../../services/chatService";
import type { ChatConversationSummary, ChatScope, ChatTurnStatus } from "../../types/chat";

export interface ChatHistoryListProps {
  scope: ChatScope;
  scopeId: string;
  /** The conversation the sheet shows now, marked in the list. */
  currentId: string | null;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => Promise<void>;
}

const PAGE_SIZE = 20;

function statusLabel(summary: ChatConversationSummary): string | null {
  if (summary.generating) return t("chat.history.status.generating");
  const status: ChatTurnStatus | null | undefined = summary.last_turn_status;
  switch (status) {
    case "completed":
      return t("chat.history.status.completed");
    case "failed":
      return t("chat.history.status.failed");
    case "interrupted":
      return t("chat.history.status.interrupted");
    default:
      return null;
  }
}

export function ChatHistoryList({
  scope,
  scopeId,
  currentId,
  onSelect,
  onDelete,
}: ChatHistoryListProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<ChatConversationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      setFailed(false);
      try {
        const page = await ChatService.listConversations(scope, scopeId, {
          limit: PAGE_SIZE,
          cursor: after,
        });
        setItems((previous) => (after ? [...previous, ...page.conversations] : page.conversations));
        setCursor(page.next_cursor ?? null);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [scope, scopeId],
  );

  // The first page, set from the request's callbacks only (the initial state is
  // already "loading"), so the effect itself never sets state.
  useEffect(() => {
    let active = true;
    ChatService.listConversations(scope, scopeId, { limit: PAGE_SIZE })
      .then((page) => {
        if (!active) return;
        setItems(page.conversations);
        setCursor(page.next_cursor ?? null);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scope, scopeId]);

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
            setItems((previous) =>
              previous.filter((item) => item.conversation_id !== summary.conversation_id),
            );
          } catch {
            setFailed(true);
          }
        },
      },
    ]);
  };

  if (loading && items.length === 0) {
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
        const date = formatDate(new Date(summary.last_activity_at), {
          month: "short",
          day: "numeric",
        });
        const turns = tCount("chat.history.turns", summary.turn_count);
        const status = statusLabel(summary);
        const isCurrent = summary.conversation_id === currentId;
        return (
          <View key={summary.conversation_id} style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
              onPress={() => onSelect(summary.conversation_id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
              accessibilityLabel={t("chat.history.rowA11y", {
                title,
                date,
                turns,
                status: status ?? "",
              })}
              testID={`chat-history-${summary.conversation_id}`}
            >
              <Text style={styles.rowTitle} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[date, turns, status, isCurrent ? t("chat.history.current") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              onPress={() => confirmDelete(summary)}
              accessibilityRole="button"
              accessibilityLabel={t("chat.history.deleteA11y", { title })}
              testID={`chat-history-delete-${summary.conversation_id}`}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.textSubtle} />
            </Pressable>
          </View>
        );
      })}
      {failed ? (
        <Pressable
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          onPress={() => void load(null)}
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
          {loading ? (
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
      minHeight: TouchTarget.comfortable,
      justifyContent: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      gap: 2,
    },
    rowTitle: {
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    rowMeta: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
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
