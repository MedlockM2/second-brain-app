/**
 * The question field of the chat sheet.
 *
 * Grows with the text up to four lines, then scrolls inside itself; the counter
 * shows where the question stands against the server's ceiling
 * (`MAX_QUESTION_CHARS`, `core/services/chat_prompt.py`), which the field never
 * lets the user pass. Send and stop are two different buttons, never one that
 * changes meaning under the thumb: send while nothing is in flight, stop while an
 * answer is being written. Return inserts a line; only the button sends.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { formatNumber, t } from "../../i18n";

/** Mirrors the server's ceiling on one question. */
export const MAX_QUESTION_CHARS = 1_000;
const LINE_HEIGHT = 22;
const MAX_LINES = 4;

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
  /** Takes the keyboard as the field mounts — `ChatSheet` decides when. */
  autoFocus?: boolean;
}

export const ChatComposer = forwardRef<TextInput, ChatComposerProps>(function ChatComposer(
  { value, onChangeText, placeholder, onSend, onStop, generating, sending, autoFocus = false },
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
          autoFocus={autoFocus}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          multiline
          scrollEnabled
          maxLength={MAX_QUESTION_CHARS}
          accessibilityLabel={placeholder}
          accessibilityHint={t("chat.composer.hint")}
          testID="chat-composer-input"
        />
        <Text style={styles.counter} accessibilityElementsHidden importantForAccessibility="no">
          {t("chat.composer.counter", {
            count: formatNumber(value.length),
            max: formatNumber(MAX_QUESTION_CHARS),
          })}
        </Text>
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
          <Text style={styles.stopLabel}>{t("chat.composer.stop")}</Text>
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
          accessibilityLabel={t(sending ? "chat.thread.sending" : "chat.composer.sendA11y")}
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
});

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Spacing.sm,
    },
    field: {
      flex: 1,
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
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
    counter: {
      alignSelf: "flex-end",
      fontSize: Typography.small.fontSize,
      color: Colors.textMuted,
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
      minWidth: TouchTarget.minimum,
      height: TouchTarget.minimum,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    stopLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
  });
