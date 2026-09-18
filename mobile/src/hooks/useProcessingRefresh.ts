/**
 * What makes a list re-read itself while something on it is still being
 * processed, and stop as soon as nothing is — the client half of the task-404
 * decision (livrables B and C, and the foreground half of D).
 *
 * A tester reported the bug this exists for: a media shared from another app kept
 * its loading marker on the Home screen until they opened it and came back. The
 * screens that show a media *detail* have had a bounded poll since the beginning
 * (`useMediaDetailPolling`, the artifact poll of a folder page); the two screens
 * that show a *list* of media had none, so a vignette could only learn that its
 * media was ready from a gesture.
 *
 * **Four things arm it, one schedule runs.**
 *
 * 1. **The content of the list**, rather than a flag of its own: as long as one
 *    visible vignette carries a non-terminal status, the list is re-read every 3 s
 *    for the first minute and every 10 s after that, up to a total budget of
 *    5 minutes. Measured on `processing_jobs-dev`, 94,3 % of processings finish
 *    under 60 s and the worst case outside a provider incident is 100,6 s, so the
 *    fast phase covers the normal case and the budget covers it three times over.
 * 2. **The screen becoming visible.** Everything lives inside a `useFocusEffect`,
 *    so a screen the user is not looking at polls nothing and re-arms when they
 *    come back to it.
 * 3. **A return to the foreground**, which also disarms on the way out.
 *    `useFocusEffect` blurs nothing when the app is backgrounded and does *not*
 *    re-run when it comes back while the tab is already focused, which is why
 *    backgrounding the app on a fresh save and coming back five minutes later used
 *    to show a vignette still sweeping. `nextState === "active"` on the `change`
 *    event is the only portable condition — `inactive` is iOS-only and `focus` /
 *    `blur` are Android-only — and it is what the four other `AppState` listeners
 *    of this app already test.
 * 4. **The pull-to-refresh gesture**, through `rearm`. Together with the two above
 *    these are the three ways a spent budget is granted another one (task-404
 *    §7.4).
 *
 * And one thing refreshes without arming anything: **a "media ready" notification
 * landing while the app is open**. Its banner is suppressed in the foreground
 * (`pushNotificationService`), so the silent re-read it triggers here *is* its
 * foreground behaviour — the user sees the vignette settle rather than a
 * notification about a screen they are looking at.
 *
 * **It stops.** Apple's energy guide condemns the timer nobody invalidates, and
 * names the three ways out in the same breath: a suitable timeout, an
 * invalidation when the timer is no longer needed, and no timer on a screen that
 * is not visible. All three hold here.
 *
 * **When the budget runs out** the caller is told, through `isStalled`, and draws
 * a still marker instead of an animated one (task-404 §7.4): a processing that
 * outlives 5 minutes is not a failure, so nothing says it is, but nor is it
 * finished, so the vignette must not look ready. The budget counts *attempts*,
 * not successes — an offline device therefore reaches the end of it and settles
 * on that still marker instead of sweeping for ever.
 *
 * The schedule is held in refs and started by a plain function rather than driven
 * by a state the effects depend on. That is what lets every one of the four
 * triggers grant a **whole** budget: a re-arming that went through a dependency
 * would have to carry the previous budget's origin, and a list that had been on
 * screen four minutes would give a media that has just arrived one minute.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { MEDIA_READY_NOTIFICATION_TYPE } from "../services/pushNotificationService";

/** The tick of the first minute. Same interval as every other poll in the app. */
const FAST_INTERVAL_MS = 3000;
/** The tick past the first minute, where a 3 s answer buys almost nothing. */
const SLOW_INTERVAL_MS = 10000;
/** How long the fast phase lasts — the window 94,3 % of processings finish in. */
const FAST_PHASE_MS = 60 * 1000;
/** The whole budget of one arming, after which `isStalled` takes over. */
const BUDGET_MS = 5 * 60 * 1000;

export interface UseProcessingRefreshOptions {
  /**
   * Whether at least one **visible** vignette carries a non-terminal status.
   * Read off the rows the screen actually draws, so a poll is never armed for a
   * media the user cannot see.
   */
  hasProcessing: boolean;
  /**
   * The silent re-read of the list — never the one that drives a visible spinner:
   * a tick must leave the rows already on screen exactly where they are.
   */
  refetch: () => void | Promise<void>;
}

