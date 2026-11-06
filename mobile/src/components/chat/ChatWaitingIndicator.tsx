import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Spacing, Typography } from "../../constants/theme";
import { useThemeColors } from "../../contexts/ThemeContext";
import { useReduceMotion } from "../../hooks/useReduceMotion";

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
  const reduceMotion = useReduceMotion();
  const scale = useMemo(() => new Animated.Value(0.65), []);

  useEffect(() => {
    scale.setValue(reduceMotion ? 1 : 0.65);
    if (reduceMotion) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(scale, {
          toValue: 0.65,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduceMotion, scale]);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={caption ?? label}
      accessibilityState={{ busy: true }}
    >
      <View style={styles.box}>
        <Animated.View
          style={[styles.dot, { backgroundColor: colors.textMain, transform: [{ scale }] }]}
        />
      </View>
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
  box: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  dot: { width: 16, height: 16, borderRadius: 8 },
  caption: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  captionText: { fontSize: Typography.label.fontSize },
});
