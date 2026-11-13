import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from "react-native";
import { BorderRadius, Spacing, type Theme } from "../constants/theme";
import { useThemedStyles } from "../contexts/ThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";

/**
 * The shape of a text that is not there yet: a title bar and three paragraphs
 * of grey lines, swept by a lighter band on a loop.
 *
 * Variant **C — « Forme du texte »** of the mockup
 * `mobile-design-mockups/chargement_import_media/`, retained by the owner on
 * 2026-11-13 (TestFlight feedback AM6k6fv3QCFz8rAOZnqS9KM). It stands where the
 * Reader's text will appear, so the page keeps its layout when the text lands.
 *
 * The sweep follows `MediaProcessingSweep`: one `Animated.Value`, a band moved
 * with the native driver, a slow period, and no movement at all under the
 * system's reduced-motion setting. The band is cut into a soft edge, a core and
 * a soft edge, since the app ships no gradient library. Every line clips the
 * same band at the same x, so the lines read as one surface being swept.
 *
 * Decoration only: the caller carries the accessible role and label.
 */

/** Line widths, in reading order; `null` is the gap between two paragraphs. */
const LINES: (DimensionValue | null)[] = [
  "100%", "96%", "99%", "72%", null,
  "98%", "100%", "94%", "58%", null,
  "97%", "88%",
];

const SWEEP_DURATION_MS = 1600;
const BAND_RATIO = 0.35;
const SWEEPS_TOWARDS_END = !I18nManager.isRTL;

export function TextSkeleton(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const progress = useMemo(() => new Animated.Value(0), []);
  const bandWidth = Math.round(width * BAND_RATIO);
  const moving = !reduceMotion && width > 0;

  useEffect(() => {
    if (!moving) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: SWEEPS_TOWARDS_END ? [-bandWidth, width] : [width, -bandWidth],
  });

  const band = moving ? (
    <Animated.View
      style={[styles.band, { width: bandWidth, transform: [{ translateX }] }]}
    >
      <View style={[styles.slice, styles.edge]} />
      <View style={[styles.slice, styles.core]} />
      <View style={[styles.slice, styles.edge]} />
    </Animated.View>
  ) : null;

  return (
    <View
      style={styles.container}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(Math.round(event.nativeEvent.layout.width))
      }
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.line, styles.title]}>{band}</View>
      {LINES.map((lineWidth, index) =>
        lineWidth === null ? (
          <View key={index} style={styles.paragraphGap} />
        ) : (
          <View key={index} style={[styles.line, { width: lineWidth }]}>
            {band}
          </View>
        ),
      )}
    </View>
  );
}

const LINE_HEIGHT = 14;

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      gap: Spacing.md - Spacing.xs,
    },
    line: {
      height: LINE_HEIGHT,
      borderRadius: LINE_HEIGHT / 2,
      backgroundColor: Colors.surfaceContainer,
      overflow: "hidden",
    },
    // The heading of the text, "Texte complet" once it is there.
    title: {
      width: "46%",
      height: 22,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    paragraphGap: {
      height: LINE_HEIGHT,
    },
    band: {
      position: "absolute",
      top: 0,
      bottom: 0,
      // Physical, not `start`: placed on the axis `translateX` moves it along.
      left: 0,
      flexDirection: "row",
    },
    slice: {
      height: "100%",
      backgroundColor: Colors.surfaceContainerHigh,
    },
    edge: {
      flex: 1,
      opacity: 0.5,
    },
    core: {
      flex: 2,
    },
  });
