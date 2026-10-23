import { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { AuthField } from "../../src/components/AuthField";
import { AuthScreen } from "../../src/components/AuthScreen";
import { SlotText } from "../../src/components/SlotText";
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

/** Which field an error belongs under; the rest go above the button. */
type LoginError = { field: "email" | "password" | "form"; message: string; wrongPassword?: boolean };

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
  const [error, setError] = useState<LoginError | null>(null);
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
      setError({ field: "email", message: emailError });
      return;
    }
    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setError({ field: "password", message: passwordError });
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      await finish();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "EMAIL_NOT_VERIFIED") {
        setVerification({ email: email.trim(), password });
        setPassword("");
        return;
      }
      if (code === "INVALID_CREDENTIALS") {
        setError({ field: "password", message: t("login.wrongPassword"), wrongPassword: true });
        return;
      }
      setError({ field: "form", message: getFriendlyErrorMessage(err, { fallback: t("login.failed") }) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const forgotPassword = () => router.push({ pathname: "/(auth)/forgot-password", params: { email: email.trim() } });
  const formError = error?.field === "form" ? error.message : sessionError;
  const messageFor = (field: LoginError["field"]) => error?.field === field ? {
    tone: "error" as const,
    content: error.wrongPassword
      ? <SlotText template={error.message} slots={{
          reset: <Text key="reset" style={styles.inlineLink} onPress={forgotPassword} accessibilityRole="link">{t("login.resetLink")}</Text>,
        }} />
      : error.message,
  } : undefined;

  if (verification) return <AuthCodeScreen recovery={false} credentials={verification} onCancel={() => setVerification(null)} />;

  return (
    <AuthScreen
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t("login.noAccount")} </Text>
          <TouchableOpacity testID="login-sign-up-button" accessibilityRole="link"
            onPress={() => router.replace("/(auth)/register")}>
            <Text style={styles.footerLink}>{t("login.signUpLink")}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {pendingLink && !formError && (
        <View style={styles.noticeContainer} accessibilityLiveRegion="polite">
          <Text style={styles.noticeText}>{pendingLinkMessage(t, pendingLink)}</Text>
        </View>
      )}

      <SocialAuthButtons
        onError={(message) => setError({ field: "form", message })}
        onAccountExists={(link) => { setError(null); setPendingLink(link); }}
        onSignedIn={finish}
        disabled={isSubmitting}
      />

      <View style={styles.form}>
        <AuthField
          label={t("auth.email")}
          testID="login-email-input"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
            if (sessionError) clearSessionError();
          }}
          placeholder={t("auth.emailPlaceholder")}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          editable={!isSubmitting}
          message={messageFor("email")}
        />

        <AuthField
          secure
          label={t("auth.password")}
          labelAccessory={
            <TouchableOpacity onPress={forgotPassword} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.accessoryLink}>{t("auth.forgotPassword")}</Text>
            </TouchableOpacity>
          }
          testID="login-password-input"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
          placeholder={t("login.passwordPlaceholder")}
          initiallyVisible={process.env.EXPO_PUBLIC_E2E_MODE === "true"}
          autoComplete={process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "off" : "password"}
          textContentType={process.env.EXPO_PUBLIC_E2E_MODE === "true" ? "none" : "password"}
          returnKeyType="go"
          onSubmitEditing={() => void handleLogin()}
          editable={!isSubmitting}
          message={messageFor("password")}
        />

        {formError && (
          <Text style={styles.formError} accessibilityRole="alert">{formError}</Text>
        )}

        <TouchableOpacity
          testID="login-submit-button"
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={() => void handleLogin()}
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
    </AuthScreen>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    noticeContainer: {
      backgroundColor: Colors.surfaceContainerLow,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
    },
    noticeText: {
      color: Colors.textMain,
      fontSize: Typography.small.fontSize,
    },
    form: {
      gap: Spacing.md,
    },
    accessoryLink: {
      color: Colors.textSubtle,
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
    },
    inlineLink: {
      textDecorationLine: "underline",
      fontWeight: "600",
    },
    formError: {
      color: Colors.error,
      fontSize: Typography.small.fontSize,
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
      opacity: 0.6,
    },
    buttonText: {
      color: Colors.onPrimary,
      fontSize: Typography.body.fontSize,
      fontWeight: "700",
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
