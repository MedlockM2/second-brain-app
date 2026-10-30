import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";

/** Copies the complete stored Markdown, including its citation tags. */
export function CopyAnswerButton({ text }: { text: string }): React.JSX.Element {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state !== "copied" && state !== "failed") return;
    const timer = setTimeout(() => setState("idle"), state === "copied" ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    setState("copying");
    try {
      const copied = await Clipboard.setStringAsync(text);
      if (!copied) throw new Error("Clipboard write failed");
      setState("copied");
      AccessibilityInfo.announceForAccessibility(t("chat.thread.copied"));
    } catch {
      setState("failed");
      AccessibilityInfo.announceForAccessibility(t("chat.thread.copyFailed"));
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void copy()}
        disabled={state === "copying"}
        accessibilityRole="button"
        accessibilityLabel={t("chat.thread.copy")}
        accessibilityState={{ disabled: state === "copying" }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name={state === "copied" ? "checkmark" : "copy-outline"} size={18} color={colors.textSubtle} />
      </Pressable>
      {state === "failed" ? (
        <Text style={styles.error}>
          {t("chat.thread.copyFailed")}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  button: {
    minWidth: TouchTarget.minimum,
    minHeight: TouchTarget.minimum,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
  },
  pressed: { backgroundColor: colors.surfaceContainer },
  error: { flexShrink: 1, fontSize: Typography.small.fontSize, color: colors.error },
});
