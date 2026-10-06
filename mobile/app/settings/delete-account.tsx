import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePurchases } from "../../src/contexts/PurchasesContext";
import { AccountService } from "../../src/services/accountService";
import { hasActiveEntitlement } from "../../src/services/purchaseService";
import { getFriendlyErrorMessage } from "../../src/lib/getFriendlyErrorMessage";
import { t, type TranslationKey } from "../../src/i18n";
import {
  PRIVACY_CONTACT_EMAIL,
  STORE_SUBSCRIPTIONS_URL,
} from "../../src/constants/legal";
import {
  Typography,
  Spacing,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../src/contexts/ThemeContext";
import { ScreenHeader, HeaderIconButton } from "../../src/components/ScreenHeader";

/**
 * Account deletion, required in-app by App Store guideline 5.1.1(v) and by the
 * GDPR right to erasure.
 *
 * A dedicated screen rather than a menu row plus an alert: the consequences that
 * have to be read before confirming do not fit in an alert body — what is erased,
 * that a store subscription keeps billing regardless, and how to get a copy of
 * the data first. The destructive button stays disabled until the irreversibility
 * is explicitly acknowledged, and the native alert is the second and final gate.
 */

/**
 * What deletion erases, as catalogue keys rather than sentences: the list is a
 * module constant built once at import, so resolved strings would freeze the
 * language the app started in.
 */
const ERASED_ITEM_KEYS: readonly TranslationKey[] = [
  "deleteAccount.erased.library",
  "deleteAccount.erased.artifacts",
  "deleteAccount.erased.digests",
  "deleteAccount.erased.search",
  "deleteAccount.erased.identity",
];

export default function DeleteAccountScreen() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const { entitlementStatus, customerInfo } = usePurchases();
  // Not the context's `isSubscribed`: the backend free trial is entitled too, but
  // no store bills it, so telling a trial account that Apple or Google keeps
  // charging it would be false. A store subscription is a tier on the backend
  // row, or a tier entitlement RevenueCat reports before the webhook lands.
  //
  // This also covers the beta regime without naming it. task-429 entitles every
  // account, so `isSubscribed` is true for all of them and an `!isBetaAccess`
  // guard was what kept the warning off a tester. It is not needed here: the beta
  // widens `tier`, never `subscription_tier`, which keeps naming what the account
  // actually bought (`quota_enforcer.py`). Testing the purchase rather than the
  // entitlement is the narrower condition of the two, and the one that still holds
  // the day the regime closes on accounts whose trial is running.
  const hasStoreSubscription =
    entitlementStatus?.subscription_tier != null ||
    (customerInfo !== null && hasActiveEntitlement(customerInfo));
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDeletion = async (): Promise<void> => {
    if (!isAuthenticated) {
      setError(t("error.sessionExpired"));
      return;
    }
    setError(null);
    setIsDeleting(true);
    try {
      await AccountService.deleteAccount();
      // The backend has already revoked every session; this clears the local
      // copy and the RevenueCat login, and the replace leaves no screen behind
      // that would try to read a deleted account.
      await logout();
      router.replace("/(auth)/login");
    } catch (err) {
      setError(
        getFriendlyErrorMessage(err, { fallback: t("deleteAccount.failed") }),
      );
      setIsDeleting(false);
    }
  };

  const handleDeletePress = (): void => {
    Alert.alert(
      t("deleteAccount.confirmTitle"),
      t("deleteAccount.confirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("deleteAccount.confirmAction"),
          style: "destructive",
          onPress: () => {
            void runDeletion();
          },
        },
      ],
    );
  };

  const openStoreSubscriptions = (): void => {
    void Linking.openURL(STORE_SUBSCRIPTIONS_URL);
  };

  const openPrivacyContact = (): void => {
    void Linking.openURL(
      `mailto:${PRIVACY_CONTACT_EMAIL}?subject=Data%20request`,
    );
  };

  return (
    <SafeAreaView
      testID="delete-account-screen"
      style={styles.container}
      edges={["top"]}
    >
      <ScreenHeader
        title={t("deleteAccount.title")}
        leading={
          <HeaderIconButton
            icon="chevron-back"
            variant="plain"
            onPress={() => router.back()}
            disabled={isDeleting}
            accessibilityLabel={t("common.goBack")}
          />
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningCard}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>
              {t("deleteAccount.warningTitle")}
            </Text>
            <Text style={styles.warningText}>
              {t("deleteAccount.warningBody")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {t("deleteAccount.erasedHeading")}
        </Text>
        <View style={styles.card}>
          {ERASED_ITEM_KEYS.map((key) => (
            <View key={key} style={styles.bulletRow}>
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={Colors.textMuted}
              />
              <Text style={styles.bulletText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        {hasStoreSubscription && (
          <>
            <Text style={styles.sectionTitle}>
              {t("deleteAccount.subscriptionHeading")}
            </Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {Platform.OS === "ios"
                  ? t("deleteAccount.subscriptionBodyApple")
                  : t("deleteAccount.subscriptionBodyGoogle")}
              </Text>
              <Pressable
                style={styles.linkRow}
                onPress={openStoreSubscriptions}
                accessibilityLabel={
                  Platform.OS === "ios"
                    ? t("deleteAccount.manageApple")
                    : t("deleteAccount.manageGoogle")
                }
                accessibilityRole="button"
              >
                <Ionicons name="open-outline" size={16} color={Colors.textMain} />
                <Text style={styles.linkText}>
                  {Platform.OS === "ios"
                    ? t("deleteAccount.manageApple")
                    : t("deleteAccount.manageGoogle")}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>{t("deleteAccount.copyHeading")}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{t("deleteAccount.copyBody")}</Text>
          <Pressable
            style={styles.linkRow}
            onPress={openPrivacyContact}
            accessibilityLabel={t("deleteAccount.emailA11y", {
              address: PRIVACY_CONTACT_EMAIL,
            })}
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={16} color={Colors.textMain} />
            <Text style={styles.linkText}>{PRIVACY_CONTACT_EMAIL}</Text>
          </Pressable>
        </View>

        <Pressable
          testID="delete-account-acknowledge"
          style={styles.acknowledgeRow}
          onPress={() => setHasAcknowledged((previous) => !previous)}
          disabled={isDeleting}
          accessibilityLabel={t("deleteAccount.acknowledgeA11y")}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasAcknowledged }}
        >
          <Ionicons
            name={hasAcknowledged ? "checkbox" : "square-outline"}
            size={24}
            color={hasAcknowledged ? Colors.error : Colors.textMuted}
          />
          <Text style={styles.acknowledgeText}>
            {t("deleteAccount.acknowledge")}
          </Text>
        </Pressable>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="delete-account-confirm-button"
          style={[
            styles.deleteButton,
            (!hasAcknowledged || isDeleting) && styles.buttonDisabled,
          ]}
          onPress={handleDeletePress}
          disabled={!hasAcknowledged || isDeleting}
          accessibilityLabel={t("deleteAccount.submitA11y")}
          accessibilityRole="button"
        >
          {isDeleting ? (
            <ActivityIndicator color={Colors.onError} />
          ) : (
            <Text style={styles.deleteButtonText}>{t("deleteAccount.submit")}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    warningCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: Colors.errorContainer,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    warningTextContainer: {
      flex: 1,
    },
    warningTitle: {
      ...Typography.label,
      fontWeight: "700",
      color: Colors.error,
      marginBottom: Spacing.xs,
    },
    warningText: {
      ...Typography.small,
      color: Colors.textMain,
      lineHeight: 18,
    },
    sectionTitle: {
      ...Typography.label,
      fontWeight: "600",
      color: Colors.textMuted,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: Colors.surfaceContainerLow,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      gap: Spacing.sm,
    },
    cardText: {
      ...Typography.small,
      color: Colors.textMain,
      lineHeight: 18,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    bulletText: {
      flex: 1,
      ...Typography.small,
      color: Colors.textMain,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      minHeight: TouchTarget.minimum,
    },
    linkText: {
      flex: 1,
      ...Typography.small,
      fontWeight: "600",
      color: Colors.textMain,
    },
    acknowledgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginTop: Spacing.lg,
      paddingVertical: Spacing.sm,
      minHeight: TouchTarget.minimum,
    },
    acknowledgeText: {
      flex: 1,
      ...Typography.small,
      color: Colors.textMain,
      lineHeight: 18,
    },
    errorContainer: {
      backgroundColor: Colors.errorContainer,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.md,
    },
    errorText: {
      ...Typography.small,
      color: Colors.error,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingBottom: Platform.OS === "ios" ? Spacing.md : Spacing.lg,
    },
    deleteButton: {
      backgroundColor: Colors.error,
      borderRadius: BorderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: TouchTarget.comfortable,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    deleteButtonText: {
      ...Typography.body,
      fontWeight: "600",
      color: Colors.onError,
    },
  });
