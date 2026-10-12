/**
 * The conversation sheet the dock opens (direction F of task-434, adapted to a
 * screen component — see `ChatDock`).
 *
 * A modal rising from the bottom, over the page it was opened from: the page
 * stays visible above it, which keeps the scope of the question in sight. Inside
 * a modal on purpose: the keyboard and the sheet then live outside the page's
 * scroll views — including the Digest's horizontal carousel, which the keyboard
 * would otherwise scroll to another page.
 *
 * Closing the sheet only hides it. The conversation and the answer being written
 * are held by `ChatSessionContext`, above the navigation.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import type { ChatRefusal } from "../../lib/chatRefusal";
import type { ChatMessage, ChatSource } from "@media-summarizer/core/types/chat";
import { ChatComposer } from "./ChatComposer";
import { ChatThread, type ChatThreadProps } from "./ChatThread";

/**
 * Whether the field asks for the keyboard as it mounts rather than in `onShow`,
 * so that the keyboard rises with the sheet in one movement. The two platforms
 * fire the modal's `onShow` at different moments, and that is the whole reason:
 *
 * - iOS fires it in the completion of the presentation, once the slide is over.
 *   A focus there brought the keyboard — and the sheet the avoider lifts on it —
 *   in a second movement after the sheet. Taken as the field enters the window
 *   (`autoFocus`), first responder raises the keyboard while the sheet slides in,
 *   and the avoider lifts the sheet on the keyboard's own curve.
 * - Android fires it as the dialog is shown, before its enter animation, so a
 *   focus there already raises the keyboard with the sheet. Taken as the field is
 *   attached, it would come before the dialog window holds input focus, and the
 *   input method manager ignores a request to show the keyboard from such a view.
 */
const KEYBOARD_ON_MOUNT = Platform.OS === "ios";

export interface ChatSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  emptyText: string;
  placeholder: string;
  messages: ChatMessage[];
  pendingQuestion: ChatThreadProps["pendingQuestion"];
  sources: ChatSource[];
  showSources: ChatThreadProps["showSources"];
  onOpenSource: ChatThreadProps["onOpenSource"];
  live: { turnIndex: number; text: string } | null;
  waiting: boolean;
  generating: boolean;
  sending: boolean;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRetry: (question: string) => void;
  refusal: ChatRefusal | null;
  onRefusalAction: (action: NonNullable<ChatRefusal["action"]>) => void;
  /** Offered once the conversation has turns. */
  onNewConversation: (() => void) | null;
  /** The past conversations of the scope replace the thread while open (task-469). */
  historyOpen: boolean;
  onToggleHistory: () => void;
  history: React.ReactNode;
}

