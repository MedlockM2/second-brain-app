import { Pressable, StyleSheet, Text } from "react-native";
import { Spacing, Typography } from "../constants/theme";
import { useThemeColors } from "../contexts/ThemeContext";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";

/** A failed revalidation never replaces readable session data. */
export function ResourceRefreshNotice({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry: () => void;
}) {
  const colors = useThemeColors();
  if (!error && !message) return null;
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      style={styles.notice}
    >
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {message ?? getFriendlyErrorMessage(error)} · {t("common.retry")}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  notice: { padding: Spacing.md },
  text: {
    fontSize: Typography.small.fontSize,
    lineHeight: Typography.body.lineHeight,
  },
});
