import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import type { PendingLink, SocialProvider } from "@media-summarizer/core/auth/cognito";
import { authErrorKey, pendingLinkFrom } from "@media-summarizer/core/auth/cognito";
import {
  Platform,
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
import { useTheme, useThemedStyles } from "../contexts/ThemeContext";

interface SocialAuthButtonsProps {
  onError: (message: string) => void;
  /** The address already has an account: sign in to it, then link (task-529). */
  onAccountExists?: (link: PendingLink) => void;
  /** Replaces the default entry into the app, e.g. to finish a pending link first. */
  onSignedIn?: () => Promise<void>;
  disabled?: boolean;
}

/** Native Apple on iOS and Google on Android; browser authorization otherwise. */
export function SocialAuthButtons({ onError, onAccountExists, onSignedIn, disabled }: SocialAuthButtonsProps) {
  const { colors: Colors, mode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { loginWithSocial } = useAuth();
  const [provider, setProvider] = useState<SocialProvider | null>(null);
  const [nativeAppleAvailable, setNativeAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (active) setNativeAppleAvailable(available);
    }).catch(() => { /* An unavailable native provider is not offered. */ });
    return () => { active = false; };
  }, []);
  const isLoading = provider !== null;
  const isGoogleLoading = provider === "Google";
  const isAppleLoading = provider === "SignInWithApple";
  const signIn = async (selected: SocialProvider) => {
    if (disabled || isLoading) return;
    setProvider(selected);
    try {
      if (await loginWithSocial(selected)) {
        if (onSignedIn) await onSignedIn();
        else router.replace(POST_AUTH_ENTRY_POINT);
      }
    } catch (error) {
      const link = pendingLinkFrom(error, selected);
      if (link && onAccountExists) onAccountExists(link);
      else onError(t(authErrorKey(error)));
    } finally {
      setProvider(null);
    }
  };
  const handleGoogleSignIn = () => void signIn("Google");
  const handleAppleSignIn = () => void signIn("SignInWithApple");

  const appleButton = Platform.OS === "ios" ? nativeAppleAvailable && (
    <View style={styles.nativeAppleContainer} pointerEvents={disabled || isLoading ? "none" : "auto"}
      accessibilityState={{ disabled: disabled || isLoading, busy: isAppleLoading }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={mode === "dark"
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={BorderRadius.full}
        style={[styles.nativeAppleButton, (disabled || isLoading) && styles.buttonDisabled]}
        onPress={handleAppleSignIn}
      />
      {isAppleLoading && <ActivityIndicator style={styles.appleProgress} color={Colors.surface} />}
    </View>
  ) : (
    <TouchableOpacity
      style={[styles.socialButton, styles.appleButton, (disabled || isLoading) && styles.buttonDisabled]}
      onPress={handleAppleSignIn}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      accessibilityLabel={t("auth.continueWithApple")}
      accessibilityRole="button"
    >
      {isAppleLoading ? (
        <ActivityIndicator color={Colors.surface} />
      ) : (
        <>
          <Ionicons name="logo-apple" size={20} color={Colors.surface} />
          <Text style={styles.appleButtonText}>{t("auth.continueWithApple")}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  // Apple, then Google, then « or » and the e-mail form below it: the two
  // providers are seen without scrolling, as the HIG asks.
  return (
    <View style={styles.container}>
      {appleButton}
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
            <Text style={styles.googleButtonText}>{t("auth.continueWithGoogle")}</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("auth.or")}</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      gap: Spacing.sm + 4,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
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
      borderRadius: BorderRadius.full,
      minHeight: TouchTarget.comfortable - 4,
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
      fontWeight: "600",
    },
    nativeAppleContainer: {
      position: "relative",
      width: "100%",
    },
    nativeAppleButton: {
      height: TouchTarget.comfortable - 4,
      width: "100%",
    },
    appleProgress: {
      position: "absolute",
      right: Spacing.lg,
      top: "50%",
      marginTop: -10,
    },
    appleButton: {
      backgroundColor: Colors.textMain,
    },
    appleButtonText: {
      color: Colors.surface,
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
