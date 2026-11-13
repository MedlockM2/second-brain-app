import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useUserPreferences } from "../contexts/UserPreferencesContext";
import { useAuth } from "../contexts/AuthContext";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { MediaService } from "../services/mediaService";
import { resourceKeys } from "../services/resourceCache";
import { isResourceSuperseded } from "@media-summarizer/core/cache/resourceCache";
import { mediaProcessingLabelKey } from "@media-summarizer/core/media/mediaDisplay";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";
import type { MediaProcessingNotice } from "../components/MediaProcessingState";
import type { MediaStatusResponse } from "@media-summarizer/core/types/media";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000;
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
  /**
   * What the page shows in place of the text while the item is not readable —
   * on its way, overdue, or failed — and `null` once it is (`completed`) or
   * before there is an item to speak of (`loading`, `error`).
   */
  notice: MediaProcessingNotice | null;
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
      // The cache's language, as the subscribed key above: a language passed from
      // the preferences could differ from it, and readResource would supersede
      // the read in silence, leaving the page on its spinner.
      await MediaService.getMediaStatus(mediaId);
    } catch (error) {
      if (isResourceSuperseded(error)) return;
      // The cache publishes the error; cached content stays readable on network failure.
    }
  }, [isAuthenticated, mediaId]);
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
    notice:
      state === "processing"
        ? {
            status: "processing",
            message: t(mediaProcessingLabelKey(mediaData?.media_item.media_type)),
          }
        : state === "timeout"
          ? { status: "timeout", retry: refresh }
          : state === "failed"
            ? {
                status: "failed",
                message: getFriendlyErrorMessage(
                  { code: mediaData?.processing_job.error_code },
                  { fallback: t("media.failedFallback") },
                ),
              }
            : null,
    refresh,
  };
}
