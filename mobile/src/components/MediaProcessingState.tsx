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
 * - `processing`: the breathing dot of the chat (`BreathingDot`) and the line
 *   `mediaProcessingLabelKey` words after the media's type. No action: the host
 *   reads the item every three seconds, so a refresh would add nothing.
 * - `timeout`: the host's poll has given up, so the dot goes — nothing is moving
 *   any more — for a still clock, and the one action that starts it again.
 * - `failed`: why, in the reader's words. The host adds the request for source
 *   support under it on the page; a refresh would read the same failure again.
 *
 * Rendering only. The host's poll (`useMediaDetailPolling`) builds the notice,
 * and the same notice is drawn on the page and as the chat's view of its source.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BreathingDot } from "./BreathingDot";
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

/** The size of the still glyphs: the box the breathing dot is drawn in. */
const GLYPH_SIZE = Spacing.lg;

export function MediaProcessingState({
  notice,
}: {
  notice: MediaProcessingNotice;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const message =
    notice.status === "timeout" ? t("media.timeoutTitle") : notice.message;

  return (
    <View style={styles.container}>
      <View
        style={styles.status}
        accessible
        accessibilityRole={
          notice.status === "processing"
            ? "progressbar"
            : notice.status === "failed"
              ? "alert"
              : "text"
        }
        accessibilityLabel={message}
        accessibilityState={
          notice.status === "processing" ? { busy: true } : undefined
        }
        accessibilityLiveRegion="polite"
      >
        {notice.status === "processing" ? (
          <BreathingDot />
        ) : notice.status === "timeout" ? (
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

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
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
