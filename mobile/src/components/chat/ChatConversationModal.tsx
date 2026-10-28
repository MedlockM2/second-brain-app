/**
 * TASK-501: the source is the first block of one full-screen conversation.
 * Presentation has no entrance animation. The route below stays mounted, so
 * conversation scrolling never changes its reading position or progression.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRecoverableImage } from "../../hooks/useRecoverableImage";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  findNodeHandle,
  Keyboard,
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
import { useKeyboardViewport } from "../../hooks/useKeyboardViewport";
import { BudgetForecastNotice } from "../BudgetForecastNotice";
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
  conversationId?: string;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onCancelPending: () => void;
  onRetry: (question: string) => void;
  refusal: ChatRefusal | null;
  onRefusalAction: (action: NonNullable<ChatRefusal["action"]>) => void;
  onNewConversation: () => void;
  sourceContent: React.ReactNode;
  initialOffset: number;
  onSaveOffset: (offset: number) => void;
  scrollTarget: "offset" | "bottom";
  focusOnOpen: boolean;
  scope: "media" | "folder";
  imageUrl?: string | null;
  mediaTypeIcon?: React.ComponentProps<typeof Ionicons>["name"];
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
  const keyboardViewport = useRef<View>(null);
  const keyboard = useKeyboardViewport(keyboardViewport, props.visible);
  const focusRequested = useRef(false);
  const followBottom = useRef(props.scrollTarget === "bottom");
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const image = useRecoverableImage(props.imageUrl?.trim() ?? "", props.title);
  const pendingBottom = useRef(props.scrollTarget === "bottom");
  const userScrolling = useRef(false);
  const leavingForSource = useRef(false);
  const savedOffset = useRef(props.initialOffset);
  const restoreOffset = useRef<number | null>(props.scrollTarget === "bottom" ? null : props.initialOffset);
  const previousResetKey = useRef(props.resetKey);
  const scrollSize = useRef({ content: 0, viewport: 0 });
  const previousHistory = useRef(props.historyOpen);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);


  useLayoutEffect(() => {
    // History and conversation use distinct native scroll views. Wait for both
    // fresh dimensions before restoring; the previous view's height can clamp
    // the requested source offset to zero before its content has been laid out.
    if (previousHistory.current !== props.historyOpen || previousResetKey.current !== props.resetKey) {
      scrollSize.current = { content: 0, viewport: 0 };
    }
    if (props.historyOpen) {
      Keyboard.dismiss();
    }
    if (previousHistory.current && !props.historyOpen) {
      restoreOffset.current = savedOffset.current;
    }
    previousHistory.current = props.historyOpen;
    if (previousResetKey.current !== props.resetKey) {
      savedOffset.current = 0;
      pendingBottom.current = props.scrollTarget === "bottom";
      restoreOffset.current = pendingBottom.current ? null : props.initialOffset;
      followBottom.current = pendingBottom.current;
      previousResetKey.current = props.resetKey;
    }
    if (!props.historyOpen && focusRequested.current) {
      focusRequested.current = false;
      inputRef.current?.focus();
    }
  }, [props.historyOpen, props.resetKey, props.scrollTarget, props.initialOffset]);

  const restoreOrFollow = () => {
    if (
      props.historyOpen || leavingForSource.current ||
      !scrollSize.current.content ||
      !scrollSize.current.viewport
    )
      return;
    const maxOffset = Math.max(0, scrollSize.current.content - scrollSize.current.viewport);
    if (pendingBottom.current) {
      pendingBottom.current = false;
      restoreOffset.current = null;
      followBottom.current = true;
      savedOffset.current = maxOffset;
      scrollRef.current?.scrollToEnd({ animated: false });
    } else if (restoreOffset.current !== null) {
      savedOffset.current = Math.min(maxOffset, Math.max(0, restoreOffset.current));
      scrollRef.current?.scrollTo({ y: savedOffset.current, animated: false });
      restoreOffset.current = null;
    } else if (followBottom.current) {
      savedOffset.current = maxOffset;
      scrollRef.current?.scrollToEnd({ animated: false });
    }
    props.onSaveOffset(savedOffset.current);
    setAwayFromBottom(maxOffset - savedOffset.current > TouchTarget.minimum);
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
        keyboard.refresh();
        // A single focus destination: do not compete with the input's native
        // first responder while its keyboard is opening.
        if (props.focusOnOpen && !props.historyOpen) {
          inputRef.current?.focus();
        } else {
          const node = findNodeHandle(titleRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
        restoreOrFollow();
      }}
      onRequestClose={props.onClose}
    >
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <View ref={keyboardViewport} style={styles.root} onLayout={keyboard.measure} collapsable={false}>
      <View
        style={[
          styles.root,
          keyboard.height !== null && { flex: 0, height: keyboard.height },
          {
            paddingTop: insets.top,
            paddingBottom: props.historyOpen ? insets.bottom : 0,
          },
        ]}
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
            <Ionicons name="close" size={26} color={Colors.textMain} />
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
              <Ionicons name="arrow-back" size={26} color={Colors.textMain} />
            </Pressable>
          ) : null}
          {!props.historyOpen ? (
            <View style={styles.identity} accessible={false}>
              {props.scope === "media" && image.showImage ? (
                <Image key={image.attempt} source={{ uri: props.imageUrl! }}
                  style={styles.thumbnail} contentFit="cover" cachePolicy="memory-disk"
                  onError={image.onError} accessible={false} />
              ) : (
                <Ionicons name={props.scope === "folder" ? "folder" : props.mediaTypeIcon ?? "document-text-outline"}
                  size={24} color={Colors.textMain} />
              )}
            </View>
          ) : null}
          <Text
            ref={titleRef}
            style={styles.title}
            accessibilityRole="header"
            numberOfLines={2}
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
              <Ionicons name="time-outline" size={26} color={Colors.textMain} />
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
            <Ionicons name="create-outline" size={26} color={Colors.textMain} />
          </Pressable>
        </View>

        <View style={styles.scrollArea}>
        <ScrollView
          key={props.historyOpen ? "history" : `conversation-${props.resetKey}`}
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          automaticallyAdjustKeyboardInsets={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            userScrolling.current = true;
            followBottom.current = false;
            pendingBottom.current = false;
            restoreOffset.current = null;
          }}
          onScrollEndDrag={() => { userScrolling.current = false; }}
          onMomentumScrollBegin={() => { userScrolling.current = true; }}
          onMomentumScrollEnd={() => { userScrolling.current = false; }}
          onScroll={(event) => {
            if (props.historyOpen || leavingForSource.current) return;
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            if (restoreOffset.current !== null || pendingBottom.current) return;
            savedOffset.current = Math.max(0, contentOffset.y);
            props.onSaveOffset(savedOffset.current);
            const nearBottom = contentSize.height - layoutMeasurement.height - contentOffset.y <= TouchTarget.minimum;
            setAwayFromBottom(!nearBottom);
            if (userScrolling.current || nearBottom) followBottom.current = nearBottom;
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
                  onCancelPending={props.onCancelPending}
                  sources={props.sources}
                  live={props.live}
                  waiting={props.waiting}
                  onRetry={(question) => {
                    userScrolling.current = false;
                    followBottom.current = true;
                    restoreOffset.current = null;
                    props.onRetry(question);
                  }}
                  retryDisabled={props.generating || props.sending || props.pendingQuestion?.status === "waiting_for_source"}
                  showSources={props.showSources}
                  onOpenSource={(source) => {
                    leavingForSource.current = true;
                    followBottom.current = false;
                    props.onSaveOffset(savedOffset.current);
                    props.onOpenSource(source);
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>
        {!props.historyOpen && awayFromBottom && (props.messages.length > 0 || props.live) ? (
          <Pressable style={({ pressed }) => [styles.jumpBottom, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel={t("chat.conversation.jumpToBottom")}
            onPress={() => {
              userScrolling.current = false;
              pendingBottom.current = false;
              restoreOffset.current = null;
              followBottom.current = true;
              scrollRef.current?.scrollToEnd({ animated: !reduceMotion });
            }}>
            <Ionicons name="arrow-down" size={24} color={Colors.textMain} />
          </Pressable>
        ) : null}
        </View>

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
                paddingBottom: keyboard.keyboardVisible
                  ? Spacing.sm
                  : Math.max(insets.bottom, Spacing.sm),
              },
            ]}
          >
            {props.draft.trim() && !props.generating ? <BudgetForecastNotice request={props.conversationId ? { operation: "chat_turn", conversation_id: props.conversationId, question: props.draft } : null} /> : null}
            <ChatComposer
              ref={inputRef}
              value={props.draft}
              onChangeText={props.onChangeDraft}
              placeholder={props.placeholder}
              onSend={() => {
                userScrolling.current = false;
                restoreOffset.current = null;
                followBottom.current = true;
                props.onSend();
              }}
              onStop={props.onStop}
              generating={props.generating}
              sending={props.sending}
              blocked={props.pendingQuestion?.status === "waiting_for_source"}
            />
          </View>
        ) : null}
      </View>
      </View>
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
      minHeight: TouchTarget.comfortable,
    },
    title: { flex: 1, fontSize: 18, fontWeight: Typography.headline.fontWeight, color: Colors.textMain },
    identity: { width: 32, marginEnd: Spacing.sm, alignItems: "center" },
    thumbnail: { width: 32, height: 32, borderRadius: BorderRadius.sm },
    headerButton: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.full,
    },
    pressed: { backgroundColor: Colors.surfaceContainerLow },
    disabled: { opacity: 0.4 },
    scrollArea: { flex: 1 },
    scroll: { flex: 1 },
    jumpBottom: {
      position: "absolute", bottom: Spacing.sm, alignSelf: "center",
      width: TouchTarget.minimum, height: TouchTarget.minimum,
      borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center",
      backgroundColor: Colors.surfaceContainerHigh,
    },
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
