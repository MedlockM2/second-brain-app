import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { t } from "../i18n";

type Props = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  label: string;
  hint?: string;
  initiallyVisible?: boolean;
};

export function PasswordField({ label, hint, initiallyVisible = false, ...inputProps }: Props) {
  const [visible, setVisible] = useState(initiallyVisible);
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const toggleLabel = t(visible ? "auth.hidePassword" : "auth.showPassword");
  return <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.field}>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.textMuted}
        {...inputProps} style={styles.input} accessibilityLabel={label} accessibilityHint={hint} secureTextEntry={!visible} />
      <TouchableOpacity style={styles.toggle} accessibilityRole="button" accessibilityLabel={toggleLabel}
        accessibilityState={{ disabled: inputProps.editable === false, selected: visible }}
        disabled={inputProps.editable === false} onPress={() => setVisible(!visible)}>
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textSubtle} />
      </TouchableOpacity>
    </View>
    {hint && <Text style={styles.hint}>{hint}</Text>}
  </View>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { gap: Spacing.xs },
  label: { ...Typography.label, color: colors.textMain },
  field: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: BorderRadius.md },
  input: { ...Typography.body, flex: 1, minWidth: 0, color: colors.textMain,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: TouchTarget.minimum },
  toggle: { width: TouchTarget.minimum, minHeight: TouchTarget.minimum, alignItems: "center", justifyContent: "center" },
  hint: { ...Typography.small, color: colors.textSubtle },
});
