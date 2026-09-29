/**
 * What makes an open media re-read its full text while the translation of it is
 * still being produced, and stop as soon as it is not — the task-404 pattern of
 * `useProcessingRefresh`, applied to one media instead of a list of vignettes
 * (task-415).
 *
 * A tester reported the bug this exists for: the transcript of a long video
 * showed its original English as if it were the result. The poll it replaces was
 * a fixed chain of 20 reads, 3 s apart — a 60 s ceiling, after which the screen
 * settled on `ready` with whatever it had. On `translation_idempotence-dev`
 * (52 translations, 2026-09-28, `created_at` of the reservation to `updated_at`
 * of `done`) only 73% finish inside 60 s: the median is 36 s, p90 107 s, p95
 * 143 s and the longest 252.5 s. Every fourth translation was therefore shown as
 * finished before it was.
 *
 * **One schedule.** A read every 3 s for the first minute — where three quarters
 * of translations land — then every 10 s, up to a budget of 5 minutes, which
 * covers the longest translation measured. Ticks do not wait for their read: the
 * API client carries no timeout, and a read that never answers must not keep the
 * budget from running out.
 *
 * **The budget belongs to the media, not to the mount.** The Digest carousel
 * mounts a page when it comes within one swipe and drops it past that, so a
 * budget held in the component would start over every time the reader swiped
 * back — a remount is not a new reason to wait. The start of each budget is kept
 * in a `TranslationBudgets` the host holds for as long as the screen lives: the
 * carousel passes one it keeps for the period, and a host that passes none (the
 * `/media/[id]` route, where a mount *is* the opening of the screen) gets one per
 * mount.
 *
 * **Three things grant a whole budget**, the three of `useProcessingRefresh`:
 *
 * 1. **The screen coming back into view.** Being in view at mount is the mount
 *    itself, and resumes the budget where it stands; coming back into view after
 *    a blur is a return to the screen, and grants a fresh budget to every media
 *    the screen has waited on — the pages the carousel has dropped included,
 *    which is what keeps a page swiped to after the return from finding the old,
 *    spent one.
 * 2. **A return to the foreground**, which also disarms on the way out. The same
 *    `change` event and the same `nextState === "active"` test as
 *    `useProcessingRefresh`, for the same reason: backgrounding the app blurs no
 *    screen, so the focus of the screen says nothing about it.
 * 3. **The explicit gesture**, through `rearm`. A detail page has no
 *    pull-to-refresh; the "Check again" of the stalled line is its equivalent,
 *    and it grants a budget to this media only.
 *
 * Each of them also reads the text at once, rather than three seconds later: it
 * is the moment the reader is looking.
 *
 * **It stops**, the three ways Apple's energy guide names: a bounded budget, a
 * disarm the moment the translation is no longer pending (`done` or `failed`,
 * both of which the caller turns into a state that is not pending), and no timer
 * on a screen that is not in view.
 *
 * **When the budget runs out** the caller is told through `isStalled`, and draws
 * an explicit "still translating" line, still, instead of the animated one — and
 * never the original text as the finished result. A translation that outlives
 * 5 minutes is not a failure, so nothing says it is, but nor is it done. The
 * budget counts time, not successful reads, so an offline device reaches the end
 * of it and settles on that line instead of polling for ever.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { addPipelineBreadcrumb } from "../lib/crashReporting";

/** The tick of the first minute. Same interval as every other poll in the app. */
const FAST_INTERVAL_MS = 3000;
/** The tick past the first minute, where a 3 s answer buys almost nothing. */
const SLOW_INTERVAL_MS = 10000;
/** How long the fast phase lasts — the window 73% of translations finish in. */
const FAST_PHASE_MS = 60 * 1000;
/**
 * The whole budget of one arming, after which `isStalled` takes over. Covers the
 * longest translation measured on dev (252.5 s).
 */
const BUDGET_MS = 5 * 60 * 1000;

