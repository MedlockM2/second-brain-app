import { useCallback } from "react";
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { SlotText } from "../../src/components/SlotText";
import { ART_HEIGHT, ART_WIDTH, Glow } from "../../src/components/intro/artKit";
import { SHARE_ICON, ShareSheetArt, WorksWith } from "../../src/components/intro/IntroArt";
import { markIntroSeen } from "../../src/lib/introState";
import { t } from "../../src/i18n";
import { Spacing, TouchTarget, Typography, type Theme } from "../../src/constants/theme";
import { useThemeColors, useThemedStyles } from "../../src/contexts/ThemeContext";

/**
 * The intro shown once, after the first sign-in of a first install
 * (`src/lib/introState.ts`): how to save from another app, the one gesture the
 * app cannot teach from inside (TestFlight feedback AHZj_EmKyk_-POh6f05H_SE;
 * mockup `mobile-design-mockups/onboarding_apres_connexion`).
 *
 * One page since 2026-11-01 (owner): « on your phone and your computer » is
 * dropped while the web app is unpublished — it promised testers something they
 * could not open — and comes back as a second page when the web ships. TestFlight's
 * « From the Developer » text no longer lists features either, so nothing is
 * said twice before the app.
 *
 * Readwise-style frame, the owner's choice: the text centred at the top, the
 * illustration below it in the same background, running off the bottom of the
 * screen and fading out under the button. No way back (`gestureEnabled: false`
 * in `app/_layout.tsx`, Android's back button swallowed here), no « Passer ».
 * « C'est parti » settles the intro and opens the inbox.
 */
export default function IntroScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The illustration is drawn on the mockup's 414-point width.
  const scale = width / ART_WIDTH;

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []));

  const start = () => {
    markIntroSeen();
    router.replace("/(tabs)/inbox");
  };

  // The fade under the button: the screen's own colour, from transparent to opaque.
  const fade = `linear-gradient(to bottom, ${colors.surfaceContainerLow}00 0%, ${colors.surfaceContainerLow} 46%)`;

  return <View style={styles.container} testID="intro-screen">
    <View style={[styles.text, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.title} accessibilityRole="header">{t("intro.share.title")}</Text>
      <SlotText style={styles.body} template={t(Platform.OS === "android" ? "intro.share.bodyAndroid" : "intro.share.bodyIos")} slots={{
        share: <Ionicons key="share" name={SHARE_ICON} size={17} color={colors.textMain} />,
        app: <Text key="app" style={styles.strong}>Deepn</Text>,
      }} />
      <WorksWith />
    </View>
    <View style={styles.artArea} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.art, { top: 20, left: (width - ART_WIDTH) / 2, transform: [{ scale }] }]}>
        <Glow top={20} height={420} />
        <ShareSheetArt />
      </View>
    </View>
    <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm, experimental_backgroundImage: fade }]}>
      <TouchableOpacity
        testID="intro-start-button"
        style={styles.primary}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={start}
      >
        <Text style={styles.primaryText}>{t("intro.start")}</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceContainerLow, overflow: "hidden" },
  text: { paddingHorizontal: Spacing.lg, alignItems: "center" },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.7, color: colors.textMain, textAlign: "center" },
  body: { marginTop: 10, fontSize: 16, lineHeight: 24, color: colors.textSubtle, textAlign: "center" },
  strong: { fontWeight: "700", color: colors.textMain },
  artArea: { flex: 1 },
  // The box keeps the mockup's coordinates; it is scaled from its top edge, so
  // the illustration starts right under the text whatever the device width.
  art: { position: "absolute", width: ART_WIDTH, height: ART_HEIGHT, transformOrigin: "top" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 120, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  primary: { minHeight: TouchTarget.comfortable - 4, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onPrimary, fontSize: Typography.body.fontSize, fontWeight: "700" },
});