export interface UseProcessingRefreshResult {
  /**
   * The budget of the current arming is spent and something is still on its way.
   * The caller draws its processing marker without movement.
   */
  isStalled: boolean;
  /**
   * Start a fresh budget, if this screen is visible and still has something on
   * its way. Called from the pull-to-refresh handler; the other three triggers
   * are handled here.
   */
  rearm: () => void;
}

export function useProcessingRefresh({
  hasProcessing,
  refetch,
}: UseProcessingRefreshOptions): UseProcessingRefreshResult {
  const [isStalled, setIsStalled] = useState(false);

  /** The pending tick, if the schedule is running. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the running budget started. Only meaningful while a tick is pending. */
  const budgetStartedAtRef = useRef(0);

  /**
   * The two conditions arming reads. Refs rather than values closed over, because
   * `arm` is called from listeners registered once for the life of the screen and
   * must see the current answer, not the one from the render that registered them.
   */
  const hasProcessingRef = useRef(hasProcessing);
  const refetchRef = useRef(refetch);
  /**
   * Whether this screen is the one on screen. Both out-of-band triggers read it
   * because both fire for every mounted screen: a tab navigator keeps the screens
   * the user visited alive, and backgrounding the app blurs none of them.
   */
  const isFocusedRef = useRef(false);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    stop();
    // Nothing to watch, or nobody watching. Both are the normal end of a sweep:
    // the list settled, or the user moved on.
    if (!isFocusedRef.current || !hasProcessingRef.current) return;

    budgetStartedAtRef.current = Date.now();
    setIsStalled(false);

    const schedule = () => {
      const elapsed = Date.now() - budgetStartedAtRef.current;
      if (elapsed >= BUDGET_MS) {
        // Out of budget with something still on its way. The marker stays, the
        // movement stops, and one of the four triggers can grant another budget.
        timerRef.current = null;
        setIsStalled(true);
        return;
      }
      timerRef.current = setTimeout(
        tick,
        elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS,
      );
    };

    const tick = () => {
      // Deliberately not awaited and deliberately not guarded: each tick is an
      // independent request, a failure changes nothing on screen — the vignette
      // still says "on its way", which is true — and the next tick retries.
      void refetchRef.current();
      schedule();
    };

    schedule();
  }, [stop]);

  // Armed by what the list holds, and disarmed the moment it holds nothing
  // non-terminal — which is the tick right after the server finished.
  useEffect(() => {
    hasProcessingRef.current = hasProcessing;
    if (!hasProcessing) {
      stop();
      return;
    }
    // Out of band by one turn rather than inline, because `arm` reaches a
    // `setState` and `react-hooks/set-state-in-effect` refuses that from an
    // effect body.
    const timer = setTimeout(arm, 0);
    return () => clearTimeout(timer);
  }, [hasProcessing, arm, stop]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      const timer = setTimeout(arm, 0);
      return () => {
        isFocusedRef.current = false;
        clearTimeout(timer);
        stop();
      };
    }, [arm, stop]),
  );

  // Leaving the foreground disarms; coming back reads the list at once and arms a
  // fresh budget for whatever it turns out to still be carrying. `useFocusEffect`
  // does neither: it blurs no screen when the app is backgrounded, which is
  // exactly how a vignette came back sweeping five minutes later.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (!isFocusedRef.current) return;
      if (nextState !== "active") {
        stop();
        return;
      }
      void refetchRef.current();
      arm();
    });
    return () => subscription.remove();
  }, [arm, stop]);

  // A "media ready" notification arriving while the app is open. No banner is
  // shown for it, so this refetch is the whole of what the user perceives. No
  // re-arm: the schedule is either running, or spent on a media this notification
  // says nothing about.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (!isFocusedRef.current) return;
        const { data } = notification.request.content;
        if (data?.type !== MEDIA_READY_NOTIFICATION_TYPE) return;
        void refetchRef.current();
      },
    );
    return () => subscription.remove();
  }, []);

  return { isStalled, rearm: arm };
}
