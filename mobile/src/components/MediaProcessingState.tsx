/**
 * The Reader tab of a media whose text is not readable yet: one glyph, one
 * line, and an action only where one helps.
 *
 * It stands in for the whole tab until the text is there — no "L'essentiel"
 * block and no "Full text" section, since neither has anything to show yet. The
 * page used to stack a spinner and a line of its own, a "Refresh" link, the
 * preview's spinner and the transcript's spinner, the last one announcing audio
 * extraction on a web article (TestFlight feedback AM6k6fv3QCFz8rAOZnqS9KM).
 *
 * - `processing`: the line `mediaProcessingLabelKey` words after the media's
 *   type, behind a pulsing amber dot, over the shape of the text to come
 *   (`TextSkeleton`) — variant C of `mobile-design-mockups/chargement_import_media/`,
 *   retained by the owner on 2026-11-13. No action: the host reads the item
 *   every three seconds, so a refresh would add nothing.
 * - `timeout`: the host's poll has given up, so the skeleton goes — nothing is
 *   moving any more — for a still clock, and the one action that starts it again.
 * - `failed`: why, in the reader's words. The host adds the request for source
 *   support under it on the page; a refresh would read the same failure again.
 *
 * Rendering only. The host's poll (`useMediaDetailPolling`) builds the notice,
 * and the same notice is drawn on the page and as the chat's view of its source.
 */

import React, { useEffect, useMemo } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextSkeleton } from "./TextSkeleton";
import { useReduceMotion } from "../hooks/useReduceMotion";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";

/** Where a media on its way stands, while its text is not readable yet. */
export type MediaProcessingNotice =
  | { status: "processing"; message: string }
  | { status: "timeout"; retry: () => void }
  | { status: "failed"; message: string };

/** The size of the still glyphs of a timeout and of a failure. */
const GLYPH_SIZE = Spacing.lg;

export function MediaProcessingState({
  notice,
}: {
  notice: MediaProcessingNotice;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (notice.status === "processing") {
    return (
      <View style={styles.processing}>
        <View
          style={styles.processingLabel}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={notice.message}
          accessibilityState={{ busy: true }}
          accessibilityLiveRegion="polite"
        >
          <PulsingDot />
          <Text style={styles.processingText}>{notice.message}</Text>
        </View>
        <TextSkeleton />
      </View>
    );
  }

  const message =
    notice.status === "timeout" ? t("media.timeoutTitle") : notice.message;

  return (
    <View style={styles.container}>
      <View
        style={styles.status}
        accessible
        accessibilityRole={notice.status === "failed" ? "alert" : "text"}
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
      >
        {notice.status === "timeout" ? (
          <Ionicons name="time-outline" size={GLYPH_SIZE} color={Colors.textMuted} />
        ) : (
          <Ionicons name="alert-circle-outline" size={GLYPH_SIZE} color={Colors.error} />
        )}
        <Text
          style={[
            styles.message,
            notice.status === "failed" && styles.failedMessage,
          ]}
        >
          {message}
        </Text>
      </View>
      {notice.status === "timeout" ? (
        <Pressable
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          onPress={notice.retry}
          accessibilityRole="button"
          accessibilityLabel={t("media.refreshA11y")}
        >
          <Ionicons name="refresh" size={Typography.label.fontSize} color={Colors.textMain} />
          <Text style={styles.retryText}>{t("media.refresh")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const PULSE_HALF_MS = 600;

/** The amber dot before the line: fades in and out, still under reduced motion. */
function PulsingDot(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const reduceMotion = useReduceMotion();
  const opacity = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    opacity.setValue(1);
    if (reduceMotion) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: PULSE_HALF_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_HALF_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotion]);

  return <Animated.View style={[styles.pulsingDot, { opacity }]} />;
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    // Where the text will be: aligned on the Reader's text, not centred.
    processing: {
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    processingLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    pulsingDot: {
      width: 7,
      height: 7,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
    },
    processingText: {
      fontSize: Typography.label.fontSize,
      color: Colors.textSubtle,
    },
    // Centred in a band of air under the tabs: a state of the page, not one
    // more paragraph of it.
    container: {
      alignItems: "center",
      gap: Spacing.md,
      paddingVertical: Spacing.xxl,
    },
    status: {
      alignItems: "center",
      gap: Spacing.md,
    },
    // `textSubtle`: a line to read, but not the content the reader came for.
    message: {
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: Colors.textSubtle,
      textAlign: "center",
    },
    failedMessage: {
      color: Colors.textMain,
    },
    // The tonal pill of the Reader's secondary controls (the translation
    // switch, "Check again"): discreet, and still a full touch target.
    retry: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      minHeight: TouchTarget.minimum,
      paddingHorizontal: Spacing.md,
      backgroundColor: Colors.surfaceContainerHigh,
      borderRadius: BorderRadius.full,
    },
    retryPressed: {
      opacity: 0.7,
    },
    retryText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
  });
