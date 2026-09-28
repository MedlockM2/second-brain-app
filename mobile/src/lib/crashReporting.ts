import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";

import { Config } from "../constants/config";
// Type-only on purpose: startupErrorGuard imports this module at runtime, so a
// value import back would be a cycle.
import type { StartupFailureOrigin } from "./startupErrorGuard";

/**
 * Crash and error reporting to Sentry (task-413).
 *
 * **Sentry does not own the global error hooks here; startupErrorGuard does.**
 * `@sentry/react-native` installs its own `ErrorUtils.setGlobalHandler` and its
 * own Hermes rejection tracker through `reactNativeErrorHandlersIntegration`,
 * exactly the two hooks `startupErrorGuard.ts` already owns. Letting both
 * install breaks something whichever way they stack:
 *
 * - Sentry wrapping the guard: its fatal handler latches after the first fatal
 *   error and swallows every later one, so a second fatal after "Try again"
 *   would never reach `StartupErrorGate` again.
 * - The guard wrapping Sentry: the guard deliberately does not forward a fatal
 *   error in a release build (forwarding is what aborts the process), so Sentry
 *   would never see one.
 * - Hermes keeps a single rejection tracker, so the second one installed
 *   silently replaces the first.
 *
 * So that integration is replaced below by a copy with both hooks switched off
 * (a user integration with the same name overrides the default one), and the
 * guard reports what it catches through `captureCaughtError`, with the same
 * level and mechanism Sentry's handlers would have used. Nothing else in that
 * integration applies to a Hermes build once both hooks are off.
 *
 * Nothing is initialised without a DSN. That is the normal state of a local
 * `expo start` without `EXPO_PUBLIC_SENTRY_DSN` and of the E2E builds, and every
 * function here is then a no-op.
 */

/** What caught the error: the guard's three nets plus the non-fatal pass-through. */
export type CaughtErrorOrigin = StartupFailureOrigin | "non-fatal-error";

interface CaptureShape {
  level: Sentry.SeverityLevel;
  mechanism: { type: string; handled: boolean };
}

/**
 * How each origin is recorded, mirroring what Sentry's own handlers would have
 * sent so the issue list and the crash-free rate read the way Sentry documents
 * them.
 *
 * `handled: false` is what counts as a crash in the crash-free sessions metric.
 * It is used where the user loses the app: a fatal error (the process would have
 * aborted; the guard swaps the whole tree for the fallback instead), and a
 * render error, which ends in the same fallback. `@sentry/react`'s own boundary
 * would mark that one handled because a fallback exists, but a fallback that
 * replaces the entire app is not a recovery. A rejection or a non-fatal error
 * leaves the app running, as Sentry's own handlers also record them.
 */
const CAPTURE_SHAPES: Record<CaughtErrorOrigin, CaptureShape> = {
  "fatal-error": {
    level: "fatal",
    mechanism: { type: "onerror", handled: false },
  },
  render: {
    level: "fatal",
    mechanism: { type: "auto.function.react.error_boundary", handled: false },
  },
  "unhandled-rejection": {
    level: "error",
    mechanism: { type: "onunhandledrejection", handled: true },
  },
  "non-fatal-error": {
    level: "error",
    mechanism: { type: "generic", handled: true },
  },
};

let initialised = false;

/**
 * The Sentry environment: the EAS Update channel the binary was built for.
 *
 * One value per build profile, because every profile has its own channel
 * (MOBILE_CI_CD.md, "One channel per build profile"). `preview` and `internal`
 * talk to the -dev API, `production` to the prod one; the `api.host` tag says
 * which backend explicitly. A development client has no channel and runs with
 * `__DEV__`, hence `development`. `local` is a release build made outside EAS,
 * which carries no channel.
 *
 * Not Sentry's default, which is `production` for every release build and
 * would put TestFlight crashes on the -dev API in the same bucket as store ones.
 */
function resolveEnvironment(): string {
  if (__DEV__) return "development";
  return Updates.channel || "local";
}

/**
 * Tags that make one crash attributable to one exact bundle. Release and dist
 * (`com.secondbrainlabs.core@<version>+<build>`, `<build>`) are filled in by
 * the SDK from the native app, which is the build. An update delivered over
 * the air runs under the release of the binary it landed on, so the update id
 * is what tells two bundles of the same build apart.
 */
function resolveTags(): Record<string, string> {
  const tags: Record<string, string> = {
    "api.host": hostOf(Config.API_BASE_URL),
    "ota.embedded_launch": String(Updates.isEmbeddedLaunch),
  };
  if (Updates.updateId) {
    tags["ota.update_id"] = Updates.updateId;
  }
  return tags;
}

/**
 * `new URL()` is avoided on purpose: React Native's URL polyfill does not
 * implement the component getters.
 */
function hostOf(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url);
  return match?.[1] ?? "unknown";
}

/** `scheme://host/path` without the query string or the fragment. */
function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * HTTP breadcrumbs keep the method, the path and the status, but lose the
 * query string: that is where a search term (`/api/search/transcripts?q=`) and
 * the signature of a presigned upload URL travel, and neither belongs in a
 * crash report.
 */
function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  const url = breadcrumb.data?.url;
  if (breadcrumb.type === "http" && typeof url === "string") {
    return { ...breadcrumb, data: { ...breadcrumb.data, url: withoutQuery(url) } };
  }
  return breadcrumb;
}

/**
 * Starts Sentry. Idempotent, so a fast refresh cannot initialise it twice, and
 * called from the module scope of `app/_layout.tsx` *before*
 * `installStartupErrorGuard`, so the guard's first report already has a
 * client to go to.
 *
 * It never throws: a reporting SDK that fails to start must not take the app
 * down with it.
 */
export function initCrashReporting(): void {
  if (initialised) return;
  initialised = true;
  if (!Config.SENTRY_DSN) return;

  try {
    Sentry.init({
      dsn: Config.SENTRY_DSN,
      environment: resolveEnvironment(),
      // Default already, spelled out: no IP address, no user identity. The
      // privacy policy lists Sentry as a processor of crash data on that basis.
      sendDefaultPii: false,
      initialScope: { tags: resolveTags() },
      beforeBreadcrumb: scrubBreadcrumb,
      integrations: [
        Sentry.reactNativeErrorHandlersIntegration({
          onerror: false,
          onunhandledrejection: false,
        }),
      ],
    });
  } catch (error) {
    console.error("[crash-reporting] Sentry failed to initialise:", error);
  }
}

/**
 * Sends one error the guard caught. A no-op while Sentry is not initialised,
 * and it never throws: it runs inside the global error handler, which must
 * never be the reason the guard itself dies.
 */
export function captureCaughtError(
  value: unknown,
  origin: CaughtErrorOrigin,
): void {
  if (!Config.SENTRY_DSN) return;
  const { level, mechanism } = CAPTURE_SHAPES[origin];
  try {
    Sentry.captureException(value, {
      mechanism,
      captureContext: { level, tags: { "startup_guard.origin": origin } },
    });
  } catch {
    // Nothing to do about a reporter that throws while reporting a throw.
  }
}
