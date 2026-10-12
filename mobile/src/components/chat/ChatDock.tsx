/** Contextual entry point; drafts survive closing/history, sessions live above navigation. */

import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../../constants/theme";
import { useChatSession } from "../../contexts/ChatSessionContext";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import { describeChatRefusal, type ChatRefusal } from "../../lib/chatRefusal";
import type { ChatScope, ChatSource } from "@media-summarizer/core/types/chat";
import { ChatHistoryList } from "./ChatHistoryList";
import { ChatConversationModal } from "./ChatConversationModal";

export interface ChatDockProps {
  scope: ChatScope;
  scopeId: string;
  title: string;
  /** Rendered in the same scroll view as the exchanges, with its own page gutters. */
  sourceContent: React.ReactNode;
  /** Read at opening, relative to the beginning of the source block. */
  getSourceOffset: () => number;
  /** Space to keep under the dock: the safe area, when no tab bar covers it. */
  bottomInset?: number;
}

export function ChatDock({
  scope,
  scopeId,
  title,
  sourceContent,
  getSourceOffset,
  bottomInset = 0,
}: ChatDockProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const isFocused = useIsFocused();
  const chat = useChatSession(scope, scopeId);
  const { session } = chat;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [initialSourceOffset, setInitialSourceOffset] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const dockRef = useRef<View>(null);

  const generating = session.generation !== null;
  const sending = session.phase === "sending";
  const refusal = session.error
    ? describeChatRefusal(session.error, scope)
    : null;
  const isFolder = scope === "folder";

  // The native modal covers the Digest carousel as well as the current page.
  // Leaving for a citation hides it; the session and generation go on.
  const modalVisible = open && isFocused;

  // Spoken once when an answer starts and once when it is there — never fragment
  // by fragment, which would drown the screen reader.
  const wasGenerating = useRef(generating);
  useEffect(() => {
    if (generating && !wasGenerating.current) {
      AccessibilityInfo.announceForAccessibility(t("chat.a11y.answerStarted"));
    } else if (!generating && wasGenerating.current) {
      const last = session.conversation?.messages.at(-1);
      AccessibilityInfo.announceForAccessibility(
        t(
          last?.status === "failed"
            ? "chat.thread.failed"
            : last?.status === "interrupted"
              ? "chat.a11y.answerInterrupted"
              : "chat.a11y.answerReady",
        ),
      );
    }
    wasGenerating.current = generating;
  }, [generating, session.conversation]);

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setHistoryOpen(false);
    // Back on the control that opened the modal.
    const node = findNodeHandle(dockRef.current);
    if (node)
      setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 400);
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text) return;
    if (await chat.sendQuestion(text)) {
      setDraft((current) => (current.trim() === text ? "" : current));
    }
  };

  const stop = async () => {
    // The explicit stop: the only call site of the stop route.
    await chat.stopGeneration();
  };

  // The modal is left open: it hides with this screen while the media is read
  // and is back on the conversation when the user returns.
  const openSource = (source: ChatSource) => {
    router.push(`/media/${source.media_item_id}`);
  };

  const handleRefusalAction = (action: NonNullable<ChatRefusal["action"]>) => {
    chat.dismissError();
    if (action === "seePlans") {
      setOpen(false);
      router.push({
        pathname: "/paywall",
        params: { reason: "out_of_minutes" },
      });
      return;
    }
    chat.clearActive();
  };

  const conversation = session.conversation;
  const restingLabel = isFolder
    ? t("chat.dock.askFolder")
    : t("chat.dock.askMedia");

  return (
    <View style={[styles.dock, { paddingBottom: Spacing.sm + bottomInset }]}>
      <Pressable
        ref={dockRef}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        onPress={() => {
          setInitialSourceOffset(getSourceOffset());
          setHistoryOpen(false);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={restingLabel}
        accessibilityHint={t("chat.dock.openA11y")}
        testID={`chat-dock-${scope}`}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={20}
          color={generating ? Colors.textMain : Colors.textMuted}
        />
        <Text
          style={[styles.fieldText, generating && styles.fieldTextActive]}
          numberOfLines={1}
        >
          {draft.trim() && !generating ? draft : restingLabel}
        </Text>
      </Pressable>

      {modalVisible ? (
        <ChatConversationModal
          visible
          sourceContent={sourceContent}
          initialSourceOffset={initialSourceOffset}
          resetKey={resetKey}
          onClose={close}
          title={title}
          placeholder={
            isFolder ? t("chat.dock.askFolder") : t("chat.dock.askMedia")
          }
          messages={conversation?.messages ?? []}
          pendingQuestion={session.pendingQuestion}
          sources={conversation?.sources ?? []}
          showSources={isFolder}
          onOpenSource={openSource}
          live={
            session.generation
              ? {
                  turnIndex: session.generation.turn_index,
                  text: session.streamingText,
                }
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
                  chat.dismissError();
                  setHistoryOpen(false);
                  setResetKey((value) => value + 1);
                  void chat.selectConversation(conversationId);
                }}
                onDelete={(conversationId) =>
                  chat.deleteConversation(conversationId)
                }
              />
            ) : null
          }
          onNewConversation={() => {
            chat.dismissError();
            chat.clearActive();
            setDraft("");
            setHistoryOpen(false);
            setResetKey((value) => value + 1);
          }}
        />
      ) : null}
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
