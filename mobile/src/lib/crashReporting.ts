import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { AppState } from "react-native";

import { requestIdOf } from "@media-summarizer/core/api/apiClient";
import {
  bugReportDiagnostics,
  type BugReportDiagnostics,
} from "@media-summarizer/core/api/bugReportDiagnostics";
import { isNormalCancellation } from "@media-summarizer/core/errors/cancellation";
import {
  describeHandledFailure,
  routeOf,
  serverFailureOf,
  type HandledFailure,
} from "@media-summarizer/core/errors/handledFailure";

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

// `@sentry/react-native` does not re-export the hint types.
type BreadcrumbHint = Parameters<
  NonNullable<Sentry.ReactNativeOptions["beforeBreadcrumb"]>
>[1];
type EventHint = Parameters<NonNullable<Sentry.ReactNativeOptions["beforeSend"]>>[1];

/** What the SDK's XHR instrumentation keeps on the request it watches. */
type WatchedXhr = XMLHttpRequest & {
  __sentry_xhr_v3__?: { request_headers?: Record<string, string> };
};

/**
 * The `X-Request-ID` of the call behind an HTTP breadcrumb (task-610). React
 * Native's `fetch` goes out through XHR, so the hint carries the `xhr`: the id
 * the app sent (headers the SDK recorded, lower-cased), else the one the API
 * echoed back. Only the API sets it, so other hosts simply have none.
 */
