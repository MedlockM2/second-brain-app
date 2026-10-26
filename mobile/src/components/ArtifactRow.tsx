/**
 * One settled entry of the AI tab's list: a generated artifact, or a
 * generation that failed (task-534). An entry still in flight is drawn by
 * `ArtifactGeneratingRow` instead.
 *
 * A **ready** entry reads as the mockup's row: the format's icon in its ink,
 * the title the model wrote, then "Type · N sources · date". The source count
 * is the entry's own snapshot, never a count of the folder as it stands now,
 * and only a folder says it — a media item is a single source. A tap opens it.
 *
 * A **failed** entry stays in the list, says so in the error colour, and a tap
 * asks for the same generation again: the backend reruns a failed entry over
 * the same sources under the same id (`generation_outcome: "retried"`).
 *
 * The rows are flat, on the page itself: the gap between them and the tonal
 * step to the card of a generation in progress do the sectioning, with no rule
 * between entries ("No-Line rule").
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { artifactFormatOf } from "../lib/artifactFormats";
import { getRelativeTime } from "../lib/relativeTime";
import { t, tCount } from "../i18n";
import type { ArtifactSummary } from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";

interface ArtifactRowProps {
  artifact: ArtifactSummary;
  /** Whether the meta line names the number of sources: a folder's entries do. */
  showSourceCount: boolean;
  onOpen: (artifact: ArtifactSummary) => void;
  onRetry: (artifactType: ArtifactType) => void;
}

export function ArtifactRow({
  artifact,
  showSourceCount,
  onOpen,
  onRetry,
}: ArtifactRowProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const format = artifactFormatOf(artifact.artifact_type);
  const typeLabel = format ? t(format.labelKey) : artifact.artifact_type;
  const failed = artifact.status === "failed";

  if (failed) {
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onRetry(artifact.artifact_type)}
        testID={`artifact-history-row-${artifact.artifact_id}`}
        accessibilityLabel={t("artifacts.row.a11yRetry", { type: typeLabel })}
        accessibilityRole="button"
      >
        <Ionicons name="alert-circle-outline" size={24} color={Colors.error} />
        <View style={styles.textColumn}>
          {/* A failed entry has no title of its own: the model never wrote one. */}
          <Text style={styles.title} numberOfLines={2}>
            {typeLabel}
          </Text>
          <Text style={[styles.meta, styles.metaFailed]} numberOfLines={2}>
            {t("artifacts.row.failed")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </Pressable>
    );
  }

  const title = artifact.title?.trim() || typeLabel;
  const meta = [
    typeLabel,
    showSourceCount
      ? tCount("artifacts.sourceCount", artifact.source_count)
      : null,
    getRelativeTime(artifact.created_at),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onOpen(artifact)}
      testID={`artifact-history-row-${artifact.artifact_id}`}
      accessibilityLabel={t("artifacts.history.a11yRow", {
        type: typeLabel,
        title,
      })}
      accessibilityRole="button"
    >
      <Ionicons
        name={format?.icon ?? "sparkles-outline"}
        size={24}
        color={format ? Colors[format.ink] : Colors.textSubtle}
      />
      <View style={styles.textColumn}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xs,
      minHeight: TouchTarget.comfortable,
      borderRadius: BorderRadius.lg,
    },
    // The press feedback every other row of the app gives (inbox digest card,
    // the folder and media lists).
    rowPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.9,
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
    metaFailed: {
      color: Colors.error,
    },
  });
