import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { markedParts } from "@media-summarizer/core/i18n/parts";
import { ScreenHeader, HeaderIconButton } from "../src/components/ScreenHeader";
import { t, type TranslationKey } from "../src/i18n";
import { Spacing, TouchTarget, Typography, type Theme } from "../src/constants/theme";
import { useThemedStyles } from "../src/contexts/ThemeContext";

const STEPS: TranslationKey[] = ["betaFeedback.step1", "betaFeedback.step2", "betaFeedback.step3", "betaFeedback.step4", "betaFeedback.step5"];

/**
 * « Signaler un bug » on an iPhone during the beta (`app/(tabs)/account.tsx`
 * opens it instead of the form when `isBetaAccess`): how to send TestFlight
 * feedback, down to the step TestFlight's own « Share Feedback » screen leaves
 * out — what to touch after the screenshot (TestFlight feedback
 * AHZj_EmKyk_-POh6f05H_SE). Android, the web and a store build keep the form.
 *
 * The words in brackets in the catalogue are iOS's own labels, set in bold. They
 * come from Apple's TestFlight help, not from a device in every language: check
 * them on an iPhone when iOS renames them.
 */
export default function BetaFeedbackScreen() {
  const styles = useThemedStyles(makeStyles);
  const done = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/account"));
  const rich = (key: TranslationKey) => markedParts(t(key)).map((part, index) =>
    <Text key={index} style={part.marked ? styles.label : undefined}>{part.text}</Text>);
  return <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
    <ScreenHeader
      title={t("account.reportBug")}
      leading={<HeaderIconButton icon="chevron-back" onPress={done} accessibilityLabel={t("common.back")} />}
    />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t("betaFeedback.intro")}</Text>
      <PhoneArt />
      <View style={styles.steps}>
        {STEPS.map((key, index) => <View key={key} style={styles.step}>
          <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
          <Text style={styles.stepText}>{rich(key)}</Text>
        </View>)}
      </View>
      <Text style={styles.alt}>{rich("betaFeedback.alt")}</Text>
    </ScrollView>
    <View style={styles.footer}>
      <TouchableOpacity testID="beta-feedback-done-button" style={styles.primary} activeOpacity={0.8} accessibilityRole="button" onPress={done}>
        <Text style={styles.primaryText}>{t("betaFeedback.done")}</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>;
}

/**
 * An iPhone in the app's style, not TestFlight's: the two buttons to press
 * together, pulsing amber, and the screenshot's thumbnail in the bottom-left
 * corner, where iOS puts it, ringed as the thing to touch next.
 */
function PhoneArt() {
  const styles = useThemedStyles(makePhoneStyles);
  return <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.body}>
      <View style={styles.screen}>
        <View style={styles.titleBar} />
        <View style={styles.cover} />
        <View style={[styles.line, { width: "80%" }]} />
        <View style={[styles.line, { width: "64%" }]} />
        <View style={styles.thumbnail} />
        <View style={styles.thumbnailRing} />
      </View>
    </View>
    <View style={[styles.sideKey, { left: 145, top: 48, height: 24 }]} />
    <View style={[styles.sideKey, { left: 145, top: 78, height: 24 }]} />
    <View style={[styles.sideKey, { left: 266, top: 62, height: 36 }]} />
    <View style={[styles.pulse, { left: 134, top: 47 }]} />
    <View style={[styles.pulse, { left: 254, top: 67 }]} />
    <Text numberOfLines={1} style={[styles.keyLabel, styles.keyLabelLeft]}>{t("betaFeedback.volumeUp")}</Text>
    <Text numberOfLines={1} style={[styles.keyLabel, styles.keyLabelRight]}>{t("betaFeedback.sideButton")}</Text>
  </View>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  intro: { ...Typography.body, fontSize: 15, color: colors.textSubtle, marginTop: Spacing.xs },
  steps: { gap: 13, marginTop: 10 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  number: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 13.5, fontWeight: "800", color: colors.onPrimary },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.textMain, paddingTop: 2 },
  label: { fontWeight: "700" },
  alt: { fontSize: 13, lineHeight: 19, color: colors.textSubtle, marginTop: Spacing.md },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  primary: { minHeight: TouchTarget.comfortable - 4, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onPrimary, fontSize: Typography.body.fontSize, fontWeight: "700" },
});

// The illustration's 414 × 206 box, centred, in the mockup's coordinates.
const makePhoneStyles = ({ colors }: Theme) => StyleSheet.create({
  box: { width: 414, height: 206, alignSelf: "center", marginTop: 14 },
  body: { position: "absolute", left: 148, top: 6, width: 118, height: 196, borderRadius: 24, backgroundColor: "#1c1b1a", padding: 5,
    borderWidth: 1.5, borderColor: colors.outlineVariant },
  screen: { flex: 1, borderRadius: 18, backgroundColor: colors.surfaceContainerLow, overflow: "hidden", paddingTop: 20, paddingHorizontal: 10, gap: 6 },
  titleBar: { width: 46, height: 6, borderRadius: 3, backgroundColor: colors.textMain },
  cover: { height: 36, borderRadius: 7, backgroundColor: "#b88a3e" },
  line: { height: 5, borderRadius: 2.5, backgroundColor: colors.surfaceContainerHigh },
  thumbnail: { position: "absolute", left: 8, bottom: 10, width: 34, height: 56, borderRadius: 6, backgroundColor: colors.surface,
    borderWidth: 2, borderColor: "#fff", transform: [{ rotate: "-4deg" }] },
  thumbnailRing: { position: "absolute", left: 9, bottom: 24, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.primary },
  sideKey: { position: "absolute", width: 3, borderRadius: 2, backgroundColor: colors.outline },
  pulse: { position: "absolute", width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255, 203, 5, 0.3)",
    borderWidth: 5, borderColor: "rgba(255, 203, 5, 0.12)" },
  keyLabel: { position: "absolute", fontSize: 11.5, fontWeight: "600", color: colors.textSubtle },
  keyLabelLeft: { right: 414 - 128, top: 52, textAlign: "right" },
  keyLabelRight: { left: 290, top: 72 },
});
