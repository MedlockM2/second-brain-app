import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PASSWORD_RULES } from "@media-summarizer/core/auth/passwordRules";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, Typography, type Theme } from "../constants/theme";
import { t } from "../i18n";

/**
 * The password rules as badges, visible before the first keystroke: grey until a
 * rule is met, then green. Never red — nothing has failed while the person types.
 */
export function PasswordRules({ password }: { password: string }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.row} accessibilityLabel={t("auth.rulesA11y")}>
    {PASSWORD_RULES.map((rule) => {
      const met = rule.met(password);
      return <View key={rule.key} style={[styles.badge, met && styles.badgeMet]}
        accessible accessibilityRole="text" accessibilityState={{ checked: met }}>
        <Ionicons name={met ? "checkmark" : "ellipse-outline"} size={met ? 14 : 10}
          color={met ? colors.success : colors.textMuted} />
        <Text style={[styles.text, met && styles.textMet]}>{t(rule.key)}</Text>
      </View>;
    })}
  </View>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 10,
    borderRadius: BorderRadius.full, backgroundColor: colors.surfaceContainer },
  badgeMet: { backgroundColor: colors.successTint },
  text: { ...Typography.small, color: colors.textSubtle, fontWeight: "500" },
  textMet: { color: colors.success, fontWeight: "600" },
});
