import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { startHomeSectionSpan } from "../lib/crashReporting";
import { subscribeToMediaSaves } from "../lib/mediaSaveNotice";
import { MediaService } from "../services/mediaService";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";
import type { MediaListItem } from "../types/media";

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

  const [backendItems, setBackendItems] = useState<MediaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  /**
   * Whether this source has answered once since mount, read by `fetchMedia` to
   * decide whether the round it is starting is still part of the Home's first
   * paint — the only one worth a span. A ref and not state: `fetchMedia` is a
   * `useCallback` keyed on the session alone, so a state read from its body would
   * be the one captured by the render that built it — still `false` on every later
   * round, and every refresh would earn a span it is not entitled to.
   */
  const settledRef = useRef(false);

  /**
   * Fetch media list from the backend (one-shot).
   */
  const fetchMedia = useCallback(async () => {
    if (!isAuthenticated) return;

    // "Recently added" is the third block of the task-417 waterfall, and the one
    // the other two are compared against: it is also what gates the screen's only
    // spinner, so its span is the length of the blank screen.
    const span = settledRef.current
      ? null
      : startHomeSectionSpan("recently_added");
    try {
      const response = await MediaService.listMedia();
      if (isMountedRef.current) {
        setBackendItems(response.items);
        setError(null);
        settledRef.current = true;
      }
      span?.end("ok");
    } catch (err) {
      if (isMountedRef.current) {
        const message = getFriendlyErrorMessage(err, {
          fallback: t("home.loadFailed"),
        });
        setError(message);
        settledRef.current = true;
      }
      span?.end("error");
    }
  }, [isAuthenticated]);

  /**
   * The pull-to-refresh gesture, and only it: the one entry that shows a spinner.
   *
   * Always a real request — it goes straight to `fetchMedia` with nothing in
   * between. Pulling down is how the user asks again, including one second after an
   * answer landed, so nothing here may decide the round is redundant.
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

  // A save created after this list was read. It happens on every share that
  // arrived on a signed-out session: the ingestion starts once the user has
  // signed in, which is after this screen mounted and read itself, and the
  // confirmation modal closes on either answer without waiting for it. This
  // re-read is what puts the vignette on screen at all — `useProcessingRefresh`
  // then takes over and settles it.
  useEffect(() => {
    return subscribeToMediaSaves(() => {
      void fetchMedia();
    });
  }, [fetchMedia]);

  // Mount lifetime and nothing else — what the commits above test before touching
  // state. Its own effect, with no dependency: it used to share one with the
  // initial fetch, so a session change flipped it to false and back while the
  // screen had gone nowhere.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * The list's one automatic read, and the whole of what a cold open costs: a tab
   * gains focus as it mounts, so this covers the open as well as every return to
   * the tab. No mount effect beside it — see the note at the top of this file.
   *
   * `fetchMedia` and not `refresh`: a focus re-read must leave the rows where they
   * are, and the `RefreshControl` spinner belongs to the gesture. Ending
   * `isLoading` here is what takes the screen's one spinner down, so the first
   * answer — success or failure — is what the blank screen lasts.
   */
  useFocusEffect(
    useCallback(() => {
      void fetchMedia().finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
    }, [fetchMedia]),
  );

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