function requestIdFromHint(hint: BreadcrumbHint | undefined): string | undefined {
  const xhr = hint?.xhr as WatchedXhr | undefined;
  if (!xhr) return undefined;
  try {
    return (
      xhr.__sentry_xhr_v3__?.request_headers?.["x-request-id"] ??
      xhr.getResponseHeader("x-request-id") ??
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * HTTP breadcrumbs keep the method, the path and the status, but lose the
 * query string: that is where a search term (`/api/search/transcripts?q=`) and
 * the signature of a presigned upload URL travel, and neither belongs in a
 * crash report. They gain the call's `request_id`, the key to its server logs.
 */
function scrubBreadcrumb(
  breadcrumb: Sentry.Breadcrumb,
  hint?: BreadcrumbHint,
): Sentry.Breadcrumb {
  const url = breadcrumb.data?.url;
  if (breadcrumb.type === "http" && typeof url === "string") {
    const requestId = requestIdFromHint(hint);
    return {
      ...breadcrumb,
      data: {
        ...breadcrumb.data,
        url: withoutQuery(url),
        ...(requestId ? { request_id: requestId } : {}),
      },
    };
  }
  return breadcrumb;
}

/**
 * Drops the app cancelling its own work (task-609) and tags an event raised by
 * a failed API call with that call's `request_id` (task-610), so the issue
 * leads straight to the server's log lines. Never an account identifier: the
 * join with the account happens server-side, in the logs.
 */
function prepareEvent(event: Sentry.ErrorEvent, hint: EventHint): Sentry.ErrorEvent | null {
  if (isNormalCancellation(hint.originalException)) return null;
  const requestId = requestIdOf(hint.originalException);
  if (requestId) event.tags = { ...event.tags, request_id: requestId };
  return event;
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
      // Cancellations dropped (callers catch them at the source; this is the
      // net for one that slips by), failed API calls tagged with request_id.
      beforeSend: prepareEvent,
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
 * Reports one failure the app handled and showed to the user (task-611): an
 * API call with no answer or a 5xx, a transfer to S3, an import, the chat
 * stream. A message event, not the error: it is built from enums, figures and
 * a normalized route only (`describeHandledFailure`), so no URL, file name,
 * typed text or server message can ride along. Grouped by operation, route
 * and cause, so one outage is one issue.
 *
 * A no-op without a DSN, and it never throws.
 */
export function captureHandledFailure(failure: HandledFailure): void {
  if (!Config.SENTRY_DSN) return;
  try {
    const { message, level, tags, fingerprint } = describeHandledFailure(failure);
    Sentry.captureMessage(message, { level, tags, fingerprint });
  } catch {
    // Nothing to do about a reporter that throws while reporting a failure.
  }
}

/**
 * `fetch` for the few calls that cannot go through the shared API client
 * (no session yet, or a public endpoint), reporting the same failures it would
 * (task-611): no answer, or a 5xx. `path` is the API path, folded into the
 * route; the body is never read.
 */
export async function fetchReportingFailures(
  operation: string,
  path: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const route = routeOf(init.method ?? "GET", path);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (!isNormalCancellation(error)) captureHandledFailure({ operation, cause: "network", route });
    throw error;
  }
  const serverFailure = serverFailureOf(response);
  if (serverFailure) captureHandledFailure({ operation, route, ...serverFailure });
  return response;
}

/**
 * What a bug report carries to lead to Sentry (task-612): the id of the last
 * event this session sent, when it sent one, and the running bundle: native
 * build (Sentry's `dist`) and OTA update (`ota.update_id`). Never an account
 * identifier. Never throws: a report must go out even if this cannot be read.
 */
export function currentBugReportDiagnostics(): BugReportDiagnostics {
  let eventId: string | undefined;
  try {
    eventId = Config.SENTRY_DSN ? Sentry.lastEventId() : undefined;
  } catch {
    eventId = undefined;
  }
  return bugReportDiagnostics({
    eventId,
    build: Application.nativeBuildVersion,
    updateId: Updates.updateId,
  });
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

/**
 * The direct PUT of a file to S3 (task-604), which no automatic span sees: it
 * leaves through expo-file-system's native `uploadAsync`, outside both the
 * `fetch` and the XHR instrumentation, and the API is not in the loop.
 *
 * One transaction per transfer, op `upload.s3` (`forceTransaction`: it runs
 * long after the screen that started it, so no navigation transaction can be
 * relied on to hold it), with one child per step so a slow read and a slow
 * network are told apart:
 *
 * - `upload.read_file` — opening and measuring the local file;
 * - `upload.sign` — `POST /api/media/upload-url`;
 * - `upload.put` — the PUT itself.
 *
 * Its attributes are figures and enums only. **Never the presigned URL, any part
 * of its query string, or the file's name** — the first is a credential, the
 * second the title of someone's note; `sendDefaultPii` is off for the same reason.
 *
 * Documented in `mobile/MOBILE_CI_CD.md`, "Crash Reporting (Sentry)". A no-op
 * without a DSN, and it never throws.
 */
export type UploadTraceStep = "read_file" | "sign" | "put";

export type UploadTraceAttributes = {
  "upload.target"?: string;
  "upload.content_type"?: string;
  "upload.bytes"?: number;
  "http.response.status_code"?: number;
  "upload.failure_stage"?: string;
  "upload.s3_code"?: string;
};

export interface UploadTrace {
  /** Time one step as a child span; a step that throws is marked failed. */
  step<T>(step: UploadTraceStep, run: () => Promise<T>): Promise<T>;
  set(attributes: UploadTraceAttributes): void;
  /** Close the transfer. Safe to call twice. */
  end(outcome: "ok" | "error"): void;
}

const NOOP_UPLOAD_TRACE: UploadTrace = {
  step: (_step, run) => run(),
  set: () => {},
  end: () => {},
};

export function startUploadTrace(attributes: UploadTraceAttributes): UploadTrace {
  if (!Config.SENTRY_DSN) return NOOP_UPLOAD_TRACE;
  try {
    const root = Sentry.startInactiveSpan({
      name: "upload.s3",
      op: "upload.s3",
      forceTransaction: true,
      attributes,
    });
    // Whether the OS could have throttled or suspended the transfer.
    let backgrounded = AppState.currentState === "background";
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") backgrounded = true;
    });
    let ended = false;
    return {
      async step(step, run) {
        let child: ReturnType<typeof Sentry.startInactiveSpan> | null = null;
        try {
          child = Sentry.startInactiveSpan({
            name: `upload.${step}`,
            op: `upload.${step}`,
            parentSpan: root,
          });
        } catch {
          child = null;
        }
        const close = (ok: boolean) => {
          try {
            child?.setStatus({ code: ok ? SPAN_STATUS_OK : SPAN_STATUS_ERROR });
            child?.end();
          } catch {
            // A reporter that fails while closing a span changes nothing.
          }
        };
        try {
          const value = await run();
          close(true);
          return value;
        } catch (error) {
          close(false);
          throw error;
        }
      },
      set(next) {
        try {
          root.setAttributes(next);
        } catch {
          // Same.
        }
      },
      end(outcome) {
        if (ended) return;
        ended = true;
        subscription.remove();
        try {
          root.setAttribute("upload.backgrounded", backgrounded);
          root.setStatus({ code: outcome === "ok" ? SPAN_STATUS_OK : SPAN_STATUS_ERROR });
          root.end();
        } catch {
          // Same.
        }
      },
    };
  } catch {
    return NOOP_UPLOAD_TRACE;
  }
}
