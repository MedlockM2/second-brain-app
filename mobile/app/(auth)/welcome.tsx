import { useState, type ComponentType } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PaginationDots } from "../../src/components/PaginationDots";
import { ART_HEIGHT, ART_WIDTH } from "../../src/components/welcome/artKit";
import { DepthArt, EverywhereArt, FolderArt, ShareArt } from "../../src/components/welcome/WelcomeArt";
import { t, type TranslationKey } from "../../src/i18n";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../src/constants/theme";
import { useThemedStyles } from "../../src/contexts/ThemeContext";

/**
 * The four pages of the carousel, chosen by the owner on 2026-10-23
 * (`mobile-design-mockups/auth_directions/direction_c_finale`): what Deepn does
 * end to end, how content gets in, a whole folder asked at once, and the web.
 */
const SLIDES: { key: string; Art: ComponentType; title: TranslationKey; body: TranslationKey[] }[] = [
  { key: "deep", Art: DepthArt, title: "welcome.deep.title", body: ["welcome.deep.save", "welcome.deep.chat", "welcome.deep.review"] },
  { key: "share", Art: ShareArt, title: "welcome.share.title", body: ["welcome.share.body"] },
  { key: "folder", Art: FolderArt, title: "welcome.folder.title", body: ["welcome.folder.body"] },
  { key: "everywhere", Art: EverywhereArt, title: "welcome.everywhere.title", body: ["welcome.everywhere.body"] },
];

/**
 * The first screen of a signed-out person: a carousel that shows what the app
 * does, and two buttons that stay put whatever the page — « Get started » pushes
 * the sign-up screen, « I already have an account » the sign-in one.
 */
export default function WelcomeScreen() {
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  // The illustration fills the width, but never more than about half the height:
  // on a short phone it shrinks rather than pushing the text under the buttons.
  const scale = Math.min(width / ART_WIDTH, (height * 0.47) / ART_HEIGHT);
  const artHeight = ART_HEIGHT * scale;
  const bandHeight = insets.top + Spacing.sm + artHeight;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View style={styles.container} testID="welcome-screen">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.pages}
        accessibilityLabel={t("welcome.carouselA11y")}
      >
        {SLIDES.map(({ key, Art, title, body }) => (
          <View key={key} style={{ width }}>
            <View style={[styles.band, { height: bandHeight }]}>
              <View style={[styles.artFrame, { top: insets.top + Spacing.sm, height: artHeight }]}
                accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={[styles.art, {
                  left: (width - ART_WIDTH) / 2,
                  top: (artHeight - ART_HEIGHT) / 2,
                  transform: [{ scale }],
                }]}>
                  <Art />
                </View>
              </View>
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, body.length > 1 && styles.titleLong]} accessibilityRole="header">{t(title)}</Text>
              {body.map((paragraph) => (
                <Text key={paragraph} style={[styles.body, body.length > 1 && styles.bodyShort]}>{t(paragraph)}</Text>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.dots, { top: bandHeight + 14 }]} pointerEvents="none">
        <PaginationDots count={SLIDES.length} activeIndex={page} />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity
          testID="welcome-start-button"
          style={styles.primary}
          activeOpacity={0.8}
          accessibilityRole="button"
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={styles.primaryText}>{t("welcome.start")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="welcome-sign-in-button"
          style={styles.secondary}
          accessibilityRole="button"
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.secondaryText}>{t("welcome.haveAccount")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pages: { flex: 1 },
  band: { backgroundColor: colors.surfaceContainerLow, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: "hidden" },
  artFrame: { position: "absolute", left: 0, right: 0 },
  art: { position: "absolute", width: ART_WIDTH, height: ART_HEIGHT },
  dots: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  text: { paddingHorizontal: Spacing.lg, paddingTop: 44, gap: 10 },
  title: { fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -0.7, color: colors.textMain, marginBottom: 2 },
  titleLong: { fontSize: 28, lineHeight: 32 },
  body: { fontSize: 16, lineHeight: 24, color: colors.textSubtle },
  bodyShort: { fontSize: 15, lineHeight: 21 },
  actions: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.xs },
  primary: { minHeight: TouchTarget.comfortable - 4, borderRadius: BorderRadius.full, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onPrimary, fontSize: Typography.body.fontSize, fontWeight: "700" },
  secondary: { minHeight: TouchTarget.comfortable - 4, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.textMain, fontSize: Typography.body.fontSize, fontWeight: "700" },
});
