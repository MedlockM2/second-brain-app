import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import { meetsPasswordPolicy } from "@media-summarizer/core/auth/passwordRules";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthService } from "../services/authService";
import { t } from "../i18n";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { POST_AUTH_ENTRY_POINT } from "../constants/routes";
import { AuthField } from "./AuthField";
import { AuthScreen } from "./AuthScreen";
import { CODE_LENGTH, OtpInput } from "./OtpInput";
import { PasswordRules } from "./PasswordRules";
import { SlotText } from "./SlotText";

/** Cognito accepts a new code request about once a minute; the link waits as long. */
const RESEND_DELAY_SECONDS = 60;

/**
 * The e-mail code, after sign-up (`recovery` false) and for a forgotten password
 * (`recovery` true: address, then code and new password). A verified sign-up
 * opens the session and goes to `/`, which leads to the reading language.
 */
export function AuthCodeScreen({ recovery, credentials, onCancel }: { recovery: boolean; credentials?: LoginRequest; onCancel?: () => void }) {
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = credentials?.email ?? (typeof params.email === "string" ? params.email : "");
  const { login } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState(credentials?.password ?? "");
  const [step, setStep] = useState<"email" | "code" | "signIn">(recovery ? "email" : "code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A code was just sent on arriving here, by the sign-up or by the "send" of recovery.
  const [resendIn, setResendIn] = useState(recovery ? 0 : RESEND_DELAY_SECONDS);
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function send() {
    if (busy || !email.trim()) return;
    setBusy(true); setError(null);
    try {
      await AuthService.action(recovery ? "/forgot-password" : "/resend-confirmation", { email: email.trim() });
      setStep("code"); setCode(""); setResendIn(RESEND_DELAY_SECONDS);
    } catch (caught) { setError(t(authErrorKey(caught))); }
    finally { setBusy(false); }
  }

  async function confirm(enteredCode = code) {
    if (busy || !email.trim() || (step === "code" && enteredCode.length < CODE_LENGTH) || !password) return;
    setBusy(true); setError(null);
    try {
      if (step === "code") {
        await AuthService.action(recovery ? "/confirm-password" : "/confirm-registration", {
          email: email.trim(), code: enteredCode, ...(recovery ? { password } : {}),
        });
        // Keep the confirmed state if opening the session needs a retry.
        setStep("signIn"); setCode("");
      }
      await login({ email: email.trim(), password });
      setPassword("");
      router.replace(POST_AUTH_ENTRY_POINT);
    } catch (caught) {
      setError(t(authErrorKey(caught)));
      if (step === "code") setCode("");
    }
    finally { setBusy(false); }
  }

  // A sign-up that carries its password confirms on the sixth digit.
  const onCode = (next: string) => {
    setCode(next); setError(null);
    if (next.length === CODE_LENGTH && !recovery && password) void confirm(next);
  };

  if (step === "signIn" && busy) return <View style={styles.loading} accessibilityLiveRegion="polite">
    <ActivityIndicator color={colors.primary} />
    <Text style={styles.body}>{t("common.loading")}</Text>
  </View>;

  const envelope = <View style={styles.halo}><Ionicons name="mail-open-outline" size={26} color={colors.textMain} /></View>;
  const resend = resendIn > 0
    ? <Text key="resend" style={styles.muted}>{t("auth.resendIn", { time: `0:${String(resendIn).padStart(2, "0")}` })}</Text>
    : <Text key="resend" style={styles.inlineLink} accessibilityRole="link" onPress={() => void send()}>{t("auth.resendLink")}</Text>;
  const button = (label: string, enabled: boolean, onPress: () => void) =>
    <TouchableOpacity style={[styles.button, !enabled && styles.buttonDisabled]} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={onPress}>
      {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>;
  const errorText = error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>;

  if (step === "email") return <AuthScreen title={t("auth.recoveryTitle")} subtitle={t("auth.recoveryHint")} onBack={onCancel}>
    <View style={styles.form}>
      <AuthField label={t("auth.email")} value={email} onChangeText={setEmail} keyboardType="email-address"
        autoComplete="email" placeholder={t("auth.emailPlaceholder")} editable={!busy}
        returnKeyType="send" onSubmitEditing={() => void send()} />
      {errorText}
      {button(t("auth.sendCode"), !busy && email.trim().length > 0, () => void send())}
    </View>
  </AuthScreen>;

  if (step === "signIn") return <AuthScreen title={t("login.title")} subtitle={t(recovery ? "auth.passwordChanged" : "auth.verified")} onBack={onCancel}>
    <View style={styles.form}>
      <AuthField secure label={t("auth.password")} value={password} onChangeText={setPassword}
        autoComplete="password" textContentType="password" editable={!busy} />
      {errorText}
      {button(t("login.submit"), !busy && password.length > 0, () => void confirm())}
    </View>
  </AuthScreen>;

  // The code step. The address is the one the code went to; « Edit » goes back to
  // where it was typed (the sign-up form, or the first step of recovery).
  const edit = recovery
    ? () => { setStep("email"); setCode(""); setPassword(""); setError(null); }
    : onCancel;
  const needsPassword = recovery || !credentials;
  return <AuthScreen
    header={envelope}
    title={t(recovery ? "auth.newPassword" : "auth.codeTitle")}
    subtitle={<>
      {t("auth.codeSentTo")}{"\n"}
      <Text style={styles.email}>{email}</Text>
      {edit && <>{" · "}<Text style={styles.inlineLink} accessibilityRole="link" onPress={edit}>{t("auth.changeEmail")}</Text></>}
    </>}
    onBack={onCancel}
  >
    <View style={styles.form}>
      <OtpInput value={code} onChange={onCode} editable={!busy} invalid={Boolean(error)} testID="auth-code-input" />
      {errorText}
      <SlotText style={styles.help} template={t("auth.codeHelp")} slots={{ resend }} />
      {needsPassword && <AuthField secure label={t(recovery ? "auth.newPassword" : "auth.password")} value={password}
        onChangeText={setPassword} autoComplete={recovery ? "new-password" : "password"}
        textContentType={recovery ? "newPassword" : "password"} editable={!busy}>
        {recovery && <PasswordRules password={password} />}
      </AuthField>}
      {needsPassword && button(t(recovery ? "auth.savePassword" : "auth.confirmCode"),
        !busy && code.length === CODE_LENGTH && (recovery ? meetsPasswordPolicy(password) : password.length > 0),
        () => void confirm())}
      {!needsPassword && busy && <ActivityIndicator color={colors.primary} />}
    </View>
  </AuthScreen>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  halo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.highlight,
    alignItems: "center", justifyContent: "center", marginTop: Spacing.sm, marginBottom: Spacing.md },
  form: { gap: Spacing.md },
  body: { ...Typography.body, color: colors.textSubtle },
  email: { color: colors.textMain, fontWeight: "700" },
  inlineLink: { color: colors.textMain, fontWeight: "600", textDecorationLine: "underline" },
  muted: { color: colors.textMuted },
  help: { ...Typography.small, color: colors.textSubtle, lineHeight: 19 },
  error: { ...Typography.small, color: colors.error },
  button: { backgroundColor: colors.primary, borderRadius: BorderRadius.full, minHeight: TouchTarget.comfortable - 4,
    justifyContent: "center", alignItems: "center", marginTop: Spacing.xs },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.onPrimary, fontSize: Typography.body.fontSize, fontWeight: "700" },
});
