/**
 * The row of an artifact being generated, at the top of the AI tab's list
 * (task-534, mockup `mobile-design-mockups/ai_tab_notebooklm/`).
 *
 * It says what is happening — "Generating…", then the format, the expected
 * wait and that the screen can be left — and it moves, because nothing else on
 * the tab does while a generation runs:
 *
 * - an amber sheen crosses the row from right to left, in a loop of 1.8 s;
 * - two sparkles twinkle on the format's icon, half a period apart.
 *
 * Both use the core `Animated` API on the native driver (only `transform` and
 * `opacity` move), so the animation adds no dependency and runs off the JS
 * thread. The sheen has no gradient primitive to lean on — `expo-linear-gradient`
 * would be a new native module, hence a new build — so it is a band of thin
 * stripes of the primary amber whose opacities follow a bell: sheer enough at
 * each step that the band reads as one soft glow.
 *
 * Under "Reduce Motion" nothing moves: no sheen, and the sparkles stay drawn,
 * still, at full opacity — the row still says what it is without the motion.
 *
 * The row does not open: there is nothing to read yet. It is a single
 * accessible element marked busy, not a button.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  I18nManager,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { artifactFormatOf } from "../lib/artifactFormats";
import { t } from "../i18n";
import type { ArtifactType } from "@media-summarizer/core/types/media";

/** The mockup's period for one pass of the sheen. */
const SWEEP_DURATION_MS = 1800;

/** One full twinkle of a sparkle, dim → bright → dim: the mockup's 1.2 s. */
const TWINKLE_HALF_PERIOD_MS = 600;

/**
 * The sheen's opacity at its brightest: the mockup's `rgba(255, 203, 5, .28)`.
 * Text stays readable under it — `textSubtle` measures 4.92:1 on the light peak
 * and 5.32:1 on the dark one (DARK_THEME_CONTRAST.md).
 */
const SHEEN_PEAK_OPACITY = 0.28;

/**
 * How many stripes the band is cut into. Enough that two neighbours differ by
 * under 4 % opacity, which keeps the steps invisible on a moving band; still
 * only a couple of dozen plain views, drawn once and moved as one.
 */
const SHEEN_STRIPES = 24;

/**
 * Each stripe's opacity: a Hann bell across the band, zero at both ends and
 * `SHEEN_PEAK_OPACITY` in the middle — the mockup's transparent → amber →
 * transparent gradient, sampled.
 */
const SHEEN_STRIPE_STYLES = Array.from({ length: SHEEN_STRIPES }, (_, index) => ({
  opacity:
    SHEEN_PEAK_OPACITY *
    Math.sin((Math.PI * (index + 0.5)) / SHEEN_STRIPES) ** 2,
}));

/**
 * Right to left, as the task asks, in a left-to-right layout; mirrored in a
 * right-to-left one, where the sheen then runs towards the start of the line
 * the same way. Read once at module scope, which is all `I18nManager.isRTL`
 * allows (see `MediaProcessingSweep`).
 */
const SWEEPS_FROM_RIGHT = !I18nManager.isRTL;

/** Side of the box the format's icon sits in. */
const ICON_BOX_SIZE = 36;

interface ArtifactGeneratingRowProps {
  type: ArtifactType;
  testID?: string;
}

