import { File, Paths } from "expo-file-system";

/**
 * Whether this install still owes the person the post-sign-in intro
 * (`app/onboarding/intro.tsx`).
 *
 * The owner wants it after a **first install only, never after an update**. So
 * the state lives in a file of the app's Documents directory: an uninstall
 * deletes it, an update keeps it. Not in `expo-secure-store`: the iOS keychain
 * survives an uninstall, and a reinstall would then never show the intro.
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

/** After a restored session: an undecided install predates the intro, settle it. */
export function settleIntroForRestoredSession(): void {
  if (read() === null) write("seen");
}

/** « C'est parti » on the last page. */
export function markIntroSeen(): void {
  write("seen");
}
