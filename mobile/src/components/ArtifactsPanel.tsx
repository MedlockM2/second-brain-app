/**
 * The complete "AI" tab of a scope, on the model of NotebookLM's Studio
 * (task-534, mockup `mobile-design-mockups/ai_tab_notebooklm/`):
 *
 *     Generate
 *     [Summary]   [Learning notes]      ← four tinted tiles, always active
 *     [Flashcards] [Quiz]
 *     ┌ Generating…  (animated) ┐       ← generations in progress first
 *     Title · Type · date          >    ← then every entry, newest first
 *
 * Rendered by both `CompletedDetailView` (a single media item) and
 * `app/media/folders/[id].tsx` (a whole folder). The tab used to be declared
 * twice, and the two copies drifted until the same headings rendered as a large
 * dark title on one screen and a small muted uppercase caption on the other.
 * So this component owns *all* of the layout and every presentational state,
 * and there is deliberately **no prop per visual difference** — a knob would
 * just let the two callers drift again inside here. The data comes from
 * `useScopeArtifacts`, shared the same way; the screens only hold it, so its
 * poll keeps running while another tab is shown.
 *
 * The one scope-dependent piece of rendering follows from `scope`: a folder's
 * entries say how many sources they read, a media item's do not.
 *
 * There is a single list, with no heading: "Generate" names the grid, and the
 * entries under it need no second title. The tiles carry no state at all — a
 * generation in progress is a row of the list, so a format can be asked for
 * again whatever its last entry says. A tile does not generate by itself: it
 * opens the format's "Personnaliser" screen (task-535), whose Generate button
 * sends the request and closes onto the generating row.
 */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
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
import type {
  ArtifactScope,
  ArtifactSummary,
} from "@media-summarizer/core/types/artifacts";
import { ARTIFACT_FORMATS, type ArtifactFormat } from "../lib/artifactFormats";
import type { ScopeArtifacts } from "../hooks/useScopeArtifacts";
import { ArtifactGeneratingRow } from "./ArtifactGeneratingRow";
import { ArtifactRow } from "./ArtifactRow";
import { ResourceRefreshNotice } from "./ResourceRefreshNotice";
import { t } from "../i18n";

/** The grid, two tiles to a row. */
const FORMAT_ROWS: readonly (readonly ArtifactFormat[])[] = ARTIFACT_FORMATS.reduce<
  ArtifactFormat[][]
>((rows, format, index) => {
  if (index % 2 === 0) rows.push([format]);
  else rows[rows.length - 1].push(format);
  return rows;
}, []);

const isInFlight = (artifact: ArtifactSummary): boolean =>
  artifact.status === "queued" || artifact.status === "generating";

const newestFirst = (a: ArtifactSummary, b: ArtifactSummary): number =>
  b.created_at.localeCompare(a.created_at);

export interface ArtifactsPanelProps {
  scope: ArtifactScope;
  artifacts: ScopeArtifacts;
}

