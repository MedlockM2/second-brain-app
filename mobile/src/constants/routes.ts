/**
 * Routes that carry a navigation invariant, named so that no screen has to
 * restate it.
 *
 * Everything else in the app navigates with inline paths, which is fine: a
 * detail screen pushing `/media/[id]` states nothing beyond where it goes. The
 * two below are different — they are the only entry points of the
 * post-authentication funnel, and the bug they exist to prevent (task-326) was
 * exactly a screen deciding on its own where a fresh session should land.
 */

/**
 * The one route every authenticated path must go through.
 *
 * `app/index.tsx` is the only place allowed to choose between the tabs and the
 * language onboarding, so login, registration and both social flows send the
 * user here and let it decide. An auth screen that targets a tab directly
 * bypasses the language gate.
 */
export const POST_AUTH_ENTRY_POINT = "/";

/**
 * The reading-language gate. Reached from `app/index.tsx` on a cold start, and
 * from `app/(tabs)/_layout.tsx`, which is the mandatory passage of all four tabs
 * and therefore the point that makes the gate impossible to walk past.
 */
export const LANGUAGE_ONBOARDING_ROUTE = "/onboarding/language";

/**
 * Where a signed-out person lands: the sign-in screen, which links to sign-up.
 * There is no welcome screen in front of it any more — what the app does is told
 * after the first sign-in, by the intro below (TestFlight feedback
 * AHZj_EmKyk_-POh6f05H_SE). Sign-out and account deletion end here too.
 */
export const SIGNED_OUT_ENTRY_POINT = "/(auth)/login";

/**
 * The two-page intro shown once, after the first sign-in of a first install
 * (`src/lib/introState.ts` decides). Reached from `app/index.tsx` and from the
 * end of the language onboarding, never from a tab.
 */
export const INTRO_ROUTE = "/onboarding/intro";