/**
 * When the running translation budget of each media started, for as long as the
 * screen that waits on them lives.
 *
 * Held by the host rather than by the page, so that a page the host unmounts and
 * mounts again resumes its budget instead of starting a new one. The host must
 * keep the same instance for the life of the screen (`useState(() => new
 * TranslationBudgets())`): a new one is a fresh budget for everything.
 *
 * Nothing is ever removed. A screen waits on a handful of media at most, and a
 * translation that finished never goes back to pending, so its entry is simply
 * never read again.
 */
export class TranslationBudgets {
  private readonly startedAt = new Map<string, number>();

  /** When this media's budget started, opening one now if it has none yet. */
  resume(mediaItemId: string, now: number): number {
    const existing = this.startedAt.get(mediaItemId);
    if (existing !== undefined) return existing;
    this.startedAt.set(mediaItemId, now);
    return now;
  }

  /** A whole budget for this media, from now. */
  grant(mediaItemId: string, now: number): void {
    this.startedAt.set(mediaItemId, now);
  }

  /**
   * A whole budget for every media this screen has waited on, from now — what a
   * trigger that concerns the whole screen grants. Every page mounted on the
   * screen receives the same trigger and calls this; the calls agree to within
   * the milliseconds that separate them.
   */
  grantAll(now: number): void {
    for (const mediaItemId of this.startedAt.keys()) {
      this.startedAt.set(mediaItemId, now);
    }
  }

  /** When this media's budget started, if it has one. */
  startOf(mediaItemId: string): number | undefined {
    return this.startedAt.get(mediaItemId);
  }
}

export interface UseTranslationRefreshOptions {
  /** The media whose translation is awaited — the key of its budget. */
  mediaItemId: string;
  /**
   * Whether the text on screen is the original, with its translation still on
   * its way. False while the text is loading, as well as once the translation is
   * done or has failed: only a pending translation arms anything.
   */
  isPending: boolean;
  /**
   * The silent re-read of the text — never the one that drives the loading line:
   * a tick must leave the text on screen exactly where it is.
   */
  refetch: () => void | Promise<void>;
  /**
   * The budgets the host keeps for its screen. Omitted, the budgets live and die
   * with this mount.
   */
  budgets?: TranslationBudgets;
}

export interface UseTranslationRefreshResult {
  /**
   * The budget is spent and the translation is still pending. The caller shows
   * an explicit "still translating" line, without movement.
   */
  isStalled: boolean;
  /**
   * Read the text now and grant this media a whole budget, if the screen is in
   * view and the translation still pending. The "Check again" of the stalled
   * line.
   */
  rearm: () => void;
}

