import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import { AuthService } from "../services/authService";
import { t } from "../i18n";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";

export function AuthCodeScreen({ recovery }: { recovery: boolean }) {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">(recovery ? "email" : "code");
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
      setStep("code"); setSent(true);
    } catch (caught) { setError(t(authErrorKey(caught))); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (busy || !email.trim() || !code.trim() || (recovery && !password)) return;
    setBusy(true); setError(null);
    try {
      await AuthService.action(recovery ? "/confirm-password" : "/confirm-registration", {
        email: email.trim(), code: code.trim(), ...(recovery ? { password } : {}),
      });
      setPassword(""); setCode(""); setStep("done");
    } catch (caught) { setError(t(authErrorKey(caught))); }
    finally { setBusy(false); }
  }
  const title = t(recovery ? "auth.recoveryTitle" : "auth.verificationTitle");
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.body}>{t(recovery ? "auth.recoveryHint" : "auth.verificationHint")}</Text>
        {step === "done" ? <Text style={styles.body} accessibilityLiveRegion="polite">{t(recovery ? "auth.passwordChanged" : "auth.verified")}</Text> : (
          <View style={styles.form}>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <TextInput style={styles.input} accessibilityLabel={t("auth.email")} value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy && (step === "email" || !params.email)} />
            {step === "code" && <>
              {sent && <Text style={styles.body} accessibilityLiveRegion="polite">{t("auth.codeSent")}</Text>}
              <Text style={styles.label}>{t("auth.code")}</Text>
              <TextInput style={styles.input} accessibilityLabel={t("auth.code")} value={code} onChangeText={setCode}
                autoComplete="one-time-code" keyboardType="number-pad" editable={!busy} />
              {recovery && <>
                <Text style={styles.label}>{t("auth.newPassword")}</Text>
                <TextInput style={styles.input} accessibilityLabel={t("auth.newPassword")} value={password} onChangeText={setPassword}
                  secureTextEntry autoComplete="new-password" editable={!busy} />
                <Text style={styles.body}>{t("auth.passwordPolicy")}</Text>
              </>}
            </>}
            {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
            <TouchableOpacity style={styles.button} accessibilityRole="button"
              accessibilityLabel={t(step === "email" ? "auth.sendCode" : recovery ? "auth.savePassword" : "auth.confirmCode")}
              disabled={busy || !email.trim() || (step === "code" && (!code.trim() || (recovery && !password)))} onPress={() => void (step === "email" ? send() : confirm())}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.label}>{t(step === "email" ? "auth.sendCode" : recovery ? "auth.savePassword" : "auth.confirmCode")}</Text>}
            </TouchableOpacity>
            {step === "code" && <TouchableOpacity style={styles.link} accessibilityRole="button" accessibilityLabel={t("auth.resendCode")} disabled={busy} onPress={() => void send()}>
              <Text style={styles.body}>{t("auth.resendCode")}</Text>
            </TouchableOpacity>}
          </View>
        )}
        <TouchableOpacity style={styles.link} accessibilityRole="button" accessibilityLabel={t("auth.backToLogin")} disabled={busy} onPress={() => router.replace("/(auth)/login")}>
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
  title: { ...Typography.display, color: colors.textMain },
  body: { ...Typography.body, color: colors.textSubtle },
  label: { ...Typography.label, color: colors.textMain },
  input: { ...Typography.body, color: colors.textMain, backgroundColor: colors.surfaceContainerLow, padding: Spacing.md, borderRadius: BorderRadius.md, minHeight: TouchTarget.minimum },
  button: { backgroundColor: colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, minHeight: TouchTarget.minimum, justifyContent: "center", alignItems: "center" },
  link: { minHeight: TouchTarget.minimum, justifyContent: "center", alignItems: "center" },
  error: { ...Typography.body, color: colors.error },
});
