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

/**
 * Created unconditionally, DSN or not, so `registerNavigationContainer` below
 * always has something to call — it only reaches Sentry once `Sentry.init`
 * below has actually run.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration();

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
      // Both already default on iOS/Android respectively, spelled out because
      // this is the net a fatal/rejection/render capture cannot be: a freeze
      // that never throws (the unresolved `AK1DS3kTae8nm6GpVzLveTg` feedback).
      // Android has no JS-level equivalent option — its ANR detection is
      // native and on by default as long as `enableNativeCrashHandling` (also
      // default) stays true, which it does here.
      enableAppHangTracking: true,
      appHangTimeoutInterval: 2,
      // Full sampling while the beta's volume is low; revisit once the
      // tester count grows enough to make sampling worth the quota it saves.
      tracesSampleRate: 1.0,
      initialScope: { tags: resolveTags() },
      beforeBreadcrumb: scrubBreadcrumb,
      integrations: [
        Sentry.reactNativeErrorHandlersIntegration({
          onerror: false,
          onunhandledrejection: false,
        }),
        // `traceFetch` and `traceXHR` both on: this app's HTTP calls could go
        // through either RN's `fetch` or its XHR polyfill, and enabling both
        // costs nothing extra per call (a request only ever takes one path).
        Sentry.reactNativeTracingIntegration({ traceFetch: true, traceXHR: true }),
        navigationIntegration,
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

/**
 * Wires Expo Router's navigation container to Sentry so route changes show up
 * as transactions/spans in Performance. Called once from `app/_layout.tsx`.
 */
export function registerNavigationContainer(ref: unknown): void {
  if (!Config.SENTRY_DSN) return;
  navigationIntegration.registerNavigationContainer(ref);
}

/**
 * One entry in the trail leading up to a crash or a hang, for the steps the
 * SDK's own automatic breadcrumbs (HTTP, console) never see: what the
 * ingestion/processing/translation pipeline itself was doing. A no-op
 * without a DSN, and it never throws, same as `captureCaughtError`.
 */
export function addPipelineBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!Config.SENTRY_DSN) return;
  try {
    Sentry.addBreadcrumb({ category, message, level: "info", data });
  } catch {
    // Nothing to do about a reporter that throws while reporting a trail.
  }
}

/**
 * The three sources the Home screen opens with, each named after the block it
 * fills: the media list behind "Recently added", the engagement row behind
 * "Continue learning", and the count on the unsorted-review card.
 *
 * They are the three the task-417 waterfall compares, which is why they are a
 * closed union and not a free string: a typo would put one span of one open in a
 * bucket of its own and the comparison is the whole point.
 */
export type HomeSection =
  | "recently_added"
  | "continue_learning"
  | "unsorted_count";

/** An open section span. `end` is safe to call twice and never throws. */
export interface HomeSectionSpan {
  end: (outcome: "ok" | "error") => void;
}

const NOOP_HOME_SECTION_SPAN: HomeSectionSpan = { end: () => {} };

/**
 * `SpanStatusCode`, which `@sentry/react-native` re-exports the *type* of but not
 * the constants. Two magic numbers rather than a dependency on an internal path
 * of `@sentry/core`; the values are part of the wire protocol, not of a build.
 */
const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

/**
 * Measures one Home block from the moment its request leaves to the moment its
 * answer is committed to the state the screen renders from (task-417).
 *
 * The automatic HTTP spans already time the request; what they cannot say is how
 * long the *screen* waited, which is the number this task is about — the two
 * sections that arrive late used to be gated on each other rather than on their
 * own endpoint, and only a span that ends at the `setState` shows that.
 *
 * `onlyIfParent` is what attaches this to the navigation transaction Expo Router
 * already opens (`navigationIntegration`) instead of starting a transaction of its
 * own: a span with no parent would report a refresh fired minutes later as if it
 * were an app open. A child span also holds the idle navigation transaction open
 * until it ends, so the waterfall contains the whole wait rather than the first
 * second of it. When there is no parent — a pull-to-refresh, a focus re-read —
 * nothing is recorded and the returned handle is inert.
 *
 * A no-op without a DSN and it never throws, same as the two functions above:
 * instrumentation must not be able to fail the thing it measures.
 */
export function startHomeSectionSpan(section: HomeSection): HomeSectionSpan {
  if (!Config.SENTRY_DSN) return NOOP_HOME_SECTION_SPAN;
  try {
    const span = Sentry.startInactiveSpan({
      name: `home.${section}`,
      op: "ui.load",
      onlyIfParent: true,
      attributes: { "home.section": section },
    });
    let ended = false;
    return {
      end(outcome) {
        if (ended) return;
        ended = true;
        try {
          span.setStatus({
            code: outcome === "ok" ? SPAN_STATUS_OK : SPAN_STATUS_ERROR,
          });
          span.end();
        } catch {
          // Nothing to do about a reporter that throws while closing a span.
        }
      },
    };
  } catch {
    return NOOP_HOME_SECTION_SPAN;
  }
}
