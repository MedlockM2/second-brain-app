import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { t } from "../i18n";

type Props = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  label: string;
  /** A password field: masked, with the eye that shows it. */
  secure?: boolean;
  initiallyVisible?: boolean;
  /** Beside the label, on the same line: "Forgot password?" on sign-in. */
  labelAccessory?: ReactNode;
  /** Under the field: what is wrong with it, or that it is right. */
  message?: { tone: "error" | "success"; content: ReactNode };
  /** Under the field, before the message: the password rules on sign-up. */
  children?: ReactNode;
};

/**
 * A labelled field of the sign-in and sign-up screens. Its error is written under
 * it, where the eye already is, instead of in a banner above the form.
 */
export function AuthField({ label, secure = false, initiallyVisible = false, labelAccessory, message, children, ...inputProps }: Props) {
  const [visible, setVisible] = useState(initiallyVisible);
  const [focused, setFocused] = useState(false);
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const toggleLabel = t(visible ? "auth.hidePassword" : "auth.showPassword");
  const error = message?.tone === "error";
  return <View style={styles.container}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {labelAccessory}
    </View>
    <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.textMuted}
        {...inputProps} style={styles.input} accessibilityLabel={label} secureTextEntry={secure && !visible}
        onFocus={(event) => { setFocused(true); inputProps.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); inputProps.onBlur?.(event); }} />
      {secure && <TouchableOpacity style={styles.toggle} accessibilityRole="button" accessibilityLabel={toggleLabel}
        accessibilityState={{ disabled: inputProps.editable === false, selected: visible }}
        disabled={inputProps.editable === false} onPress={() => setVisible(!visible)}>
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textSubtle} />
      </TouchableOpacity>}
    </View>
    {children}
    {message && <View style={styles.message} accessibilityLiveRegion="polite" accessibilityRole={error ? "alert" : undefined}>
      <Ionicons name={error ? "alert-circle-outline" : "checkmark-circle"} size={16}
        color={error ? colors.error : colors.success} style={styles.messageIcon} />
      <Text style={[styles.messageText, { color: error ? colors.error : colors.success }]}>{message.content}</Text>
    </View>}
  </View>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { gap: Spacing.xs + 2 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm },
  label: { ...Typography.label, color: colors.textMain },
  field: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: BorderRadius.lg },
  // The thicker ring grows outwards, so the text does not shift on focus.
  fieldFocused: { borderColor: colors.primary, borderWidth: 2, margin: -1 },
  fieldError: { borderColor: colors.error },
  input: { ...Typography.body, flex: 1, minWidth: 0, color: colors.textMain,
    paddingHorizontal: Spacing.md, paddingVertical: 12, minHeight: TouchTarget.minimum + 4 },
  toggle: { width: TouchTarget.minimum, minHeight: TouchTarget.minimum, alignItems: "center", justifyContent: "center" },
  message: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  messageIcon: { marginTop: 1 },
  messageText: { ...Typography.small, flex: 1, lineHeight: 18 },
});
