/**
 * The question field of the conversation modal.
 *
 * Grows with the text up to four lines, then scrolls inside itself. The field
 * sizes itself from its content: the native text is measured again at every
 * keystroke, on iOS and Android alike. Its height is never driven from
 * `onContentSizeChange`: iOS only emits that event when the input's own layout
 * changes, so an imposed height froze the field at one line while the text
 * wrapped beneath it. Only an empty field gets an imposed height, one line: a
 * multiline field emptied by the app after a send otherwise keeps the measure
 * of the text it held, which left a four-line blank box under the thread.
 *
 * The line is measured from a hidden one-line sample set in the same type, so
 * the one-line and four-line bounds follow the system text size. The box clips
 * its content: the text never draws outside it.
 *
 * Drafts are never cut: the server checks the question and context budgets at
 * send time. Send and stop are two different buttons, never one that changes
 * meaning under the thumb: send while nothing is in flight, stop while an
 * answer is being written. Return inserts a line; only the button sends.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
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

const MAX_LINES = 4;
/** Any glyphs do: the sample only gives the height of one line of `body`. */
const LINE_SAMPLE = "Ag";

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
    // The unscaled token until the sample has been laid out.
    const [lineHeight, setLineHeight] = useState<number>(Typography.body.lineHeight);
    const onSampleLayout = (event: LayoutChangeEvent): void => {
      const measured = event.nativeEvent.layout.height;
      if (measured > 0) setLineHeight(measured);
    };

    return (
      <View style={styles.composer}>
        <View style={styles.field}>
          <View
            style={styles.sample}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.text} numberOfLines={1} onLayout={onSampleLayout}>
              {LINE_SAMPLE}
            </Text>
          </View>
          <TextInput
            ref={ref}
            style={[
              styles.text,
              styles.input,
              { minHeight: lineHeight, maxHeight: lineHeight * MAX_LINES },
              value.length === 0 && { height: lineHeight },
            ]}
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
      overflow: "hidden",
    },
    // Shared by the field and its line sample, so both measure the same line.
    text: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
    },
    sample: {
      position: "absolute",
      opacity: 0,
    },
    input: {
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
