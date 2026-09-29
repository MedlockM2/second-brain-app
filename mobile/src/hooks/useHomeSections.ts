import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { startHomeSectionSpan } from "../lib/crashReporting";
import { subscribeToMediaSaves } from "../lib/mediaSaveNotice";
import { EngagementService } from "../services/engagementService";
import { OrganizationService } from "../services/organizationService";
import type { RecentEngagement } from "../types/engagements";

/**
 * The two data sources the Home screen owns beyond its media list.
 *
 * The point of the hook is *independence*, and until task-417 it only half held:
 * one `Promise.allSettled` awaited both calls before either `setState`, so both
 * sections were cadenced by the slower endpoint and appeared together, long after
 * the media list. Each call now commits on its own resolution — the failure
 * isolation the hook was written for is unchanged (a folders endpoint that 500s
 * must not take the engagement row down with it, nor blank the media list
 * `useMediaList` fetches separately), only the shared await is gone.
 *
 * **Each source does expose whether its first answer has landed**, which is the
 * one thing this hook used to refuse. A section that is absent and then present
 * displaces whatever sits below it, and the unsorted card sits *above* both rows,
 * so an arrival was moving content the user had already started reading. The flags
 * are what lets the screen hold the space until the answer is in. They latch on
 * the first resolution and never go back: a later refresh, whatever it costs,
 * happens under the content already on screen. After that first answer an empty
 * section is absent exactly as before — a new account has nothing to continue, and
 * no placeholder should imply otherwise.
 *
 * The unsorted figure is fetched as a figure (`getUnsortedCount`), not extracted
 * from a listing of every folder: see that method for why the two are different
 * reads on the server.
 */
export interface UseHomeSectionsResult {
  /** "Continue learning", in the order the server returned. Empty hides it. */
  continueLearning: RecentEngagement[];
  /** Whether `GET /api/engagements/recent` has answered once since mount. */
  hasLoadedContinueLearning: boolean;
  /** How many items wait in the default folder — the unsorted card's figure. */
  unsortedCount: number;
  /** Whether `GET /api/folders/unsorted-count` has answered once since mount. */
  hasLoadedUnsortedCount: boolean;
  /** Refetch both. Never rejects. */
  refresh: () => Promise<void>;
}

/** Server-side cap of the engagement row; asking for more would be ignored. */
const CONTINUE_LEARNING_LIMIT = 12;

export function useHomeSections(): UseHomeSectionsResult {
  const { isAuthenticated } = useAuth();

  const [continueLearning, setContinueLearning] = useState<RecentEngagement[]>(
    [],
  );
  const [hasLoadedContinueLearning, setHasLoadedContinueLearning] =
    useState(false);
  const [unsortedCount, setUnsortedCount] = useState(0);
  const [hasLoadedUnsortedCount, setHasLoadedUnsortedCount] = useState(false);

  const isMountedRef = useRef(true);
  // Read by the fetchers to decide whether this round is still part of the first
  // paint, which is what earns a span. A ref and not the state above: the state
  // a closure captured is the state of its render, and the second fetch of an
  // open is fired from the same render as the first.
  const engagementSettledRef = useRef(false);
  const unsortedSettledRef = useRef(false);

  const refreshContinueLearning = useCallback(async () => {
    if (!isAuthenticated) return;
    // Opened before the request and closed on the commit, so the span measures
    // what the screen waited for and not just what the network took. Only while
    // the first answer is still missing: a refresh lands under content that is
    // already readable and has nothing to do with opening the screen.
    const span = engagementSettledRef.current
      ? null
      : startHomeSectionSpan("continue_learning");
    try {
      const recent = await EngagementService.listRecent(CONTINUE_LEARNING_LIMIT);
      if (isMountedRef.current) {
        setContinueLearning(recent);
        setHasLoadedContinueLearning(true);
        engagementSettledRef.current = true;
      }
      // Ended whether or not the screen is still mounted: an open span holds the
      // navigation transaction open until Sentry's own final timeout, and a tab
      // left before its answer arrived is a fact worth having in the waterfall.
      span?.end("ok");
    } catch {
      // Swallowed, and deliberately not rethrown: this must not reach the other
      // source, `useMediaList`, or the `Promise.all` the pull-to-refresh gesture
      // awaits. A failure keeps the previous value rather than clearing it — a
      // refresh that fails leaves the screen as the user last saw it.
      //
      // The flag is set anyway: it means "this source has answered once", and a
      // failure is an answer. Holding the space open after a 500 would reserve it
      // for content that is not coming.
      if (isMountedRef.current) {
        setHasLoadedContinueLearning(true);
        engagementSettledRef.current = true;
      }
      span?.end("error");
    }
  }, [isAuthenticated]);

  const refreshUnsortedCount = useCallback(async () => {
    if (!isAuthenticated) return;
    const span = unsortedSettledRef.current
      ? null
      : startHomeSectionSpan("unsorted_count");
    try {
      const count = await OrganizationService.getUnsortedCount();
      if (isMountedRef.current) {
        setUnsortedCount(count);
        setHasLoadedUnsortedCount(true);
        unsortedSettledRef.current = true;
      }
      span?.end("ok");
    } catch {
      if (isMountedRef.current) {
        setHasLoadedUnsortedCount(true);
        unsortedSettledRef.current = true;
      }
      span?.end("error");
    }
  }, [isAuthenticated]);

  /**
   * Both, issued together and committed apart. `Promise.all` over two calls that
   * each resolve to nothing and never reject: it is here so the caller can await
   * "both are done" for its pull-to-refresh spinner, and it is no longer a gate on
   * either `setState`.
   */
  const refresh = useCallback(async () => {
    await Promise.all([refreshContinueLearning(), refreshUnsortedCount()]);
  }, [refreshContinueLearning, refreshUnsortedCount]);

  // A save landing behind the screen moves the unsorted figure this hook feeds,
  // for the same reason it moves the media list next to it: the save exists after
  // the Home screen read itself. See `mediaSaveNotice`.
  useEffect(() => {
    return subscribeToMediaSaves(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    isMountedRef.current = true;

    // Deferred by a tick rather than called in the effect body, the same shape
    // `useMediaList` uses: a `setState` reached synchronously from an effect
    // cascades a render, and the lint rule that says so is on.
    let initialFetchTimer: ReturnType<typeof setTimeout> | null = null;
    if (isAuthenticated) {
      initialFetchTimer = setTimeout(() => {
        void refresh();
      }, 0);
    }

    return () => {
      if (initialFetchTimer) clearTimeout(initialFetchTimer);
      isMountedRef.current = false;
    };
  }, [isAuthenticated, refresh]);

  return {
    continueLearning,
    hasLoadedContinueLearning,
    unsortedCount,
    hasLoadedUnsortedCount,
    refresh,
  };
}
