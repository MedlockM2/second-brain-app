import React, { useRef, useState } from "react";
import { artifactFailureMessage } from "@media-summarizer/core/artifacts/failure";
import { describeArtifactRefusal } from "../lib/artifactRefusal";
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

interface ArtifactRowProps {
  artifact: ArtifactSummary;
  /** Whether the meta line names the number of sources: a folder's entries do. */
  showSourceCount: boolean;
  onOpen: (artifact: ArtifactSummary) => void;
  onRetry: (artifact: ArtifactSummary) => Promise<void>;
  onDelete: (artifact: ArtifactSummary) => Promise<void>;
}

export function ArtifactRow({
  artifact,
  showSourceCount,
  onOpen,
  onRetry,
  onDelete,
}: ArtifactRowProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const act = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    try { await action(); }
    catch (error) { setActionError(describeArtifactRefusal(error)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const format = artifactFormatOf(artifact.artifact_type);
  const typeLabel = format ? t(format.labelKey) : artifact.artifact_type;
  const failed = artifact.status === "failed";

  if (failed) {
    return (
      <View style={styles.row} testID={`artifact-history-row-${artifact.artifact_id}`}>
        <Ionicons name="alert-circle-outline" size={24} color={Colors.error} />
        <View style={styles.textColumn}>
          <Text style={styles.title}>{artifact.title?.trim() || typeLabel}</Text>
          <Text style={[styles.meta, styles.metaFailed]}>{t("artifacts.row.failed")}</Text>
          {artifactFailureMessage(artifact) !== t("artifacts.row.failed") && (
            <Text style={styles.meta}>{artifactFailureMessage(artifact)}</Text>
          )}
          <View style={styles.actions}>
            {artifact.retryable && (
              <Pressable style={styles.action} disabled={busy} accessibilityRole="button"
                accessibilityState={{ disabled: busy }} onPress={() => void act(() => onRetry(artifact))}>
                <Text style={styles.actionText}>{t("artifacts.row.retry")}</Text>
              </Pressable>
            )}
            <Pressable style={styles.action} disabled={busy} accessibilityRole="button"
              accessibilityState={{ disabled: busy }} onPress={() => void act(() => onDelete(artifact))}>
              <Text style={styles.actionText}>{t("common.delete")}</Text>
            </Pressable>
          </View>
          {actionError && <Text style={styles.metaFailed} accessibilityRole="alert">{actionError}</Text>}
        </View>
      </View>
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
    actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
    action: { minHeight: TouchTarget.comfortable, justifyContent: "center", paddingHorizontal: Spacing.sm },
    actionText: { color: Colors.primary, fontSize: Typography.body.fontSize, fontWeight: "600" },
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
