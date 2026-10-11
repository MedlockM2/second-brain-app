/**
 * The persistent chat composer of a media's Reader tab and a folder's Sources tab
 * (task-468, owner decision of task-434: direction F, a persistent composer, on a
 * media and on a folder, never on the library).
 *
 * Direction F was benchmarked as a native tab-bar accessory. Those two tabs live
 * on root-stack screens with no tab bar, so the composer is a screen component
 * instead, the same on iOS and Android, anchored at the bottom of the tab. At
 * rest it is one field naming its scope; a tap opens the conversation sheet, in
 * which the same field becomes the composer. While an answer is on its way the
 * resting field says so.
 *
 * Everything that must outlive this component — the conversation, the answer
 * being written, its stream — is held by `ChatSessionContext`. Only the draft and
 * the last refusal are local.
 */

import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useChatSession } from "../../contexts/ChatSessionContext";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import { describeChatRefusal, type ChatRefusal } from "../../lib/chatRefusal";
import type { ChatScope } from "@media-summarizer/core/types/chat";
import { ChatHistoryList } from "./ChatHistoryList";
import { ChatSheet } from "./ChatSheet";

export interface ChatDockProps {
  scope: ChatScope;
  scopeId: string;
  /** Space to keep under the dock: the safe area, when no tab bar covers it. */
  bottomInset?: number;
}

export function ChatDock({ scope, scopeId, bottomInset = 0 }: ChatDockProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const isFocused = useIsFocused();
  const chat = useChatSession(scope, scopeId);
  const { session } = chat;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [refusal, setRefusal] = useState<ChatRefusal | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const dockRef = useRef<View>(null);

  const generating = session.generation !== null;
  const sending = session.phase === "sending";
  const isFolder = scope === "folder";

  // Leaving the screen hides the sheet with it; the answer goes on. The sheet is
  // a modal, so while it is up the Digest carousel under it cannot change page.
  const sheetVisible = open && isFocused;

  // Spoken once when an answer starts and once when it is there — never fragment
  // by fragment, which would drown the screen reader.
  const wasGenerating = useRef(generating);
  useEffect(() => {
    if (generating && !wasGenerating.current) {
      AccessibilityInfo.announceForAccessibility(t("chat.a11y.answerStarted"));
    } else if (!generating && wasGenerating.current) {
      AccessibilityInfo.announceForAccessibility(t("chat.a11y.answerReady"));
    }
    wasGenerating.current = generating;
  }, [generating]);

  const close = () => {
    setOpen(false);
    // Back on the control that opened the sheet.
    const node = findNodeHandle(dockRef.current);
    if (node) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 400);
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text) return;
    setRefusal(null);
    try {
      await chat.sendQuestion(text);
      setDraft((current) => (current.trim() === text ? "" : current));
    } catch (error) {
      setRefusal(describeChatRefusal(error, scope));
    }
  };

  const stop = async () => {
    // The explicit stop: the only call site of the stop route.
    await chat.stopGeneration();
  };

  const handleRefusalAction = (action: NonNullable<ChatRefusal["action"]>) => {
    setRefusal(null);
    if (action === "seePlans") {
      setOpen(false);
      router.push({ pathname: "/paywall", params: { reason: "out_of_minutes" } });
      return;
    }
    chat.clearActive();
  };

  const conversation = session.conversation;
  const restingLabel = generating
    ? t("chat.dock.generating")
    : isFolder
      ? t("chat.dock.askFolder")
      : t("chat.dock.askMedia");

  return (
    <View style={[styles.dock, { paddingBottom: Spacing.sm + bottomInset }]}>
      <Pressable
        ref={dockRef}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={restingLabel}
        accessibilityHint={t("chat.dock.openA11y")}
        testID={`chat-dock-${scope}`}
      >
        <Ionicons
          name={generating ? "ellipsis-horizontal" : "chatbubble-ellipses-outline"}
          size={20}
          color={generating ? Colors.textMain : Colors.textMuted}
        />
        <Text style={[styles.fieldText, generating && styles.fieldTextActive]} numberOfLines={1}>
          {draft.trim() && !generating ? draft : restingLabel}
        </Text>
      </Pressable>

      <ChatSheet
        visible={sheetVisible}
        onClose={close}
        title={isFolder ? t("chat.sheet.titleFolder") : t("chat.sheet.titleMedia")}
        emptyText={isFolder ? t("chat.sheet.emptyFolder") : t("chat.sheet.emptyMedia")}
        placeholder={isFolder ? t("chat.dock.askFolder") : t("chat.dock.askMedia")}
        messages={conversation?.messages ?? []}
        sources={conversation?.sources ?? []}
        live={
          session.generation
            ? { turnIndex: session.generation.turn_index, text: session.streamingText }
            : null
        }
        waiting={generating && !session.streamingText}
        generating={generating}
        sending={sending}
        draft={draft}
        onChangeDraft={setDraft}
        onSend={() => void ask(draft)}
        onStop={() => void stop()}
        onRetry={(question) => void ask(question)}
        refusal={refusal}
        onRefusalAction={handleRefusalAction}
        historyOpen={historyOpen}
        onToggleHistory={() => setHistoryOpen((value) => !value)}
        history={
          historyOpen ? (
            <ChatHistoryList
              scope={scope}
              scopeId={scopeId}
              currentId={conversation?.conversation_id ?? null}
              onSelect={(conversationId) => {
                setRefusal(null);
                setHistoryOpen(false);
                void chat.selectConversation(conversationId).catch((error) =>
                  setRefusal(describeChatRefusal(error, scope)),
                );
              }}
              onDelete={(conversationId) => chat.deleteConversation(conversationId)}
            />
          ) : null
        }
        onNewConversation={
          conversation && conversation.turn_count > 0
            ? () => {
                setRefusal(null);
                chat.clearActive();
              }
            : null
        }
      />
    </View>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    dock: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      backgroundColor: Colors.background,
    },
    field: {
      minHeight: TouchTarget.minimum,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surface,
      ...Shadows.soft,
    },
    fieldPressed: {
      backgroundColor: Colors.surfaceContainerLow,
    },
    fieldText: {
      flex: 1,
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
    },
    fieldTextActive: {
      color: Colors.textMain,
    },
  });
