import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { t, useTranslation } from "../../src/i18n";
import {
  Spacing,
  Typography,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../../src/constants/theme";
import {
  THEME_PREFERENCES,
  THEME_PREFERENCE_LABEL_KEYS,
  useThemeColors,
  useThemedStyles,
  useThemePreference,
  type ThemePreference,
} from "../../src/contexts/ThemeContext";
import {
  ScreenHeader,
  HeaderIconButton,
} from "../../src/components/ScreenHeader";

/** One glyph per state, so each row is recognisable before it is read. */
const OPTION_ICONS: Record<
  ThemePreference,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  system: "phone-portrait-outline",
  light: "sunny-outline",
  dark: "moon-outline",
};

/**
 * The appearance of the interface — the third setting that lives on the device
 * and never travels to the backend, next to the interface language.
 *
 * Three rows, not the two the TestFlight request asked for: "follow my device"
 * is the default state and the one the OS already decides every evening, so a
 * picker that only offered Clair/Sombre would pin a phone on auto-dark to
 * whichever one the user last tapped. It is listed first for the same reason the
 * language screen lists its own device row first, and it names the appearance it
 * currently resolves to so the effect is visible before the tap.
 *
 * Switching is instant and total: `ThemeProvider` swaps the `Theme` object, and
 * every screen on the stack rebuilds its style sheet from the new one — no
 * restart, unlike the RTL layout flip the language screen has to ask for.
 *
 * A plain column rather than the `FlatList` the language screen uses: there are
 * three rows, fixed, and they all fit.
 */
export default function ThemeScreen() {
  const router = useRouter();
  // Subscribes the screen to the interface language, so the labels below follow
  // a language switched in the neighbouring setting.
  useTranslation();
  const { preference, setPreference, deviceMode } = useThemePreference();
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView testID="theme-screen" style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("theme.title")}
        leading={
          <HeaderIconButton
            icon="chevron-back"
            variant="plain"
            onPress={() => router.back()}
            accessibilityLabel={t("common.goBack")}
          />
        }
      />

      <View style={styles.disclaimer}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={Colors.textMuted}
        />
        <Text style={styles.disclaimerText}>{t("theme.disclaimer")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {THEME_PREFERENCES.map((option) => {
          const isSelected = option === preference;
          const label = t(THEME_PREFERENCE_LABEL_KEYS[option]);
          // Only the device row has something to add: which of the two
          // appearances the phone is asking for right now.
          const detail =
            option === "system"
              ? t(deviceMode === "dark" ? "theme.dark" : "theme.light")
              : null;

          return (
            <Pressable
              key={option}
              testID={`theme-option-${option}`}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setPreference(option)}
              accessibilityLabel={t("theme.selectA11y", { theme: label })}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons
                name={OPTION_ICONS[option]}
                size={22}
                color={isSelected ? Colors.primary : Colors.textSubtle}
              />
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                ]}
              >
                {label}
              </Text>
              {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={Colors.primary}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    disclaimer: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    disclaimerText: {
      flex: 1,
      ...Typography.small,
      color: Colors.textMuted,
      lineHeight: Typography.body.lineHeight,
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.sm,
      minHeight: TouchTarget.minimum,
    },
    optionSelected: {
      backgroundColor: Colors.surfaceContainerHigh,
    },
    optionLabel: {
      flex: 1,
      ...Typography.body,
      fontWeight: "500",
      color: Colors.textMain,
    },
    optionLabelSelected: {
      fontWeight: "700",
    },
    optionDetail: {
      ...Typography.small,
      color: Colors.textMuted,
    },
  });
