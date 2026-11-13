import { useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMediaDetailPolling } from "../../src/hooks/useMediaDetailPolling";
import { CompletedDetailView } from "../../src/components/CompletedDetailView";
import { MediaDetailHeader } from "../../src/components/MediaDetailHeader";
import { Spacing, TouchTarget, type Theme } from "../../src/constants/theme";
import { useThemedStyles } from "../../src/contexts/ThemeContext";
import { t, useTranslation } from "../../src/i18n";
import { PendingSaveDetailView } from "../../src/components/PendingSaveDetailView";
import { isPendingSaveKey } from "../../src/lib/pendingSaves";

/**
 * The media route. Its id is either a media id or, opened from the vignette of
 * an import still on its way (task-603), the key of that submission: the page
 * then waits for the ingestion and takes the real id in place, with no new
 * screen pushed and nothing to go back through.
 */
export default function MediaDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const onCreated = useCallback(
    (mediaItemId: string) => router.setParams({ id: mediaItemId }),
    [router],
  );
  if (isPendingSaveKey(id)) {
    return <PendingSaveDetailView key={id} saveKey={id} onBack={() => router.back()} onCreated={onCreated} />;
  }
  return <MediaDetailScreen key={id} />;
}

/** A stable page from its first metadata snapshot through extraction and reading. */
function MediaDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  useTranslation();
  // `passage`: the excerpt of the search hit this page was opened from, if any.
  const { id, passage, conversationId } = useLocalSearchParams<{ id: string; passage?: string; conversationId?: string }>();
  const router = useRouter();
  const { state, mediaData, fetchError, notice, refresh } = useMediaDetailPolling(id);
  if (mediaData) {
    return <CompletedDetailView key={id} mediaData={mediaData} passage={passage}
      conversationId={conversationId} onConversationOpened={() => router.setParams({ conversationId: undefined })}
      onBack={() => router.back()} onDeleted={() => router.back()}
      processingNotice={notice} />;
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
