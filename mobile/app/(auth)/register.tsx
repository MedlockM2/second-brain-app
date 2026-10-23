import { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { meetsPasswordPolicy } from "@media-summarizer/core/auth/passwordRules";
import { useAuth } from "../../src/contexts/AuthContext";
import { getFriendlyErrorMessage } from "../../src/lib/getFriendlyErrorMessage";
import { getEmailValidationError } from "../../src/lib/validation";
import { SocialAuthButtons } from "../../src/components/SocialAuthButtons";
import { t } from "../../src/i18n";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthCodeScreen } from "../../src/components/AuthCodeScreen";
import { AuthField } from "../../src/components/AuthField";
import { AuthScreen } from "../../src/components/AuthScreen";
import { PasswordRules } from "../../src/components/PasswordRules";
import { SlotText } from "../../src/components/SlotText";
import { PRIVACY_POLICY_URL, TERMS_URL } from "../../src/constants/legal";
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
  const [confirmation, setConfirmation] = useState("");
  // The mismatch is said once the person leaves the confirmation, not while they type it.
  const [confirmationLeft, setConfirmationLeft] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The address already has an account (decision of 2026-10-20): say so and offer the way in.
  const [accountExists, setAccountExists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verification, setVerification] = useState<LoginRequest | null>(null);
  useFocusEffect(useCallback(() => () => {
    setVerification(null);
    setPassword("");
    setConfirmation("");
    setConfirmationLeft(false);
  }, []));

  const passwordValid = meetsPasswordPolicy(password);
  const matches = confirmation.length > 0 && confirmation === password;
  const ready = email.trim().length > 0 && passwordValid && matches;

  const handleRegister = async () => {
    if (!ready || isSubmitting) return;
    setError(null);
    setAccountExists(false);
    const invalidEmail = getEmailValidationError(email);
    if (invalidEmail) {
      setEmailError(invalidEmail);
      return;
    }

    setIsSubmitting(true);
    try {
      const credentials = { email: email.trim(), password };
      await register(credentials);
      setVerification(credentials);
      setPassword("");
      setConfirmation("");
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

  const link = (key: "paywall.terms" | "paywall.privacy", url: string) =>
    <Text key={key} style={styles.legalLink} accessibilityRole="link" onPress={() => void Linking.openURL(url)}>{t(key)}</Text>;

  return (
    <AuthScreen
      title={t("register.title")}
      subtitle={t("register.subtitle")}
      footer={<>
        {!accountExists && <SlotText style={styles.legal} template={t("register.legal")}
          slots={{ terms: link("paywall.terms", TERMS_URL), privacy: link("paywall.privacy", PRIVACY_POLICY_URL) }} />}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("register.hasAccount")} </Text>
          <TouchableOpacity accessibilityRole="link" onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerLink}>{t("register.signInLink")}</Text>
          </TouchableOpacity>
        </View>
      </>}
    >
      <SocialAuthButtons
        onError={(message) => setError(message)}
        onAccountExists={(pending) => router.replace({
          pathname: "/(auth)/login",
          params: { link: pending.provider, methods: pending.methods.join(",") },
        })}
        disabled={isSubmitting}
      />

      <View style={styles.form}>
        <AuthField
          label={t("auth.email")}
          testID="register-email-input"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setEmailError(null);
            setError(null);
            setAccountExists(false);
          }}
          placeholder={t("auth.emailPlaceholder")}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          editable={!isSubmitting}
          message={emailError ? { tone: "error", content: emailError } : undefined}
        />

        {accountExists ? (
          // Nothing left to create: the password fields give way to the two ways in.
          <View style={styles.existsCard} accessibilityLiveRegion="polite">
            <View style={styles.existsHead}>
              <Ionicons name="person-circle-outline" size={22} color={Colors.textMain} />
              <Text style={styles.existsTitle}>{t("register.existsTitle")}</Text>
            </View>
            <Text style={styles.existsBody}>{t("register.existsBody")}</Text>
            <View style={styles.existsActions}>
              <TouchableOpacity accessibilityRole="button" style={[styles.smallButton, styles.smallPrimary]}
                onPress={() => router.replace({ pathname: "/(auth)/login", params: { email: email.trim() } })}>
                <Text style={styles.smallPrimaryText}>{t("login.submit")}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[styles.smallButton, styles.smallTonal]}
                onPress={() => router.replace({ pathname: "/(auth)/forgot-password", params: { email: email.trim() } })}>
                <Text style={styles.smallTonalText}>{t("auth.forgotPasswordAction")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <AuthField
              secure
              label={t("auth.password")}
              testID="register-password-input"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              placeholder={t("register.passwordPlaceholder")}
              initiallyVisible={process.env.EXPO_PUBLIC_E2E_MODE === "true"}
              autoComplete={process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "off" : "new-password"}
              textContentType={process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "none" : "newPassword"}
              passwordRules="minlength: 12; required: lower; required: upper; required: digit;"
              editable={!isSubmitting}
            >
              <PasswordRules password={password} />
            </AuthField>

            <AuthField
              secure
              label={t("auth.confirmPassword")}
              testID="register-confirm-input"
              value={confirmation}
              onChangeText={setConfirmation}
              onBlur={() => setConfirmationLeft(true)}
              initiallyVisible={process.env.EXPO_PUBLIC_E2E_MODE === "true"}
              autoComplete={process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "off" : "new-password"}
              textContentType={process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "none" : "newPassword"}
              returnKeyType="go"
              onSubmitEditing={() => void handleRegister()}
              editable={!isSubmitting}
              message={matches && passwordValid
                ? { tone: "success", content: t("auth.passwordsMatch") }
                : confirmationLeft && confirmation.length > 0 && !matches
                  ? { tone: "error", content: t("auth.passwordsMismatch") }
                  : undefined}
            />

            {error && <Text style={styles.formError} accessibilityRole="alert">{error}</Text>}

            <TouchableOpacity
              testID="register-submit-button"
              style={[styles.button, (!ready || isSubmitting) && styles.buttonDisabled]}
              onPress={() => void handleRegister()}
              disabled={!ready || isSubmitting}
              activeOpacity={0.8}
              accessibilityLabel={t("register.submitA11y")}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready || isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>{t("register.submit")}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </AuthScreen>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    form: {
      gap: Spacing.md,
    },
    formError: {
      color: Colors.error,
      fontSize: Typography.small.fontSize,
    },
    existsCard: {
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    existsHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    existsTitle: {
      fontSize: Typography.body.fontSize,
      fontWeight: "700",
      color: Colors.textMain,
    },
    existsBody: {
      fontSize: Typography.label.fontSize,
      color: Colors.textSubtle,
    },
    existsActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    smallButton: {
      minHeight: TouchTarget.minimum - 8,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      justifyContent: "center",
    },
    smallPrimary: {
      backgroundColor: Colors.primary,
    },
    smallPrimaryText: {
      color: Colors.onPrimary,
      fontSize: Typography.label.fontSize,
      fontWeight: "700",
    },
    smallTonal: {
      backgroundColor: Colors.surfaceContainer,
    },
    smallTonalText: {
      color: Colors.textMain,
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
    },
    button: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.full,
      minHeight: TouchTarget.comfortable - 4,
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.xs,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonText: {
      color: Colors.onPrimary,
      fontSize: Typography.body.fontSize,
      fontWeight: "700",
    },
    legal: {
      textAlign: "center",
      color: Colors.textSubtle,
      fontSize: Typography.small.fontSize,
      lineHeight: 19,
    },
    legalLink: {
      color: Colors.textMain,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
    },
    footerText: {
      color: Colors.textSubtle,
      fontSize: Typography.label.fontSize,
    },
    footerLink: {
      color: Colors.textMain,
      fontSize: Typography.label.fontSize,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
  });
