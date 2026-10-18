import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthService } from "../services/authService";
import { t } from "../i18n";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { useAuth } from "../contexts/AuthContext";
import { POST_AUTH_ENTRY_POINT } from "../constants/routes";
import { PasswordField } from "./PasswordField";

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
  const [sent, setSent] = useState(false);
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  async function send() {
    if (busy || !email.trim()) return;
    setBusy(true); setError(null); setSent(false);
    try {
      await AuthService.action(recovery ? "/forgot-password" : "/resend-confirmation", { email: email.trim() });
      setStep("code"); setSent(step === "code");
    } catch (caught) { setError(t(authErrorKey(caught))); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (busy || !email.trim() || (step === "code" && !code.trim()) || !password) return;
    setBusy(true); setError(null);
    try {
      if (step === "code") {
        await AuthService.action(recovery ? "/confirm-password" : "/confirm-registration", {
          email: email.trim(), code: code.trim(), ...(recovery ? { password } : {}),
        });
        // Keep the confirmed state if opening the session needs a retry.
        setStep("signIn"); setCode("");
      }
      await login({ email: email.trim(), password });
      setPassword("");
      router.replace(POST_AUTH_ENTRY_POINT);
    } catch (caught) { setError(t(authErrorKey(caught))); }
    finally { setBusy(false); }
  }
  const titleKey = step === "signIn" ? "login.title" : recovery
    ? step === "email" ? "auth.recoveryTitle" : "auth.newPassword" : "auth.verificationTitle";
  const hintKey = step === "signIn" ? recovery ? "auth.passwordChanged" : "auth.verified" : recovery
    ? step === "email" ? "auth.recoveryHint" : "auth.recoveryCodeHint" : "auth.verificationHint";
  const actionLabel = t(step === "email" ? "auth.sendCode" : step === "signIn" ? "login.submit" : recovery ? "auth.savePassword" : "auth.confirmCode");
  if (step === "signIn" && busy) return <View style={[styles.container, styles.content]} accessibilityLiveRegion="polite">
    <ActivityIndicator color={colors.primary} />
    <Text style={styles.body}>{t("common.loading")}</Text>
  </View>;
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">{t(titleKey)}</Text>
        <Text style={styles.body}>{t(hintKey)}</Text>
          <View style={styles.form}>
            {recovery && step === "code" ? <View style={styles.recipient}>
              <Text style={[styles.body, styles.recipientEmail]}>{email}</Text>
              <TouchableOpacity style={styles.link} disabled={busy} accessibilityRole="button" accessibilityLabel={t("auth.changeEmail")}
                onPress={() => { setStep("email"); setCode(""); setPassword(""); setSent(false); setError(null); }}>
                <Text style={styles.body}>{t("auth.changeEmail")}</Text>
              </TouchableOpacity>
            </View> : <>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <TextInput style={styles.input} accessibilityLabel={t("auth.email")} value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy && (step === "email" || !initialEmail)} />
            </>}
            {step === "code" && <>
              {sent && <Text style={styles.body} accessibilityLiveRegion="polite">{t("auth.codeSent")}</Text>}
              <Text style={styles.label}>{t("auth.code")}</Text>
              <TextInput style={styles.input} accessibilityLabel={t("auth.code")} value={code} onChangeText={setCode}
                autoComplete="one-time-code" keyboardType="number-pad" editable={!busy} />
            </>}
            {(step === "signIn" || (step === "code" && (recovery || !credentials))) &&
              <PasswordField label={t(recovery && step === "code" ? "auth.newPassword" : "auth.password")}
                hint={recovery && step === "code" ? t("auth.passwordPolicy") : undefined}
                value={password} onChangeText={setPassword} autoComplete={recovery && step === "code" ? "new-password" : "password"} editable={!busy} />}
            {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
            <TouchableOpacity style={styles.button} accessibilityRole="button"
              accessibilityLabel={actionLabel}
              disabled={busy || !email.trim() || (step !== "email" && !password) || (step === "code" && !code.trim())} onPress={() => void (step === "email" ? send() : confirm())}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.label}>{actionLabel}</Text>}
            </TouchableOpacity>
            {step === "code" && <TouchableOpacity style={styles.link} accessibilityRole="button" accessibilityLabel={t("auth.resendCode")} disabled={busy} onPress={() => void send()}>
              <Text style={styles.body}>{t("auth.resendCode")}</Text>
            </TouchableOpacity>}
          </View>
        <TouchableOpacity style={styles.link} accessibilityRole="button" accessibilityLabel={t("auth.backToLogin")} disabled={busy} onPress={() => { onCancel?.(); router.replace("/(auth)/login"); }}>
          <Text style={styles.body}>{t("auth.backToLogin")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: Spacing.xl, gap: Spacing.lg },
  form: { gap: Spacing.md },
  recipient: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  recipientEmail: { flex: 1 },
  title: { ...Typography.display, color: colors.textMain },
  body: { ...Typography.body, color: colors.textSubtle },
  label: { ...Typography.label, color: colors.textMain },
  input: { ...Typography.body, color: colors.textMain, backgroundColor: colors.surfaceContainerLow, padding: Spacing.md, borderRadius: BorderRadius.md, minHeight: TouchTarget.minimum },
  button: { backgroundColor: colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, minHeight: TouchTarget.minimum, justifyContent: "center", alignItems: "center" },
  link: { minWidth: TouchTarget.minimum, minHeight: TouchTarget.minimum, justifyContent: "center", alignItems: "center" },
  error: { ...Typography.body, color: colors.error },
});
