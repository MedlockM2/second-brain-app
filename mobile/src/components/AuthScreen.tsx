import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SIGNED_OUT_ENTRY_POINT } from "../constants/routes";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { t } from "../i18n";

/**
 * The frame of the sign-in, sign-up, code and recovery screens: a back arrow, the
 * title and its subtitle, the form, and a footer held at the bottom of the screen
 * (it follows the form when the form is taller than the screen).
 */
export function AuthScreen({ title, subtitle, onBack, hideBack = false, centered = false, header, footer, children }: {
  /** A string, or a sentence with a styled word in it (the sign-in screen's brand). */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Replaces the default back: to the previous screen, else to the sign-in screen. */
  onBack?: () => void;
  /** The sign-in screen is the signed-out entry point: nothing is behind it. */
  hideBack?: boolean;
  /** Header, title and subtitle centred, under a centred logo. */
  centered?: boolean;
  /** Above the title: the envelope of the code screen, the logo of the sign-in screen. */
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => router.canGoBack() ? router.back() : router.replace(SIGNED_OUT_ENTRY_POINT));
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xs, paddingBottom: insets.bottom + Spacing.md }]}
      keyboardShouldPersistTaps="handled">
      {hideBack ? null : <TouchableOpacity style={styles.back} onPress={back} accessibilityRole="button" accessibilityLabel={t("auth.back")} testID="auth-back-button">
        <Ionicons name="chevron-back" size={26} color={colors.textMain} />
      </TouchableOpacity>}
      {header ? <View style={centered && styles.centered}>{header}</View> : null}
      <Text style={[styles.title, centered && styles.centeredText]} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, centered && styles.centeredText]}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: Spacing.lg },
  back: { width: TouchTarget.minimum, height: TouchTarget.minimum, marginLeft: -12, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 30, fontWeight: Typography.display.fontWeight, letterSpacing: Typography.display.letterSpacing,
    color: colors.textMain, marginTop: Spacing.xs },
  subtitle: { ...Typography.body, color: colors.textSubtle, marginTop: 6 },
  body: { marginTop: Spacing.lg - 4 },
  centered: { alignItems: "center" },
  centeredText: { textAlign: "center" },
  // `auto` pushes the footer to the bottom of a screen the form does not fill.
  footer: { marginTop: "auto", paddingTop: Spacing.lg, gap: Spacing.sm },
});
