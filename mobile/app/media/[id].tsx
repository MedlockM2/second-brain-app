import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMediaDetailPolling } from "../../src/hooks/useMediaDetailPolling";
import { CompletedDetailView } from "../../src/components/CompletedDetailView";
import { MediaDetailHeader } from "../../src/components/MediaDetailHeader";
import { Spacing, TouchTarget, type Theme } from "../../src/constants/theme";
import { useThemedStyles } from "../../src/contexts/ThemeContext";
import { t, useTranslation } from "../../src/i18n";

/** A stable page from its first metadata snapshot through extraction and reading. */
export default function MediaDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  useTranslation();
  // `passage`: the excerpt of the search hit this page was opened from, if any.
  const { id, passage } = useLocalSearchParams<{ id: string; passage?: string }>();
  const router = useRouter();
  const { state, mediaData, fetchError, processingError, processingMessage, refresh } = useMediaDetailPolling(id);
  if (mediaData) {
    return <CompletedDetailView key={id} mediaData={mediaData} passage={passage}
      onBack={() => router.back()} onDeleted={() => router.back()}
      processingNotice={state === "completed" ? undefined : {
        message: state === "failed" ? (processingError ?? t("media.failedFallback"))
          : state === "timeout" ? t("media.timeoutHint") : processingMessage,
        failed: state === "failed", retry: refresh,
      }} />;
  }
  return <SafeAreaView style={styles.container} edges={["top"]}>
    <MediaDetailHeader onBack={() => router.back()} />
    <View style={styles.centered}>
      {state === "loading" ? <ActivityIndicator /> : <>
        <Text style={styles.text}>{fetchError ?? t("media.loadFailed")}</Text>
        <Pressable onPress={refresh} style={styles.retry} accessibilityRole="button">
          <Text style={styles.text}>{t("common.retry")}</Text>
        </Pressable>
      </>}
    </View>
  </SafeAreaView>;
}
const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  text: { color: colors.textMain },
  retry: { minHeight: TouchTarget.minimum, justifyContent: "center", paddingHorizontal: Spacing.lg },
});
