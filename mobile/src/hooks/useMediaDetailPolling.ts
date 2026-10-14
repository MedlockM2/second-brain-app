import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useUserPreferences } from "../contexts/UserPreferencesContext";
import { useAuth } from "../contexts/AuthContext";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { MediaService } from "../services/mediaService";
import { resourceKeys } from "../services/resourceCache";
import { isResourceSuperseded } from "@media-summarizer/core/cache/resourceCache";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";
import type {
  MediaStatusResponse,
  SourcePlatform,
} from "@media-summarizer/core/types/media";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000;
function getProcessingMessage(source?: SourcePlatform): string {
  switch (source) {
    case "spotify":
    case "apple_podcasts":
    case "deezer":
    case "rss":
    case "podcast_index":
      return t("media.processing.audio");
    case "youtube":
      return t("media.processing.video");
    case "instagram":
    case "tiktok":
    case "x":
      return t("media.processing.extracting");
    default:
      return t("media.processing.generating");
  }
}
export type MediaDetailPollingState =
  | "loading"
  | "processing"
  | "completed"
  | "failed"
  | "timeout"
  | "error";
export interface UseMediaDetailPollingResult {
  state: MediaDetailPollingState;
  mediaData: MediaStatusResponse | null;
  fetchError: string | null;
  processingError: string | null;
  processingMessage: string;
  timedOut: boolean;
  refresh: () => Promise<void>;
}
export function useMediaDetailPolling(
  mediaId: string | undefined,
): UseMediaDetailPollingResult {
  const { isAuthenticated } = useAuth();
  const { readingLanguage } = useUserPreferences();
  const snapshot = useResourceSnapshot<MediaStatusResponse>(
    resourceKeys.media(mediaId ?? ""),
  );
  const [timeoutFor, setTimeoutFor] = useState<string | null>(null);
  const startedAt = useRef(0);
  const processingKey = `${mediaId ?? ""}:${readingLanguage ?? ""}`;
  const budgetKey = useRef<string | null>(null);
  const mediaData = snapshot.data ?? null;
  const jobStatus = mediaData?.processing_job.status;
  const baseState: MediaDetailPollingState = !mediaData
    ? snapshot.error
      ? "error"
      : "loading"
    : jobStatus === "completed" || jobStatus === "ready_for_artifacts"
      ? "completed"
      : jobStatus === "failed" || jobStatus === "cancelled"
        ? "failed"
        : "processing";
  const timedOut = timeoutFor === mediaId;
  const state = baseState === "processing" && timedOut ? "timeout" : baseState;
  const fetchMediaStatus = useCallback(async () => {
    if (!isAuthenticated || !mediaId) return;
    try {
      await MediaService.getMediaStatus(mediaId, readingLanguage);
    } catch (error) {
      if (isResourceSuperseded(error)) return;
      // The cache publishes the error; cached content stays readable on network failure.
    }
  }, [isAuthenticated, mediaId, readingLanguage]);
  useFocusEffect(
    useCallback(() => {
      if (budgetKey.current !== processingKey) {
        budgetKey.current = processingKey;
        startedAt.current = Date.now();
        setTimeoutFor(null);
      }
      void fetchMediaStatus();
    }, [fetchMediaStatus, processingKey]),
  );
  useEffect(() => {
    if (!isAuthenticated || state !== "processing" || !mediaId) return;
    if (!startedAt.current) startedAt.current = Date.now();
    const remaining = Math.max(
      0,
      TIMEOUT_MS - (Date.now() - startedAt.current),
    );
    const timeout = setTimeout(() => setTimeoutFor(mediaId), remaining);
    const poll = setInterval(() => void fetchMediaStatus(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [isAuthenticated, mediaId, state, fetchMediaStatus]);
  const refresh = useCallback(async () => {
    startedAt.current = Date.now();
    setTimeoutFor(null);
    await fetchMediaStatus();
  }, [fetchMediaStatus]);
  return {
    state,
    mediaData,
    timedOut,
    fetchError: snapshot.error
      ? getFriendlyErrorMessage(snapshot.error, {
          fallback: t("media.loadFailed"),
        })
      : null,
    processingError:
      state === "failed"
        ? getFriendlyErrorMessage(
            { code: mediaData?.processing_job.error_code },
            { fallback: t("media.failedFallback") },
          )
        : null,
    processingMessage: getProcessingMessage(
      mediaData?.media_item.source_platform,
    ),
    refresh,
  };
}
