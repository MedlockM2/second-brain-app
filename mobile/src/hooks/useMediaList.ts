import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { startHomeSectionSpan } from "../lib/crashReporting";
import { subscribeToMediaSaves } from "../lib/mediaSaveNotice";
import { MediaService } from "../services/mediaService";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { resourceKeys } from "../services/resourceCache";
import type { ListMediaResponse, MediaListItem } from "@media-summarizer/core/types/media";

export interface UseMediaListResult {
  /** Backend media items */
  items: MediaListItem[];
  /** Whether the first read has yet to answer */
  isLoading: boolean;
  /** Whether a pull-to-refresh is in progress (drives RefreshControl) */
  isRefreshing: boolean;
  /** User-friendly error message, or null */
  error: string | null;
  /**
   * Pull-to-refresh handler — flips isRefreshing to drive the visible spinner, and
   * always issues a real request, however recently the last one answered.
   */
  refresh: () => Promise<void>;
  /**
   * Silent re-read of the list — does **not** toggle `isRefreshing`, so nothing
   * on screen moves. What the hook's own focus read runs, and what every tick of
   * `useProcessingRefresh` calls, which is what lets a vignette settle from "on its
   * way" to "ready" while the user is looking at it.
   */
  refetch: () => Promise<void>;
  /** Retry after an error */
  retry: () => void;
}

/**
 * The account's media list: read once every time the screen holding it gains
 * focus, and re-read on demand.
 *
 * **One request per open.** The automatic read hangs on `useFocusEffect` and
 * nowhere else. A mount effect used to sit beside it, and since a tab gains focus
 * *as* it mounts, the two fired in the same tick: a cold open issued
 * `GET /api/media` twice, for one list (task-421). The focus path alone covers
 * both occasions that matter — the open, and the return to the tab, which is the
 * multi-device sync the effect exists for — so it is the only one left. Nothing
 * here is deduplicated by a delay or a guard; there is simply one caller.
 *
 * Nothing recurring lives here. *When* the list is worth re-reading is a question
 * about what is on it and which screen is showing it, which is
 * `useProcessingRefresh`'s job — it calls `refetch` on a bounded schedule for as
 * long as a visible vignette is still being processed, and stops. This hook only
 * has to make that re-read silent, which `refetch` is.
 *
 * The one thing it does listen to is a save being created (`mediaSaveNotice`),
 * because that is the one fact no schedule can infer: a list already read cannot
 * poll for a media it has never seen. Still not a policy — one notice, one silent
 * re-read.
 */
export function useMediaList(): UseMediaListResult {
  const { isAuthenticated } = useAuth();
  const snapshot = useResourceSnapshot<ListMediaResponse>(resourceKeys.mediaPage());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const settled = useRef(snapshot.data !== undefined);
  const fetchMedia = useCallback(async () => {
    if (!isAuthenticated) return;
    const span = settled.current ? null : startHomeSectionSpan("recently_added");
    try { await MediaService.listMedia(); span?.end("ok"); }
    catch { span?.end("error"); }
    finally { settled.current = true; }
  }, [isAuthenticated]);
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await fetchMedia(); } finally { setIsRefreshing(false); }
  }, [fetchMedia]);
  useFocusEffect(useCallback(() => { void fetchMedia(); }, [fetchMedia]));
  useEffect(() => subscribeToMediaSaves(() => { void fetchMedia(); }), [fetchMedia]);
  return {
    items: snapshot.data?.items ?? [],
    isLoading: snapshot.data === undefined && !snapshot.error,
    isRefreshing,
    error: snapshot.error ? getFriendlyErrorMessage(snapshot.error, { fallback: t("home.loadFailed") }) : null,
    refresh,
    refetch: fetchMedia,
    retry: () => void fetchMedia(),
  };
}