export function ArtifactGeneratingRow({
  type,
  testID,
}: ArtifactGeneratingRowProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const still = useReduceMotion();
  const format = artifactFormatOf(type);
  const label = format ? t(format.labelKey) : type;
  const generating = t("artifacts.status.generating");

  // The band is as wide as the row, so the row has to be measured first.
  const [width, setWidth] = useState(0);
  // Not refs: an Animated.Value is created once and read during render, which
  // is exactly `useMemo` and not `useRef().current`.
  const sweep = useMemo(() => new Animated.Value(0), []);
  const twinkle = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (still) return;

    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: TWINKLE_HALF_PERIOD_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: TWINKLE_HALF_PERIOD_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    sweepLoop.start();
    twinkleLoop.start();

    // Stopped rather than left running: the row leaves the list as soon as the
    // entry is ready, and an animation nobody draws still burns frames.
    return () => {
      sweepLoop.stop();
      twinkleLoop.stop();
    };
  }, [still, sweep, twinkle]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  // Kept across renders — the list re-renders on every poll — so the native
  // driver keeps the node it is already animating.
  const sheenTranslateX = useMemo(
    () =>
      // Each pass starts and ends entirely off the row, so the loop restarting
      // at 0 is never visible as a jump back.
      sweep.interpolate({
        inputRange: [0, 1],
        outputRange: SWEEPS_FROM_RIGHT ? [width, -width] : [-width, width],
      }),
    [sweep, width],
  );

  // The mockup's twinkle: from dim, small and upright to bright, larger and
  // turned by 20°. The second sparkle runs the same curve backwards, which puts
  // it half a period behind the first: one brightens while the other dims.
  const twinkleStyles = useMemo(
    () =>
      [false, true].map((reversed) => {
        const between = (from: number, to: number) =>
          twinkle.interpolate({
            inputRange: [0, 1],
            outputRange: reversed ? [to, from] : [from, to],
          });
        return {
          opacity: between(0.25, 1),
          transform: [
            { scale: between(0.7, 1.1) },
            {
              rotate: twinkle.interpolate({
                inputRange: [0, 1],
                outputRange: reversed ? ["20deg", "0deg"] : ["0deg", "20deg"],
              }),
            },
          ],
        };
      }),
    [twinkle],
  );
  const sparkleStyles = still
    ? [styles.sparkleStill, styles.sparkleStill]
    : twinkleStyles;

  return (
    <View
      style={styles.row}
      onLayout={handleLayout}
      testID={testID}
      accessible
      accessibilityLabel={t("artifacts.history.a11yRow", {
        type: label,
        title: generating,
      })}
      accessibilityState={{ busy: true }}
    >
      {!still && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sheen,
            { width, transform: [{ translateX: sheenTranslateX }] },
          ]}
        >
          <View style={styles.sheenBand}>
            {SHEEN_STRIPE_STYLES.map((stripeStyle, index) => (
              <View key={index} style={[styles.sheenStripe, stripeStyle]} />
            ))}
          </View>
        </Animated.View>
      ) : null}

      <View
        style={[
          styles.iconBox,
          format ? { backgroundColor: Colors[format.tint] } : null,
        ]}
      >
        <Ionicons
          name={format?.icon ?? "sparkles-outline"}
          size={20}
          color={format ? Colors[format.ink] : Colors.textSubtle}
        />
        <Animated.View style={[styles.sparkleTop, sparkleStyles[0]]}>
          <Ionicons name="sparkles" size={14} color={Colors.primaryInk} />
        </Animated.View>
        <Animated.View style={[styles.sparkleBottom, sparkleStyles[1]]}>
          <Ionicons name="sparkles" size={11} color={Colors.primaryInk} />
        </Animated.View>
      </View>

      <View style={styles.textColumn}>
        <Text style={styles.title} numberOfLines={1}>
          {generating}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {t("artifacts.row.generatingMeta", { type: label })}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    // A card on `surface` over the page, which sets it apart from the flat
    // rows of finished entries under it — a tonal step, no rule.
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      padding: Spacing.md,
      minHeight: TouchTarget.comfortable,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      // Clips the sheen to the card.
      overflow: "hidden",
    },
    sheen: {
      position: "absolute",
      top: 0,
      bottom: 0,
      // Physical, not `start`: the band is placed on the axis `translateX`
      // moves it along. See `SWEEPS_FROM_RIGHT`.
      left: 0,
    },
    // A slight slant, the mockup's 100° gradient: the glow reads as a
    // reflection passing over the card rather than as a column sliding by.
    sheenBand: {
      flex: 1,
      flexDirection: "row",
      transform: [{ skewX: "-10deg" }],
    },
    sheenStripe: {
      flex: 1,
      backgroundColor: Colors.primary,
    },
    iconBox: {
      width: ICON_BOX_SIZE,
      height: ICON_BOX_SIZE,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.surfaceContainerLow,
      alignItems: "center",
      justifyContent: "center",
    },
    // The mockup's two corners: the larger sparkle above the box's top end, the
    // smaller one under its bottom start.
    sparkleTop: {
      position: "absolute",
      top: -Spacing.xs,
      right: -Spacing.xs,
    },
    sparkleBottom: {
      position: "absolute",
      bottom: -Spacing.xs,
      left: -Spacing.xs,
    },
    sparkleStill: {
      opacity: 1,
    },
    textColumn: {
      flex: 1,
    },
    title: {
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    meta: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
  });
