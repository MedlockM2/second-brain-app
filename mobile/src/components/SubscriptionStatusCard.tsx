import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Typography,
  Spacing,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import type { EntitlementStatus } from "../contexts/PurchasesContext";
import {
  formatResetDate,
  getResetDateLabel,
  getStatusNote,
  getTierLabel,
  getUsageRatio,
} from "../lib/subscriptionDisplay";
import { t, formatNumber } from "../i18n";

/** Read-only settled beta capacity, independent of reservations in flight. */
interface SubscriptionStatusCardProps {
  /** Backend entitlement payload, `null` while unknown or after a failure. */
  entitlement: EntitlementStatus | null;
  /** True while an entitlements request is in flight. */
  isLoading: boolean;
  /** Re-runs the entitlements request (used by the unavailable state). */
  onRetry: () => void;
  /**
   * Display name of the tier the free trial grants, from `GET /api/pricing`.
   * `null` when it is not a trial or the pricing has not loaded — the trial is
   * named either way, only the tier chip depends on it.
   */
  trialTierName?: string | null;
}

export function SubscriptionStatusCard({
  entitlement,
  isLoading,
  onRetry,
  trialTierName = null,
}: SubscriptionStatusCardProps): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <View testID="account-plan-card" style={styles.card}>
      <Text style={styles.sectionLabel}>{t("account.plan.heading")}</Text>
      <CardBody
        entitlement={entitlement}
        isLoading={isLoading}
        onRetry={onRetry}
        trialTierName={trialTierName}
      />
    </View>
  );
}

function CardBody({
  entitlement,
  isLoading,
  onRetry,
  trialTierName = null,
}: SubscriptionStatusCardProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // Only the very first load shows a spinner. Once a payload is on screen, a
  // background refresh (tab focus, post-purchase) keeps showing the figures
  // instead of flickering back to a placeholder.
  if (entitlement === null && isLoading) {
    return (
      <View style={styles.inlineRow}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.bodyText}>{t("account.plan.checking")}</Text>
      </View>
    );
  }

  if (entitlement === null) {
    return (
      <View testID="account-plan-unavailable">
        <View style={styles.inlineRow}>
          <Ionicons
            name="cloud-offline-outline"
            size={20}
            color={Colors.textMuted}
          />
          <Text style={styles.planName}>
            {t("account.plan.unavailable")}
          </Text>
        </View>
        <Text style={styles.bodyText}>{t("account.plan.unavailableHint")}</Text>
        <Pressable
          testID="account-plan-retry-button"
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={onRetry}
          disabled={isLoading}
          accessibilityLabel={t("account.plan.retryA11y")}
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.textMain} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={Colors.textMain} />
              <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  if (!entitlement.is_active) {
    return (
      <View testID="account-plan-inactive">
        <Text style={styles.planName}>{t("account.plan.none")}</Text>
        <Text style={styles.bodyText}>{t("account.plan.noneHint")}</Text>
      </View>
    );
  }

  const isBeta = entitlement.is_beta_access;
  const isTrial = entitlement.is_free_trial;
  const tierLabel = getTierLabel(entitlement.subscription_tier);
  const statusNote = getStatusNote(entitlement.subscription_status);
  const resetDate = formatResetDate(entitlement.budget.resets_at);
  const resetDateLabel = getResetDateLabel(entitlement);
  const consumed = entitlement.budget.consumed_percent;
  const usage = consumed === null ? t("account.plan.unavailable") : `${formatNumber(consumed)}%`;
  // The trial's own tier is the one the gauge below is measuring, and it is
  // worth naming — but it never becomes the heading, which would read as a plan
  // the user bought. Under the beta there is no chip at all: a plan's status note
  // next to a "Beta access" heading would describe something the figures below
  // no longer come from.
  const chipText = isBeta ? null : isTrial ? trialTierName : statusNote;

  return (
    <View>
      <View style={styles.titleRow}>
        {/* The beta names itself, and so does a trial; an active subscription on
            a tier this build does not know still says something true rather than
            nothing. */}
        <Text testID="account-plan-tier" style={styles.planName}>
          {isBeta
            ? t("account.plan.betaAccess")
            : isTrial
              ? t("account.plan.freeTrial")
              : (tierLabel ?? t("account.plan.active"))}
        </Text>
        {chipText !== null && (
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{chipText}</Text>
          </View>
        )}
      </View>

      <View style={styles.metricRow}>
        <Metric
          testID="account-plan-minutes"
          value={usage}
          label={t("budget.consumed")}
          accessibilityLabel={`${t("budget.consumed")}: ${usage}`}
        />
        <Metric
          testID="account-plan-reset-date"
          value={resetDate ?? t("account.plan.unknownDate")}
          label={resetDateLabel}
          accessibilityLabel={
            resetDate
              ? t("account.plan.resetDateA11y", {
                  label: resetDateLabel.toLowerCase(),
                  date: resetDate,
                })
              : t("account.plan.resetDateUnknownA11y")
          }
        />
      </View>

      <UsageBar entitlement={entitlement} />

      <Text style={styles.hintText}>
        {t("budget.rule")}
      </Text>
    </View>
  );
}

