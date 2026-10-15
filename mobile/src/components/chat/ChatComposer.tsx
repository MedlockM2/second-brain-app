/**
 * The question field of the conversation modal.
 *
 * Grows with the text up to four lines, then scrolls inside itself. Drafts are
 * never cut: the server checks the question and context budgets at send time.
 * Send and stop are two different buttons, never one that
 * changes meaning under the thumb: send while nothing is in flight, stop while an
 * answer is being written. Return inserts a line; only the button sends.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef } from "react";
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

export interface ChatComposerProps {
  onFocus?: () => void;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSend: () => void;
  onStop: () => void;
  /** An answer is in flight: stop is offered, send is not. */
  generating: boolean;
  /** A question is being sent. */
  sending: boolean;
}

export const ChatComposer = forwardRef<TextInput, ChatComposerProps>(
  function ChatComposer(
    { value, onChangeText, placeholder, onSend, onStop, generating, sending, onFocus },
    ref,
  ) {
    const Colors = useThemeColors();
    const styles = useThemedStyles(makeStyles);
    const canSend = value.trim().length > 0 && !generating && !sending;

    return (
      <View style={styles.composer}>
        <View style={styles.field}>
          <TextInput
            ref={ref}
            onFocus={onFocus}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            multiline
            scrollEnabled
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
      minHeight: LINE_HEIGHT,
      maxHeight: LINE_HEIGHT * MAX_LINES,
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
