import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Link, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  authErrorKey,
  pendingLinkMessage,
  type PendingLink,
  type SignInMethod,
  type SocialProvider,
} from "@media-summarizer/core/auth/cognito";
import { AuthService } from "../../src/services/authService";
import { useAuth } from "../../src/contexts/AuthContext";
import { getFriendlyErrorMessage } from "../../src/lib/getFriendlyErrorMessage";
import {
  getEmailValidationError,
  getPasswordValidationError,
} from "../../src/lib/validation";
import { SocialAuthButtons } from "../../src/components/SocialAuthButtons";
import { t } from "../../src/i18n";
import { POST_AUTH_ENTRY_POINT } from "../../src/constants/routes";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthCodeScreen } from "../../src/components/AuthCodeScreen";
import { PasswordField } from "../../src/components/PasswordField";
import {
  Typography,
  Spacing,
  BorderRadius,
  type Theme,
} from "../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../src/contexts/ThemeContext";

export default function LoginScreen() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { login, sessionError, clearSessionError } = useAuth();
  // A social sign-in refused on register hands its pending link over here.
  const params = useLocalSearchParams<{ email?: string; link?: string; methods?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(() =>
    params.link === "Google" || params.link === "SignInWithApple"
      ? { provider: params.link as SocialProvider, methods: String(params.methods ?? "").split(",") as SignInMethod[] }
      : null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verification, setVerification] = useState<LoginRequest | null>(null);
  useFocusEffect(useCallback(() => () => {
    setVerification(null);
    setPassword("");
  }, []));

  // Signed in to the account that holds the address: add the refused provider to
  // it. Cancelling or failing leaves the person signed in (task-529).
  const finish = async () => {
    const link = pendingLink;
    setPendingLink(null);
    if (link) {
      try {
        await AuthService.linkProvider(link.provider);
      } catch (caught) {
        Alert.alert(t(authErrorKey(caught)));
      }
    }
    router.replace(POST_AUTH_ENTRY_POINT);
  };

  const handleLogin = async () => {
    setError(null);

    // Client-side validation
    const emailError = getEmailValidationError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      await finish();
    } catch (err) {
      if ((err as { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        setVerification({ email: email.trim(), password });
        setPassword("");
        return;
      }
      setError(getFriendlyErrorMessage(err, { fallback: t("login.failed") }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = error || sessionError;

  if (verification) return <AuthCodeScreen recovery={false} credentials={verification} onCancel={() => setVerification(null)} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("login.title")}</Text>
          <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
        </View>

        {pendingLink && !displayError && (
          <View style={styles.noticeContainer} accessibilityLiveRegion="polite">
            <Text style={styles.noticeText}>{pendingLinkMessage(t, pendingLink)}</Text>
          </View>
        )}

        {displayError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t("auth.email")}</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
                if (sessionError) clearSessionError();
              }}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isSubmitting}
            />
          </View>

            <PasswordField
              label={t("auth.password")}
              testID="login-password-input"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              placeholder={t("login.passwordPlaceholder")}
              placeholderTextColor={Colors.textMuted}
              initiallyVisible={process.env.EXPO_PUBLIC_E2E_MODE === "true"}
              autoComplete={
                process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "off" : "password"
              }
              textContentType={
                process.env.EXPO_PUBLIC_E2E_MODE === "true"
                  ? "none"
                  : "password"
              }
              editable={!isSubmitting}
            />

          <TouchableOpacity
            testID="login-submit-button"
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityLabel={t("login.submitA11y")}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{t("login.submit")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/forgot-password" style={styles.footerLink} accessibilityRole="link">
          {t("auth.forgotPassword")}
        </Link>

        <SocialAuthButtons
          onError={(message) => setError(message)}
          onAccountExists={(link) => { setError(null); setPendingLink(link); }}
          onSignedIn={finish}
          disabled={isSubmitting}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("login.noAccount")} </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity testID="login-sign-up-button">
              <Text style={styles.footerLink}>{t("login.signUpLink")}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: Spacing.lg,
    },
    header: {
      marginBottom: Spacing.xl,
    },
    title: {
      fontSize: Typography.display.fontSize,
      fontWeight: Typography.display.fontWeight,
      color: Colors.textMain,
      letterSpacing: Typography.display.letterSpacing,
    },
    subtitle: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
      marginTop: Spacing.sm,
    },
    errorContainer: {
      backgroundColor: Colors.errorContainer,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    errorText: {
      color: Colors.error,
      fontSize: Typography.small.fontSize,
    },
    noticeContainer: {
      backgroundColor: Colors.surfaceContainerLow,
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    noticeText: {
      color: Colors.textMain,
      fontSize: Typography.small.fontSize,
    },
    form: {
      gap: Spacing.md,
    },
    inputGroup: {
      gap: Spacing.xs,
    },
    inputLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
    input: {
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.outlineVariant,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      fontSize: Typography.body.fontSize,
      color: Colors.textMain,
    },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: Colors.onPrimary,
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: Spacing.xl,
    },
    footerText: {
      color: Colors.textMuted,
      fontSize: Typography.label.fontSize,
    },
    footerLink: {
      color: Colors.textMain,
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
    },
  });
