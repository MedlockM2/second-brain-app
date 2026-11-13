import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Spacing, Typography } from "../../constants/theme";
import { useThemeColors } from "../../contexts/ThemeContext";
import { BreathingDot } from "../BreathingDot";

/**
 * One breathing dot from submission until the first answer text arrives.
 *
 * `caption`, while the model searches the web (task-615): the same dot,
 * followed by a globe and the caption in `textSubtle`. The caption goes with
 * the first word of the answer, since the indicator does.
 */
export function ChatWaitingIndicator({
  label,
  caption,
}: {
  label: string;
  caption?: string | null;
}): React.JSX.Element {
  const colors = useThemeColors();

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={caption ?? label}
      accessibilityState={{ busy: true }}
    >
      <BreathingDot />
      {caption ? (
        <View style={styles.caption}>
          <Ionicons name="globe-outline" size={Typography.label.fontSize} color={colors.textSubtle} />
          <Text style={[styles.captionText, { color: colors.textSubtle }]}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  caption: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  captionText: { fontSize: Typography.label.fontSize },
});
