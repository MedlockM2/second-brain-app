import { useState } from "react";
import type { SocialProvider } from "@media-summarizer/core/auth/cognito";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { t } from "../i18n";
import { POST_AUTH_ENTRY_POINT } from "../constants/routes";
import {
  Typography,
  Spacing,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";

interface SocialAuthButtonsProps {
  onError: (message: string) => void;
  disabled?: boolean;
}

/** Google and Apple authenticate through Cognito's authorization code flow with PKCE. */
export function SocialAuthButtons({ onError, disabled }: SocialAuthButtonsProps) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { loginWithSocial } = useAuth();
  const [provider, setProvider] = useState<SocialProvider | null>(null);
  const isLoading = provider !== null;
  const isGoogleLoading = provider === "Google";
  const isAppleLoading = provider === "SignInWithApple";
  const signIn = async (selected: SocialProvider) => {
    if (disabled || isLoading) return;
    setProvider(selected);
    try {
      if (await loginWithSocial(selected)) router.replace(POST_AUTH_ENTRY_POINT);
    } catch (error) {
      onError(t(authErrorKey(error)));
    } finally {
      setProvider(null);
    }
  };
  const handleGoogleSignIn = () => void signIn("Google");
  const handleAppleSignIn = () => void signIn("SignInWithApple");

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("auth.or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google button - visible on all platforms */}
      <TouchableOpacity
        style={[styles.socialButton, styles.googleButton, (disabled || isLoading) && styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={disabled || isLoading}
        activeOpacity={0.8}
        accessibilityLabel={t("auth.continueWithGoogle")}
        accessibilityRole="button"
      >
        {isGoogleLoading ? (
          <ActivityIndicator color={Colors.textMain} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={Colors.textMain} />
            <Text style={styles.googleButtonText}>
              {t("auth.continueWithGoogle")}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Apple federation is available on both platforms. */}
      <TouchableOpacity
          style={[styles.socialButton, styles.appleButton, (disabled || isLoading) && styles.appleButtonDisabled]}
          onPress={handleAppleSignIn}
          disabled={disabled || isLoading}
          activeOpacity={0.8}
          accessibilityLabel={t("auth.signInWithApple")}
          accessibilityRole="button"
        >
          {isAppleLoading ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color={Colors.surface} />
              <Text style={styles.appleButtonText}>
                {t("auth.signInWithApple")}
              </Text>
            </>
          )}
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    dividerText: {
      color: Colors.textMuted,
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.small.fontWeight,
    },
    socialButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      borderRadius: BorderRadius.md,
      minHeight: TouchTarget.minimum,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    googleButton: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.outlineVariant,
    },
    googleButtonText: {
      color: Colors.textMain,
      fontSize: Typography.body.fontSize,
      fontWeight: "500",
    },
    appleButton: {
      backgroundColor: Colors.textMain,
    },
    appleButtonText: {
      color: Colors.surface,
      fontSize: Typography.body.fontSize,
      fontWeight: "500",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    appleButtonDisabled: {
      opacity: 0.6,
    },
  });
