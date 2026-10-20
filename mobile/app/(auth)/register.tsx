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
} from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { getFriendlyErrorMessage } from "../../src/lib/getFriendlyErrorMessage";
import {
  getEmailValidationError,
  getPasswordValidationError,
} from "../../src/lib/validation";
import { SocialAuthButtons } from "../../src/components/SocialAuthButtons";
import { t } from "../../src/i18n";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthCodeScreen } from "../../src/components/AuthCodeScreen";
import { PasswordField } from "../../src/components/PasswordField";

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

export default function RegisterScreen() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The address already has an account (decision of 2026-10-20): say so and offer the way in.
  const [accountExists, setAccountExists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verification, setVerification] = useState<LoginRequest | null>(null);
  useFocusEffect(useCallback(() => () => {
    setVerification(null);
    setPassword("");
  }, []));

  const handleRegister = async () => {
    setError(null);
    setAccountExists(false);

    // Client-side validation
    const emailError = getEmailValidationError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const passwordError = getPasswordValidationError(password, 12);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);
    try {
      const credentials = { email: email.trim(), password };
      await register(credentials);
      setVerification(credentials);
      setPassword("");
    } catch (err) {
      if ((err as { code?: string }).code === "AUTH_ACCOUNT_EXISTS") {
        setAccountExists(true);
        return;
      }
      setError(getFriendlyErrorMessage(err, { fallback: t("register.failed") }));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <Text style={styles.title}>{t("register.title")}</Text>
          <Text style={styles.subtitle}>{t("register.subtitle")}</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {accountExists && (
          <View style={styles.errorContainer} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{t("error.emailAlreadyExists")}</Text>
            <View style={styles.existsActions}>
              <TouchableOpacity accessibilityRole="button" style={styles.existsAction}
                onPress={() => router.replace({ pathname: "/(auth)/login", params: { email: email.trim() } })}>
                <Text style={styles.footerLink}>{t("register.signInLink")}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.existsAction}
                onPress={() => router.replace({ pathname: "/(auth)/forgot-password", params: { email: email.trim() } })}>
                <Text style={styles.footerLink}>{t("auth.forgotPassword")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t("auth.email")}</Text>
            <TextInput
              testID="register-email-input"
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
                setAccountExists(false);
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
              hint={t("auth.passwordPolicy")}
              testID="register-password-input"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              placeholder={t("register.passwordPlaceholder")}
              placeholderTextColor={Colors.textMuted}
              initiallyVisible={process.env.EXPO_PUBLIC_E2E_MODE === "true"}
              autoComplete={
                process.env.EXPO_PUBLIC_E2E_MODE === "true"
                  ? "off"
                  : "new-password"
              }
              textContentType={
                process.env.EXPO_PUBLIC_E2E_MODE === "true"
                  ? "none"
                  : "newPassword"
              }
              editable={!isSubmitting}
            />
          <TouchableOpacity
            testID="register-submit-button"
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityLabel={t("register.submitA11y")}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{t("register.submit")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <SocialAuthButtons
          onError={(message) => setError(message)}
          onAccountExists={(link) => router.replace({
            pathname: "/(auth)/login",
            params: { link: link.provider, methods: link.methods.join(",") },
          })}
          disabled={isSubmitting}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("register.hasAccount")} </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>{t("register.signInLink")}</Text>
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
    existsActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.lg,
      marginTop: Spacing.sm,
    },
    existsAction: {
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
    },
    errorText: {
      color: Colors.error,
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
