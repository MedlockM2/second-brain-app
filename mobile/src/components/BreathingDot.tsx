import React, { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { BorderRadius, Spacing } from "../constants/theme";
import { useThemeColors } from "../contexts/ThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";

const RESTING_SCALE = 0.65;
const HALF_BREATH_MS = 600;

/**
 * The app's one sign that something is being prepared: a dot in `textMain`
 * that grows and shrinks on a 1.2 s loop (task-574), and holds still at full
 * size under the system's reduced-motion setting.
 *
 * Drawn by the chat until the first word of an answer (`ChatWaitingIndicator`)
 * and by the Reader tab of a media still being imported
 * (`MediaProcessingState`), so a wait looks the same wherever it happens.
 * Decoration only: the caller carries the accessible role and label.
 */
export function BreathingDot(): React.JSX.Element {
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  const scale = useMemo(() => new Animated.Value(RESTING_SCALE), []);

  useEffect(() => {
    scale.setValue(reduceMotion ? 1 : RESTING_SCALE);
    if (reduceMotion) return;

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1,
          duration: HALF_BREATH_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(scale, {
          toValue: RESTING_SCALE,
          duration: HALF_BREATH_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [reduceMotion, scale]);

  return (
    <View style={styles.box}>
      <Animated.View
        style={[styles.dot, { backgroundColor: colors.textMain, transform: [{ scale }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: Spacing.lg, height: Spacing.lg, alignItems: "center", justifyContent: "center" },
  dot: { width: Spacing.md, height: Spacing.md, borderRadius: BorderRadius.full },
});
