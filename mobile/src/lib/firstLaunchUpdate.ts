import { useEffect } from "react";
import * as Updates from "expo-updates";
import type { ThemeColors } from "../constants/theme";

/**
 * A fresh install meets the latest OTA update at its first sign-in, not one
 * launch later (DRAFT-2, owner 2026-11-03).
 *
 * A binary always starts on the JavaScript it embeds; expo-updates downloads the
 * latest update during that launch (`checkAutomatically` ON_LOAD, the default)
 * and only runs it at the next cold start. The screens a new user meets first —
 * sign-in, reading language, intro — are therefore those of the binary, however
 * old, unless the update is applied before them. On 2026-11-02 that showed the
 * store reviewer a carousel removed days earlier and cost two native builds.
 *
 * `updates.fallbackToCacheTimeout` would fix it natively by holding the splash
 * screen until the download ends: refused by the owner, no launch may wait. The
 * sign-in screen is where the time is: the user types an email and a password, or
 * goes through Apple or Google, while the update downloads in the background.
 * When the sign-in succeeds the app is about to leave that screen anyway, so that
 * is where it restarts on the update, behind the button's spinner and a reload
 * screen in the theme's colours.
 *
 * Only on an embedded launch: after the reload the app runs the update, so this
 * cannot loop, and an install that already runs an update is never touched.
 *
 * This logic only helps once it is *embedded*: changing it is a JavaScript change
 * that CI ships as an OTA, which a fresh install meets one launch too late —
 * build a binary by hand after changing it (mobile/MOBILE_CI_CD.md).
 */

/** How long a sign-in waits for a download already under way. */
const MAX_WAIT_MS = 1000;
const POLL_MS = 50;

type Snapshot = { pending: boolean; busy: boolean };

// The download state lives in expo-updates' native state machine, published to
// JavaScript through the `useUpdates` hook only; the tracker below mirrors it here
// so that the sign-in, which is not a component, can read it.
let snapshot: Snapshot = { pending: false, busy: true };
let checkedByHand = false;

function isActive(): boolean {
  return Updates.isEnabled && Updates.isEmbeddedLaunch && !__DEV__;
}

/**
 * Mirrors the download state; mount once, in a provider that lives from launch.
 * When the startup check ends without an update in hand, it checks once more and
 * fetches by itself, so that a download is under way while the user signs in
 * whatever the startup procedure decided.
 */
export function useFirstLaunchUpdateTracker(): void {
  const { isUpdatePending, isChecking, isDownloading, isStartupProcedureRunning } = Updates.useUpdates();

  useEffect(() => {
    if (!isActive()) return;
    const busy = isStartupProcedureRunning || isChecking || isDownloading;
    snapshot = { pending: isUpdatePending, busy };
    if (busy || isUpdatePending || checkedByHand) return;
    checkedByHand = true;
    snapshot = { pending: false, busy: true };
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline, or the server is down: the sign-in goes on, on the embedded code.
      }
    })().finally(() => {
      // The hook's next render carries the real state; this only stops a sign-in
      // from waiting on a check that has already ended.
      snapshot = { ...snapshot, busy: false };
    });
  }, [isUpdatePending, isChecking, isDownloading, isStartupProcedureRunning]);
}

async function waitWhileBusy(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (snapshot.busy && !snapshot.pending && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/**
 * Called once the session is stored and the intro owed, before any navigation.
 * Restarts on a downloaded update, waits at most `MAX_WAIT_MS` for one being
 * downloaded, and otherwise returns at once: the update then runs at the next
 * launch, as it always did.
 */
export async function applyLatestUpdateOnFirstSignIn(colors: ThemeColors): Promise<void> {
  if (!isActive()) return;
  if (!snapshot.pending) await waitWhileBusy();
  if (!snapshot.pending) return;
  try {
    await Updates.reloadAsync({
      reloadScreenOptions: {
        backgroundColor: colors.background,
        spinner: { enabled: true, color: colors.primary, size: "medium" },
        fade: true,
      },
    });
  } catch {
    // A failed reload leaves the app on the embedded code, signed in: the update
    // runs at the next launch.
  }
}