export function useTranslationRefresh({
  mediaItemId,
  isPending,
  refetch,
  budgets: hostBudgets,
}: UseTranslationRefreshOptions): UseTranslationRefreshResult {
  const [ownBudgets] = useState(() => new TranslationBudgets());
  const budgets = hostBudgets ?? ownBudgets;

  const [isStalled, setIsStalled] = useState(false);

  /** The pending tick, if the schedule is running. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * What arming reads. Refs rather than values closed over, because arming is
   * called from listeners registered once for the life of the page and must see
   * the current answer, not the one from the render that registered them.
   */
  const mediaItemIdRef = useRef(mediaItemId);
  const isPendingRef = useRef(isPending);
  const refetchRef = useRef(refetch);
  /**
   * Whether the screen is the one in view. The foreground listener fires for
   * every mounted page of every screen, including screens a tab navigator keeps
   * alive behind the one on show.
   */
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(false);
  /**
   * Whether the screen has been out of view since this page last saw it in view.
   * Coming into view with it set is a return to the screen, which refills the
   * budget; coming into view without it is the mount itself, which resumes it.
   */
  const hasBlurredRef = useRef(false);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Run the schedule of the media's budget from wherever it stands — opening a
   * budget if the media has none, and going straight to `isStalled` if it is
   * already spent.
   */
  const resume = useCallback(() => {
    stop();
    // Nothing to wait for, or nobody looking. Both are the normal end of a wait:
    // the translation settled, or the reader moved on.
    if (!isFocusedRef.current || !isPendingRef.current) return;

    const key = mediaItemIdRef.current;
    addPipelineBreadcrumb("translation.resumed", "Translation refresh resumed", {
      mediaItemId: key,
    });
    const openedAt = budgets.resume(key, Date.now());

    const schedule = () => {
      // Read back on every tick: a trigger on another page of the screen may
      // have granted this media a new budget in the meantime.
      const elapsed = Date.now() - (budgets.startOf(key) ?? openedAt);
      if (elapsed >= BUDGET_MS) {
        // Out of budget, translation still pending. The line stays, the
        // movement stops, and one of the three triggers can grant another.
        timerRef.current = null;
        addPipelineBreadcrumb(
          "translation.stalled",
          "Translation refresh budget exhausted",
          { mediaItemId: key, elapsed },
        );
        setIsStalled(true);
        return;
      }
      timerRef.current = setTimeout(
        tick,
        elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS,
      );
    };

    const tick = () => {
      // Deliberately not awaited: the budget runs on the clock, not on the
      // answers. A failed read changes nothing on screen — the line still says
      // the translation is on its way, which is true — and the next tick retries.
      void refetchRef.current();
      schedule();
    };

    setIsStalled(false);
    schedule();
  }, [budgets, stop]);

  const rearm = useCallback(() => {
    if (!isFocusedRef.current || !isPendingRef.current) return;
    addPipelineBreadcrumb("translation.rearmed", "Translation refresh rearmed", {
      mediaItemId: mediaItemIdRef.current,
    });
    budgets.grant(mediaItemIdRef.current, Date.now());
    void refetchRef.current();
    resume();
  }, [budgets, resume]);

  /** The screen came back — into view, or to the foreground. */
  const rearmScreen = useCallback(() => {
    if (!isFocusedRef.current) return;
    addPipelineBreadcrumb(
      "translation.rearmed",
      "Translation refresh rearmed on screen return",
    );
    // Every media of the screen, this one settled or not: the pages the host
    // has unmounted are not here to hear the trigger.
    budgets.grantAll(Date.now());
    if (!isPendingRef.current) return;
    void refetchRef.current();
    resume();
  }, [budgets, resume]);

  // Armed by what the text on screen is, and disarmed the moment it is anything
  // but a pending translation — which is the tick right after the server
  // finished or gave up. A change of media resumes the budget of the new one.
  useEffect(() => {
    mediaItemIdRef.current = mediaItemId;
    isPendingRef.current = isPending;
    if (!isPending) {
      stop();
      return;
    }
    // Out of band by one turn rather than inline, because `resume` reaches a
    // `setState` and `react-hooks/set-state-in-effect` refuses that from an
    // effect body.
    const timer = setTimeout(resume, 0);
    return () => clearTimeout(timer);
  }, [mediaItemId, isPending, resume, stop]);

  // In view, the schedule runs; out of view — blurred, or unmounted — no timer is
  // left behind. Keyed on the focus *value* rather than on `useFocusEffect`,
  // whose effect also re-runs when the navigation object it reads changes
  // identity: a re-run that is not a return must not count as one.
  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) {
      hasBlurredRef.current = true;
      return;
    }
    const isReturn = hasBlurredRef.current;
    hasBlurredRef.current = false;
    const timer = setTimeout(isReturn ? rearmScreen : resume, 0);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [isFocused, rearmScreen, resume, stop]);

  // Leaving the foreground disarms; coming back reads the text at once and
  // grants a fresh budget.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (!isFocusedRef.current) return;
      if (nextState !== "active") {
        stop();
        return;
      }
      rearmScreen();
    });
    return () => subscription.remove();
  }, [rearmScreen, stop]);

  // A stale `true` from a translation that has since settled must not reach the
  // caller: stalled only ever qualifies a pending translation.
  return { isStalled: isStalled && isPending, rearm };
}
