import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Typography,
  Spacing,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { HOME_BLOCK_GAP } from "../constants/homeRhythm";
import { usePurchases } from "../contexts/PurchasesContext";
import { formatResetDate, getUsageRatio } from "../lib/subscriptionDisplay";
import { UsageWarningDismissal } from "../lib/usageWarningDismissal";
import { t } from "../i18n";

/** Inline warning on settled usage; reservations are not consumption. */
export function MinutesWarningBanner(): React.JSX.Element | null {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { entitlementStatus, isBetaAccess } = usePurchases();
  const resetsAt = entitlementStatus?.budget.resets_at ?? null;
  const capacity = entitlementStatus?.budget;
  const shouldWarn = capacity?.consumed_percent != null
    && capacity.warning_threshold_percent != null
    && capacity.consumed_percent >= capacity.warning_threshold_percent;

  // Starts hidden: the dismissal is on disk, and flashing the banner for one
  // frame before reading it would defeat "not repeated".
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    if (!shouldWarn) return;
    let isCurrent = true;
    void UsageWarningDismissal.isDismissed(resetsAt).then((dismissed) => {
      if (isCurrent) setIsDismissed(dismissed);
    });
    return () => {
      isCurrent = false;
    };
  }, [shouldWarn, resetsAt]);

  if (!entitlementStatus || !shouldWarn || isDismissed) {
    return null;
  }

  const usedPercent = Math.round(getUsageRatio(entitlementStatus) * 100);
  const resetDate = formatResetDate(resetsAt);
  const message = `${t("budget.consumed")}: ${usedPercent}%. ${resetDate ? `${t("subscription.resetLabel.resets")}: ${resetDate}` : ""}`;

  const handleDismiss = (): void => {
    setIsDismissed(true);
    void UsageWarningDismissal.dismiss(resetsAt);
  };

  return (
    <View testID="minutes-warning-banner" style={styles.banner}>
      <Ionicons name="timer-outline" size={20} color={Colors.textMain} />

      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {!isBetaAccess && (
          <Pressable
            testID="minutes-warning-see-plans"
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
            onPress={() => router.push("/paywall?reason=running_low")}
            accessibilityLabel={t("quota.seePlans")}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{t("quota.seePlans")}</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        testID="minutes-warning-dismiss"
        style={({ pressed }) => [styles.dismiss, pressed && styles.linkPressed]}
        onPress={handleDismiss}
        accessibilityLabel={t("quota.dismissWarning")}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      marginHorizontal: Spacing.md,
      // The Home column's one inter-block gap, above only (`HOME_BLOCK_GAP`), so
      // the banner reads the same distance from the trial pill above it as from the
      // card below it, and costs the column nothing when dismissed.
      marginTop: HOME_BLOCK_GAP,
      paddingVertical: Spacing.sm,
      paddingStart: Spacing.md,
      paddingEnd: Spacing.xs,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    content: {
      flex: 1,
      // Balances the icon's optical centre against the first line of text without
      // pushing the whole row down.
      paddingTop: Spacing.xs / 2,
    },
    message: {
      ...Typography.small,
      color: Colors.textMain,
    },
    link: {
      alignSelf: "flex-start",
      justifyContent: "center",
      minHeight: TouchTarget.minimum,
      paddingEnd: Spacing.md,
    },
    linkText: {
      ...Typography.label,
      fontWeight: "600",
      color: Colors.textMain,
      textDecorationLine: "underline",
    },
    linkPressed: {
      opacity: 0.6,
    },
    dismiss: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: TouchTarget.minimum,
      minWidth: TouchTarget.minimum,
      borderRadius: BorderRadius.full,
    },
  });
