/**
 * The question field of the conversation modal.
 *
 * Grows with the text up to four lines, then scrolls inside itself. The height
 * is driven from the measured content, not left to the native field: a multiline
 * iOS field emptied by the app after a send keeps the height of the text it held,
 * which left a four-line blank box under the thread. Drafts are
 * never cut: the server checks the question and context budgets at send time.
 * Send and stop are two different buttons, never one that
 * changes meaning under the thumb: send while nothing is in flight, stop while an
 * answer is being written. Return inserts a line; only the button sends.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";

const LINE_HEIGHT = Typography.body.lineHeight;
const MAX_LINES = 4;
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES;

export interface ChatComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSend: () => void;
  onStop: () => void;
  /** An answer is in flight: stop is offered, send is not. */
  generating: boolean;
  /** A question is being sent. */
  sending: boolean;
  blocked?: boolean;
}

export const ChatComposer = forwardRef<TextInput, ChatComposerProps>(
  function ChatComposer(
    { value, onChangeText, placeholder, onSend, onStop, generating, sending, blocked = false },
    ref,
  ) {
    const Colors = useThemeColors();
    const styles = useThemedStyles(makeStyles);
    const canSend = value.trim().length > 0 && !generating && !sending && !blocked;
    const [contentHeight, setContentHeight] = useState<number>(LINE_HEIGHT);
    useEffect(() => {
      if (value.length === 0) setContentHeight(LINE_HEIGHT);
    }, [value]);
    // An empty field is one line, whatever the last measure said: the native
    // field does not always report its shrink when the app clears it.
    const height =
      value.length === 0
        ? LINE_HEIGHT
        : Math.min(Math.max(contentHeight, LINE_HEIGHT), MAX_HEIGHT);

    return (
      <View style={styles.composer}>
        <View style={styles.field}>
          <TextInput
            ref={ref}
            style={[styles.input, { height }]}
            value={value}
            onChangeText={onChangeText}
            onContentSizeChange={(event) =>
              setContentHeight(event.nativeEvent.contentSize.height)
            }
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            multiline
            scrollEnabled={contentHeight > MAX_HEIGHT}
            accessibilityLabel={placeholder}
            accessibilityHint={t("chat.composer.hint")}
            testID="chat-composer-input"
          />
        </View>
        {generating ? (
          <Pressable
            style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel={t("chat.composer.stopA11y")}
            testID="chat-composer-stop"
          >
            <Ionicons name="stop" size={18} color={Colors.textMain} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.send,
              pressed && styles.pressed,
              !canSend && styles.disabled,
            ]}
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            accessibilityLabel={t(
              sending ? "chat.thread.sending" : "chat.composer.sendA11y",
            )}
            testID="chat-composer-send"
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <Ionicons name="arrow-up" size={22} color={Colors.onPrimary} />
            )}
          </Pressable>
        )}
      </View>
    );
  },
);

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Spacing.sm,
    },
    field: {
      flex: 1,
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    input: {
      fontSize: Typography.body.fontSize,
      lineHeight: LINE_HEIGHT,
      color: Colors.textMain,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: "top",
    },
    send: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.primary,
    },
    stop: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.full,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
  });