/**
 * Thin bar showing how much of the period's allowance is spent. Deliberately
 * decoration around the figures above rather than the figures themselves: it is
 * the glanceable part, so it carries no text of its own and is hidden from the
 * screen reader, which already reads "N of M minutes left this period".
 */
function UsageBar({
  entitlement,
}: {
  entitlement: EntitlementStatus;
}): React.JSX.Element | null {
  const styles = useThemedStyles(makeStyles);
  if (entitlement.budget.consumed_percent === null) {
    return null;
  }
  const usedFraction = getUsageRatio(entitlement);

  return (
    <View
      testID="account-plan-usage-bar"
      style={styles.usageTrack}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.usageFill,
          // Percent width so the fill follows the track without measuring it.
          { width: `${usedFraction * 100}%` },
        ]}
      />
    </View>
  );
}

function Metric({
  testID,
  value,
  label,
  accessibilityLabel,
}: {
  testID: string;
  value: string;
  label: string;
  accessibilityLabel: string;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);

  return (
    <View
      testID={testID}
      style={styles.metricTile}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      padding: Spacing.md,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      ...Shadows.soft,
    },
    sectionLabel: {
      ...Typography.small,
      fontWeight: "600",
      color: Colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: Spacing.xs,
    },
    inlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    planName: {
      ...Typography.headline,
      color: Colors.textMain,
      flexShrink: 1,
    },
    bodyText: {
      ...Typography.small,
      color: Colors.textMuted,
      marginTop: Spacing.xs,
    },
    hintText: {
      ...Typography.small,
      color: Colors.textMuted,
      marginTop: Spacing.sm,
    },
    statusChip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    statusChipText: {
      ...Typography.small,
      fontWeight: "600",
      color: Colors.textMain,
    },
    metricRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    metricTile: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerLow,
    },
    metricValue: {
      ...Typography.headline,
      color: Colors.textMain,
    },
    metricLabel: {
      ...Typography.small,
      color: Colors.textMuted,
      letterSpacing: 0.5,
      marginTop: Spacing.xs,
    },
    usageTrack: {
      height: Spacing.xs,
      marginTop: Spacing.md,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainerHigh,
      overflow: "hidden",
    },
    usageFill: {
      height: "100%",
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      alignSelf: "flex-start",
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.md,
      minHeight: TouchTarget.minimum,
      minWidth: TouchTarget.minimum + Spacing.xl,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainer,
    },
    retryButtonPressed: {
      backgroundColor: Colors.surfaceContainerHigh,
    },
    retryButtonText: {
      ...Typography.label,
      fontWeight: "600",
      color: Colors.textMain,
    },
  });
