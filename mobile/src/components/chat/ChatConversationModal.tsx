/**
 * TASK-501: the source is the first block of one full-screen conversation.
 * Presentation has no entrance animation. The route below stays mounted, so
 * conversation scrolling never changes its reading position or progression.
 */
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  findNodeHandle,
  Keyboard,
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
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../../constants/theme";
import {
  useTheme,
  useThemeColors,
  useThemedStyles,
} from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import type { ChatRefusal } from "../../lib/chatRefusal";
import type {
  ChatMessage,
  ChatSource,
} from "@media-summarizer/core/types/chat";
import { ChatComposer } from "./ChatComposer";
import { ChatThread, type ChatThreadProps } from "./ChatThread";
export interface ChatConversationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
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
  onNewConversation: () => void;
  sourceContent: React.ReactNode;
  initialSourceOffset: number;
  resetKey: number;
  /** The past conversations of the scope replace the thread while open (task-469). */
  historyOpen: boolean;
  onToggleHistory: () => void;
  history: React.ReactNode;
}

export function ChatConversationModal(
  props: ChatConversationModalProps,
): React.JSX.Element {
  const Colors = useThemeColors();
  const { mode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const focusRequested = useRef(false);
  const followBottom = useRef(false);
  const savedOffset = useRef(props.initialSourceOffset);
  const restoreOffset = useRef<number | null>(props.initialSourceOffset);
  const previousResetKey = useRef(props.resetKey);
  const scrollSize = useRef({ content: 0, viewport: 0 });
  const previousHistory = useRef(props.historyOpen);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useLayoutEffect(() => {
    // History and conversation use distinct native scroll views. Wait for both
    // fresh dimensions before restoring; the previous view's height can clamp
    // the requested source offset to zero before its content has been laid out.
    scrollSize.current = { content: 0, viewport: 0 };
    if (props.historyOpen) {
      Keyboard.dismiss();
    }
    if (previousHistory.current && !props.historyOpen) {
      restoreOffset.current = savedOffset.current;
    }
    previousHistory.current = props.historyOpen;
    if (previousResetKey.current !== props.resetKey) {
      savedOffset.current = 0;
      restoreOffset.current = 0;
      followBottom.current = false;
      previousResetKey.current = props.resetKey;
    }
    if (!props.historyOpen && focusRequested.current) {
      focusRequested.current = false;
      inputRef.current?.focus();
    }
  }, [props.historyOpen, props.resetKey]);

  const restoreOrFollow = () => {
    if (
      props.historyOpen ||
      !scrollSize.current.content ||
      !scrollSize.current.viewport
    )
      return;
    if (restoreOffset.current !== null) {
      scrollRef.current?.scrollTo({
        y: restoreOffset.current,
        animated: false,
      });
      restoreOffset.current = null;
    } else if (followBottom.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  };

  const startNew = () => {
    if (props.generating || props.sending) return;
    const create = () => {
      savedOffset.current = 0;
      restoreOffset.current = 0;
      followBottom.current = false;
      focusRequested.current = true;
      props.onNewConversation();
      // Starting from an empty conversation must focus the field too.
      if (!props.historyOpen) {
        focusRequested.current = false;
        inputRef.current?.focus();
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    };
    if (props.draft.trim()) {
      Alert.alert(
        t("chat.conversation.discardTitle"),
        t("chat.conversation.discardBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("chat.conversation.discardAction"),
            style: "destructive",
            onPress: create,
          },
        ],
      );
    } else create();
  };

  const refusalActionLabel =
    props.refusal?.action === "seePlans"
      ? t("quota.seePlans")
      : props.refusal?.action === "newConversation"
        ? t("chat.conversation.newConversation")
        : null;

  return (
    <Modal
      visible={props.visible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        const node = findNodeHandle(titleRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
        inputRef.current?.focus();
        restoreOrFollow();
      }}
      onRequestClose={props.onClose}
    >
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: props.historyOpen ? insets.bottom : 0,
          },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        accessibilityViewIsModal
        testID="chat-conversation-modal"
      >
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            onPress={props.onClose}
            accessibilityRole="button"
            accessibilityLabel={t("chat.conversation.closeA11y")}
            testID="chat-conversation-close"
          >
            <Ionicons name="close" size={22} color={Colors.textMain} />
          </Pressable>
          {props.historyOpen ? (
            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
              onPress={props.onToggleHistory}
              accessibilityRole="button"
              accessibilityLabel={t("chat.history.back")}
              testID="chat-history-back"
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
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
              onPress={props.onToggleHistory}
              accessibilityRole="button"
              accessibilityLabel={t("chat.history.open")}
              testID="chat-conversation-history"
            >
              <Ionicons name="time-outline" size={22} color={Colors.textMain} />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
              (props.generating || props.sending) && styles.disabled,
            ]}
            onPress={startNew}
            disabled={props.generating || props.sending}
            accessibilityRole="button"
            accessibilityState={{ disabled: props.generating || props.sending }}
            accessibilityLabel={t("chat.conversation.newConversation")}
            testID="chat-conversation-new"
          >
            <Ionicons name="create-outline" size={22} color={Colors.textMain} />
          </Pressable>
        </View>

        <ScrollView
          key={props.historyOpen ? "history" : `conversation-${props.resetKey}`}
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            followBottom.current = false;
            restoreOffset.current = null;
          }}
          onScroll={(event) => {
            if (props.historyOpen) return;
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            savedOffset.current = contentOffset.y;
            followBottom.current =
              contentSize.height - layoutMeasurement.height - contentOffset.y <=
              TouchTarget.minimum;
          }}
          onContentSizeChange={(_width, height) => {
            scrollSize.current.content = height;
            restoreOrFollow();
          }}
          onLayout={(event) => {
            scrollSize.current.viewport = event.nativeEvent.layout.height;
            restoreOrFollow();
          }}
        >
          {props.historyOpen ? (
            <View style={styles.gutter}>{props.history}</View>
          ) : (
            <>
              {props.sourceContent}
              <View style={styles.exchanges}>
                <ChatThread
                  messages={props.messages}
                  pendingQuestion={props.pendingQuestion}
                  sources={props.sources}
                  live={props.live}
                  waiting={props.waiting}
                  onRetry={(question) => {
                    followBottom.current = true;
                    restoreOffset.current = null;
                    props.onRetry(question);
                  }}
                  retryDisabled={props.generating || props.sending}
                  showSources={props.showSources}
                  onOpenSource={props.onOpenSource}
                />
              </View>
            </>
          )}
        </ScrollView>

        {!props.historyOpen && props.refusal ? (
          <View
            style={styles.refusal}
            accessibilityLiveRegion="polite"
            testID="chat-conversation-refusal"
          >
            <Text style={styles.refusalText}>{props.refusal.message}</Text>
            {props.refusal.action && refusalActionLabel ? (
              <Pressable
                style={({ pressed }) => [
                  styles.refusalAction,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  props.refusal!.action === "newConversation"
                    ? startNew()
                    : props.onRefusalAction(props.refusal!.action!)
                }
                accessibilityRole="button"
                accessibilityLabel={refusalActionLabel}
              >
                <Text style={styles.refusalActionLabel}>
                  {refusalActionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!props.historyOpen ? (
          <View
            style={[
              styles.composer,
              {
                paddingBottom: keyboardVisible
                  ? Spacing.sm
                  : Math.max(insets.bottom, Spacing.sm),
              },
            ]}
          >
            <ChatComposer
              ref={inputRef}
              value={props.draft}
              onChangeText={props.onChangeDraft}
              placeholder={props.placeholder}
              onSend={() => {
                restoreOffset.current = null;
                followBottom.current = true;
                props.onSend();
              }}
              onStop={props.onStop}
              generating={props.generating}
              sending={props.sending}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.sm,
    },
    title: { flex: 1, ...Typography.label, color: Colors.textMain },
    headerButton: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.full,
    },
    pressed: { backgroundColor: Colors.surfaceContainerLow },
    disabled: { opacity: 0.4 },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
    gutter: { paddingHorizontal: Spacing.lg },
    exchanges: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
    composer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
    refusal: {
      marginHorizontal: Spacing.md,
      backgroundColor: Colors.errorTint,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    refusalText: { ...Typography.label, color: Colors.textMain },
    refusalAction: {
      alignSelf: "flex-start",
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.primary,
    },
    refusalActionLabel: { ...Typography.label, color: Colors.onPrimary },
  });
