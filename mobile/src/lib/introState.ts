import { File, Paths } from "expo-file-system";

/**
 * Whether this install still owes the person the post-sign-in intro
 * (`app/onboarding/intro.tsx`).
 *
 * The owner wants it after a **first install**, never after an update, and for
 * **every new account**, even on a phone where the app was already installed
 * (owner, 2026-11-03). The install part lives in a file of the app's Documents
 * directory: an uninstall deletes it, an update keeps it. Not in
 * `expo-secure-store`: the iOS keychain survives an uninstall, and a reinstall
 * would then never show the intro. The account part needs no flag: a new account
 * has no reading language yet, so it always goes through
 * `app/onboarding/language.tsx`, which owes the intro unconditionally
 * (`oweIntroToNewAccount`).
 *
 * Three values:
 * - no file — undecided: nothing has signed in on this install since this code
 *   shipped;
 * - `owed` — an interactive sign-in happened on an undecided install: show the
 *   intro, and keep owing it until it is finished (a kill mid-intro shows it again);
 * - `seen` — finished, or settled without showing it.
 *
 * A session *restored* on an undecided install is an install that existed before
 * this code — an update — so it is settled to `seen` without the intro. The case
 * it cannot tell apart: a tester already installed but signed out when the update
 * lands sees the intro once after signing back in. A reinstall whose keychain
 * still holds a session restores it, and is settled the same way.
 *
 * Every access is synchronous (`app/index.tsx` decides on render) and swallows
 * errors: a file-system failure must cost at most the intro, never the launch.
 */
type IntroState = "owed" | "seen";

const intro = () => new File(Paths.document, "intro-state");

function read(): IntroState | null {
  try {
    const file = intro();
    if (!file.exists) return null;
    const value = file.textSync().trim();
    return value === "owed" || value === "seen" ? value : null;
  } catch {
    return null;
  }
}

function write(value: IntroState): void {
  try {
    const file = intro();
    if (!file.exists) file.create();
    file.write(value);
  } catch {
    // Best effort, see above.
  }
}

/** True while the intro is owed: the entry point sends the session there. */
export function isIntroOwed(): boolean {
  return read() === "owed";
}

/** After an interactive sign-in (e-mail or social): owe the intro if undecided. */
export function oweIntroIfUndecided(): void {
  if (read() === null) write("owed");
}

/**
 * The reading language was just chosen for the first time: the account is new,
 * whatever this install already saw (e-mail and social sign-ups alike).
 */
export function oweIntroToNewAccount(): void {
  write("owed");
}

/** After a restored session: an undecided install predates the intro, settle it. */
export function settleIntroForRestoredSession(): void {
  if (read() === null) write("seen");
}

/** « C'est parti » on the last page. */
export function markIntroSeen(): void {
  write("seen");
}