export function ArtifactsPanel({
  scope,
  artifacts,
}: ArtifactsPanelProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const {
    history,
    historyLoading,
    historyError,
    refreshHistory,
    pendingTypes,
    refusal,
    customize,
    retry,
    openArtifact,
  } = artifacts;

  // Sorted here rather than trusted: a generation folded in by the POST, or a
  // failed entry rerun under its own id, keeps the place it had in the list.
  const inFlight = history.filter(isInFlight).sort(newestFirst);
  const settled = history
    .filter((artifact) => !isInFlight(artifact))
    .sort(newestFirst);
  // A request whose entry is already in flight needs no row of its own: it
  // will answer that very entry (`collapsed`). This is also what keeps a row
  // from showing twice in the frame between the POST answering and the
  // request leaving `pendingTypes`.
  const pending = pendingTypes.filter(
    (type) => !inFlight.some((artifact) => artifact.artifact_type === type),
  );
  const hasGenerating = pending.length > 0 || inFlight.length > 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{t("artifacts.panel.generateHeading")}</Text>
      <View style={styles.grid}>
        {FORMAT_ROWS.map((row) => (
          <View key={row[0].type} style={styles.gridRow}>
            {row.map((format) => (
              <FormatTile
                key={format.type}
                format={format}
                onPress={() => customize(format.type)}
              />
            ))}
          </View>
        ))}
      </View>

      {refusal ? (
        <View style={styles.refusalBanner} testID={`${scope}-ai-refusal`}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={Colors.error}
          />
          <Text style={styles.refusalText}>{refusal}</Text>
        </View>
      ) : null}

      {history.length > 0 && historyError ? (
        <ResourceRefreshNotice message={historyError} onRetry={refreshHistory} />
      ) : null}

      {hasGenerating ? (
        <View style={styles.generatingList}>
          {pending.map((type) => (
            <ArtifactGeneratingRow
              key={`pending-${type}`}
              type={type}
              testID={`artifact-generating-${type}`}
            />
          ))}
          {inFlight.map((artifact) => (
            <ArtifactGeneratingRow
              key={artifact.artifact_id}
              type={artifact.artifact_type}
              testID={`artifact-history-row-${artifact.artifact_id}`}
            />
          ))}
        </View>
      ) : null}

      {historyLoading ? (
        <View style={styles.inlineState}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.inlineStateText}>{t("common.loading")}</Text>
        </View>
      ) : historyError && history.length === 0 ? (
        <View style={styles.inlineState}>
          <Text style={styles.inlineStateText}>{historyError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={refreshHistory}
            accessibilityLabel={t("artifacts.panel.retryA11y")}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : history.length === 0 && pending.length === 0 ? (
        <View style={styles.inlineState} testID={`${scope}-ai-history-empty`}>
          <Text style={styles.inlineStateText}>
            {t("artifacts.panel.empty")}
          </Text>
        </View>
      ) : (
        <View>
          {settled.map((artifact) => (
            <ArtifactRow
              key={artifact.artifact_id}
              artifact={artifact}
              showSourceCount={scope === "folder"}
              onOpen={openArtifact}
              onRetry={retry}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface FormatTileProps {
  format: ArtifactFormat;
  onPress: () => void;
}

/**
 * One format of the grid: its tint, its icon in its ink, its name. No state
 * and no disabled look — a tile is always an invitation to generate, through
 * the format's "Personnaliser" screen.
 */
function FormatTile({ format, onPress }: FormatTileProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const label = t(format.labelKey);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: Colors[format.tint] },
        pressed && styles.tilePressed,
      ]}
      onPress={onPress}
      testID={`artifact-tile-generate-${format.type}`}
      accessibilityLabel={t("artifacts.a11yGenerate", { label })}
      accessibilityRole="button"
    >
      <Ionicons name={format.icon} size={22} color={Colors[format.ink]} />
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    // The panel carries its own gutter — the same `Spacing.lg` the rest of both
    // screens sits on — so neither caller re-applies one and neither can shift it.
    panel: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl,
    },
    // The mockup's small section label over the grid, not a page title: the
    // tab bar right above already says where the user is.
    heading: {
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
      marginBottom: Spacing.md,
    },
    grid: {
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    gridRow: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    // Tinted fills side by side, told apart by colour and a gap — no outline.
    tile: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      minHeight: TouchTarget.comfortable,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.xl,
    },
    // The same press feedback every other button in the app gives.
    tilePressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.9,
    },
    tileLabel: {
      flexShrink: 1,
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    generatingList: {
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    inlineState: {
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.lg,
    },
    inlineStateText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
      textAlign: "center",
      lineHeight: Typography.body.lineHeight,
    },
    retryButton: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      minHeight: TouchTarget.minimum,
    },
    retryButtonText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.onPrimary,
    },
    refusalBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      backgroundColor: Colors.errorContainer,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    refusalText: {
      flex: 1,
      fontSize: Typography.small.fontSize,
      color: Colors.error,
      lineHeight: Typography.body.lineHeight,
    },
  });
