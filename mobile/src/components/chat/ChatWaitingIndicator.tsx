import React, { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useThemeColors } from "../../contexts/ThemeContext";
import { useReduceMotion } from "../../hooks/useReduceMotion";

/** One breathing dot from submission until the first answer text arrives. */
export function ChatWaitingIndicator({ label }: { label: string }): React.JSX.Element {
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
      style={styles.box}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Animated.View
        style={[styles.dot, { backgroundColor: colors.textMain, transform: [{ scale }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  dot: { width: 16, height: 16, borderRadius: 8 },
});
