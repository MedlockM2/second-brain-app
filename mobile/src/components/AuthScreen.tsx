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
 * The frame of every screen pushed from the welcome carousel: a back arrow, the
 * title and its subtitle, the form, and a footer held at the bottom of the screen
 * (it follows the form when the form is taller than the screen).
 */
export function AuthScreen({ title, subtitle, onBack, header, footer, children }: {
  title: string;
  subtitle?: ReactNode;
  /** Replaces the default back: to the previous screen, else to the welcome carousel. */
  onBack?: () => void;
  /** Above the title: the envelope of the code screen. */
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
      <TouchableOpacity style={styles.back} onPress={back} accessibilityRole="button" accessibilityLabel={t("auth.back")} testID="auth-back-button">
        <Ionicons name="chevron-back" size={26} color={colors.textMain} />
      </TouchableOpacity>
      {header}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
  // `auto` pushes the footer to the bottom of a screen the form does not fill.
  footer: { marginTop: "auto", paddingTop: Spacing.lg, gap: Spacing.sm },
});
