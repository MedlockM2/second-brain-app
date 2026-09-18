import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { MediaService } from "../services/mediaService";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";
import type { MediaListItem } from "../types/media";

export interface UseMediaListResult {
  /** Backend media items */
  items: MediaListItem[];
  /** Whether the initial fetch is in progress */
  isLoading: boolean;
  /** Whether a pull-to-refresh is in progress (drives RefreshControl) */
  isRefreshing: boolean;
  /** User-friendly error message, or null */
  error: string | null;
  /** Pull-to-refresh handler — flips isRefreshing to drive the visible spinner */
  refresh: () => Promise<void>;
  /**
   * Silent re-read of the list — does **not** toggle `isRefreshing`, so nothing
   * on screen moves. Used on focus and by every tick of `useProcessingRefresh`,
   * which is what lets a vignette settle from "on its way" to "ready" while the
   * user is looking at it.
   */
  refetch: () => Promise<void>;
  /** Retry after an error */
  retry: () => void;
}

/**
 * The account's media list: fetched on mount, re-read on demand.
 *
 * Nothing recurring lives here. *When* the list is worth re-reading is a question
 * about what is on it and which screen is showing it, which is
 * `useProcessingRefresh`'s job — it calls `refetch` on a bounded schedule for as
 * long as a visible vignette is still being processed, and stops. This hook only
 * has to make that re-read silent, which `refetch` is.
 */
export function useMediaList(): UseMediaListResult {
  const { isAuthenticated } = useAuth();

  const [backendItems, setBackendItems] = useState<MediaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  /**
   * Fetch media list from the backend (one-shot).
   */
  const fetchMedia = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await MediaService.listMedia();
      if (isMountedRef.current) {
        setBackendItems(response.items);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = getFriendlyErrorMessage(err, {
          fallback: t("home.loadFailed"),
        });
        setError(message);
      }
    }
  }, [isAuthenticated]);

  /**
   * Public refresh function (pull-to-refresh / focus refetch).
   */
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMedia();
    if (isMountedRef.current) {
      setIsRefreshing(false);
    }
  }, [fetchMedia]);

  /**
   * Retry after an error.
   */
  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchMedia().finally(() => {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    });
  }, [fetchMedia]);

  // Initial fetch on mount
  useEffect(() => {
    isMountedRef.current = true;

    let initialFetchTimer: ReturnType<typeof setTimeout> | null = null;
    if (isAuthenticated) {
      initialFetchTimer = setTimeout(() => {
        void fetchMedia().finally(() => {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        });
      }, 0);
    }

    return () => {
      if (initialFetchTimer) clearTimeout(initialFetchTimer);
      isMountedRef.current = false;
    };
  }, [isAuthenticated, fetchMedia]);

  return {
    items: backendItems,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch: fetchMedia,
    retry,
  };
}
