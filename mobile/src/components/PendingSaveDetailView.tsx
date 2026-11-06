/**
 * The media page of an import whose ingestion has not answered yet (task-603).
 *
 * The Home vignette of an import is drawn the moment it leaves (task-568), long
 * before the media exists for a file: the direct PUT to S3 takes five to thirty
 * seconds on a phone. Touching it opens this page on the submission's key. It
 * says the content is on its way, offers nothing that needs a media (no folder,
 * no chat, no share, no delete) and asks the API nothing — the key is not an id.
 *
 * When the ingestion answers, `onCreated` hands the route the real id, which may
 * be an existing media's when the file had already been imported. When it fails,
 * the page says why and offers the way out; `ShareIntentContext` then skips its
 * alert, so the error is said once.
 */

import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MediaType } from "@media-summarizer/core/types/media";
import { MediaDetailHeader } from "./MediaDetailHeader";
import { Spacing, TouchTarget, Typography, type Theme } from "../constants/theme";
import { useThemedStyles } from "../contexts/ThemeContext";
import { t, useTranslation } from "../i18n";
import { usePendingSaveOutcome, watchPendingSave } from "../lib/pendingSaves";

/** The types whose first step is a file sent to S3, as `pendingSaveFor` labels them. */
const FILE_TYPES: ReadonlySet<MediaType> = new Set(["document", "audio", "audio_file"]);

export function PendingSaveDetailView({
  saveKey,
  onBack,
  onCreated,
}: {
  saveKey: string;
  onBack: () => void;
  onCreated: (mediaItemId: string) => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  useTranslation();
  const outcome = usePendingSaveOutcome(saveKey);

  useEffect(() => watchPendingSave(saveKey), [saveKey]);

  const createdId = outcome?.state === "created" ? outcome.mediaItemId : null;
  useEffect(() => {
    if (createdId) onCreated(createdId);
  }, [createdId, onCreated]);

  const failure =
    outcome === null
      ? t("media.sending.lost")
      : outcome.state === "failed"
        ? outcome.message || t("media.failedFallback")
        : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <MediaDetailHeader onBack={onBack} />
      <View style={styles.centered} accessibilityLiveRegion="polite">
        {failure ? (
          <>
            <Text style={styles.text}>{failure}</Text>
            <Pressable
              onPress={onBack}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={t("common.goBack")}
            >
              <Text style={styles.actionLabel}>{t("common.back")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator />
            <Text style={styles.text}>
              {outcome?.state === "sending" && FILE_TYPES.has(outcome.mediaType)
                ? t("media.sending.file")
                : t("media.sending.other")}
            </Text>
            <Text style={styles.hint}>{t("media.sending.hint")}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: Spacing.md,
      padding: Spacing.lg,
    },
    text: { ...Typography.body, color: colors.textMain, textAlign: "center" },
    hint: { ...Typography.small, color: colors.textMuted, textAlign: "center" },
    action: {
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
    },
    actionLabel: { ...Typography.label, color: colors.textMain },
  });
