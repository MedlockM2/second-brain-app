import { useCallback, useState } from "react";
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { PaginationDots } from "../../src/components/PaginationDots";
import { SlotText } from "../../src/components/SlotText";
import { ART_HEIGHT, ART_WIDTH, Glow } from "../../src/components/intro/artKit";
import { EverywhereArt, SHARE_ICON, ShareSheetArt, WorksWith } from "../../src/components/intro/IntroArt";
import { markIntroSeen } from "../../src/lib/introState";
import { t } from "../../src/i18n";
import { Spacing, TouchTarget, Typography, type Theme } from "../../src/constants/theme";
import { useThemeColors, useThemedStyles } from "../../src/contexts/ThemeContext";

const PAGE_COUNT = 2;

/**
 * The intro shown once, after the first sign-in of a first install
 * (`src/lib/introState.ts`): how to save from another app, then « on your phone
 * and your computer » (TestFlight feedback AHZj_EmKyk_-POh6f05H_SE; mockup
 * `mobile-design-mockups/onboarding_apres_connexion`).
 *
 * Readwise-style frame, the owner's choice: the text centred at the top, the
 * illustration below it in the same background, running off the bottom of the
 * screen and fading out under the button; « Suivant », then the dots under it.
 * « Suivant » is the only way forward — no swipe (a page state, not a pager), no
 * way back (`gestureEnabled: false` in `app/_layout.tsx`, Android's back button
 * swallowed here), no « Passer ».
 * « C'est parti » on the last page settles the intro and opens the inbox.
 */
export default function IntroScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const isShare = page === 0;
  // The illustrations are drawn on the mockup's 414-point width; the laptop of
  // page 2 is drawn a little larger so it reaches down to the button.
  const scale = (width / ART_WIDTH) * (isShare ? 1 : 1.12);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []));

  const next = () => {
    if (page < PAGE_COUNT - 1) {
      setPage(page + 1);
      return;
    }
    markIntroSeen();
    router.replace("/(tabs)/inbox");
  };

  // The fade under the button: the screen's own colour, from transparent to opaque.
  const fade = `linear-gradient(to bottom, ${colors.surfaceContainerLow}00 0%, ${colors.surfaceContainerLow} 46%)`;

  return <View style={styles.container} testID="intro-screen">
    <View style={[styles.text, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.title} accessibilityRole="header">{t(isShare ? "intro.share.title" : "intro.everywhere.title")}</Text>
      {isShare
        ? <SlotText style={styles.body} template={t(Platform.OS === "android" ? "intro.share.bodyAndroid" : "intro.share.bodyIos")} slots={{
            share: <Ionicons key="share" name={SHARE_ICON} size={17} color={colors.textMain} />,
            app: <Text key="app" style={styles.strong}>Deepn</Text>,
          }} />
        : <Text style={styles.body}>{t("intro.everywhere.body")}</Text>}
      {isShare && <WorksWith />}
    </View>
    <View style={styles.artArea} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.art, { top: isShare ? 20 : 44, left: (width - ART_WIDTH) / 2, transform: [{ scale }] }]}>
        <Glow top={isShare ? 20 : 40} height={420} />
        {isShare ? <ShareSheetArt /> : <EverywhereArt />}
      </View>
    </View>
    <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm, experimental_backgroundImage: fade }]}>
      <TouchableOpacity
        testID={isShare ? "intro-next-button" : "intro-start-button"}
        style={styles.primary}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={next}
      >
        <Text style={styles.primaryText}>{t(isShare ? "intro.next" : "intro.start")}</Text>
      </TouchableOpacity>
      <PaginationDots count={PAGE_COUNT} activeIndex={page} />
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