export function ChatSheet(props: ChatSheetProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Whether the history list has been shown since the sheet rose. The field that
  // comes back from it does not take the keyboard: the user went there to read.
  // Re-armed while the sheet is hidden, so every opening on the conversation
  // starts with the keyboard.
  const [historyShown, setHistoryShown] = useState(false);
  if (!props.visible && historyShown) setHistoryShown(false);
  if (props.visible && props.historyOpen && !historyShown) setHistoryShown(true);

  const handleShow = () => {
    // The screen reader goes to the title once the sheet is up.
    const node = findNodeHandle(titleRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    // Android asks for the keyboard here (`KEYBOARD_ON_MOUNT`). On iOS the field
    // already holds it and this does nothing — unless it could not take it as it
    // mounted, when the field outlived a close and a quick reopen.
    inputRef.current?.focus();
  };

  const refusalActionLabel =
    props.refusal?.action === "seePlans"
      ? t("quota.seePlans")
      : props.refusal?.action === "newConversation"
        ? t("chat.sheet.newConversation")
        : null;

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onShow={handleShow}
      onRequestClose={props.onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel={t("chat.sheet.closeA11y")}
        />
        <KeyboardAvoidingView
          style={styles.avoider}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
            testID="chat-sheet"
          >
            <View style={styles.header}>
              {props.historyOpen ? (
                <Pressable
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                  onPress={props.onToggleHistory}
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.history.back")}
                  testID="chat-sheet-history-back"
                >
                  <Ionicons name="arrow-back" size={22} color={Colors.textMain} />
                </Pressable>
              ) : null}
              <Text
                ref={titleRef}
                style={styles.title}
                accessibilityRole="header"
                numberOfLines={1}
              >
                {props.historyOpen ? t("chat.history.title") : props.title}
              </Text>
              {!props.historyOpen ? (
                <Pressable
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                  onPress={props.onToggleHistory}
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.history.open")}
                  testID="chat-sheet-history"
                >
                  <Ionicons name="time-outline" size={22} color={Colors.textMain} />
                </Pressable>
              ) : null}
              {props.onNewConversation ? (
                <Pressable
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                  onPress={props.onNewConversation}
                  disabled={props.generating || props.sending}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: props.generating || props.sending }}
                  accessibilityLabel={t("chat.sheet.newConversation")}
                  testID="chat-sheet-new"
                >
                  <Ionicons name="create-outline" size={22} color={Colors.textMain} />
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                onPress={props.onClose}
                accessibilityRole="button"
                accessibilityLabel={t("chat.sheet.closeA11y")}
                testID="chat-sheet-close"
              >
                <Ionicons name="close" size={24} color={Colors.textMain} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.threadScroll}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => {
                if (!props.historyOpen) scrollRef.current?.scrollToEnd({ animated: true });
              }}
            >
              {props.historyOpen ? (
                props.history
              ) : props.messages.length === 0 && !props.pendingQuestion ? (
                <Text style={styles.empty}>{props.emptyText}</Text>
              ) : (
                <ChatThread
                  messages={props.messages}
                  pendingQuestion={props.pendingQuestion}
                  sources={props.sources}
                  live={props.live}
                  waiting={props.waiting}
                  onRetry={props.onRetry}
                  retryDisabled={props.generating || props.sending}
                  showSources={props.showSources}
                  onOpenSource={props.onOpenSource}
                />
              )}
            </ScrollView>

            {!props.historyOpen && props.refusal ? (
              <View
                style={styles.refusal}
                accessibilityLiveRegion="polite"
                testID="chat-sheet-refusal"
              >
                <Text style={styles.refusalText}>{props.refusal.message}</Text>
                {props.refusal.action && refusalActionLabel ? (
                  <Pressable
                    style={({ pressed }) => [styles.refusalAction, pressed && styles.pressed]}
                    onPress={() => props.onRefusalAction(props.refusal!.action!)}
                    accessibilityRole="button"
                    accessibilityLabel={refusalActionLabel}
                  >
                    <Text style={styles.refusalActionLabel}>{refusalActionLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {props.historyOpen ? null : (
              <ChatComposer
                ref={inputRef}
                autoFocus={KEYBOARD_ON_MOUNT && !historyShown}
                value={props.draft}
                onChangeText={props.onChangeDraft}
                placeholder={props.placeholder}
                onSend={props.onSend}
                onStop={props.onStop}
                generating={props.generating}
                sending={props.sending}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Colors.scrim,
    },
    avoider: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "88%",
      backgroundColor: Colors.surface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
      ...Shadows.soft,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    title: {
      flex: 1,
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    headerButton: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.full,
    },
    pressed: {
      backgroundColor: Colors.surfaceContainerLow,
    },
    threadScroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    threadContent: {
      paddingVertical: Spacing.sm,
    },
    empty: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textSubtle,
      paddingVertical: Spacing.lg,
    },
    refusal: {
      backgroundColor: Colors.errorTint,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    refusalText: {
      fontSize: Typography.label.fontSize,
      color: Colors.textMain,
    },
    refusalAction: {
      alignSelf: "flex-start",
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.primary,
    },
    refusalActionLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.onPrimary,
    },
  });
