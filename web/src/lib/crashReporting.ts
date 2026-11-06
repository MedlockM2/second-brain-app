import * as Sentry from "@sentry/browser";
import { Config } from "../config";

/**
 * Sentry on the web app, introduced for the direct upload trace (task-604).
 *
 * Nothing starts without `VITE_SENTRY_DSN`, and every function here is then a
 * no-op. Same privacy stance as the mobile app (`mobile/src/lib/crashReporting.ts`):
 * `sendDefaultPii` off, and HTTP breadcrumbs lose their query string — that is
 * where the signature of a presigned upload URL travels. No automatic browser
 * tracing: the only span the app sends is the upload's.
 */
let initialised = false;

function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  const url = breadcrumb.data?.url;
  if (typeof url === "string") {
    return { ...breadcrumb, data: { ...breadcrumb.data, url: withoutQuery(url) } };
  }
  return breadcrumb;
}

export function initCrashReporting(): void {
  if (initialised) return;
  initialised = true;
  if (!Config.SENTRY_DSN) return;
  try {
    Sentry.init({
      dsn: Config.SENTRY_DSN,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      // Full sampling while the beta's volume is low, as on mobile.
      tracesSampleRate: 1.0,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  } catch (error) {
    console.error("[crash-reporting] Sentry failed to initialise:", error);
  }
}

// `SpanStatusCode` values (wire protocol), as on mobile.
const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

/**
 * One direct PUT to S3, op `upload.s3`, same attributes and child steps as the
 * mobile trace (`mobile/MOBILE_CI_CD.md`, "Crash Reporting (Sentry)"). The
 * browser reads the `File` while it sends it, so there is no `upload.read_file`
 * step here: the read is inside `upload.put`. Never the URL, never the name.
 */
export type UploadTraceStep = "sign" | "put";

export type UploadTraceAttributes = {
  "upload.target"?: string;
  "upload.content_type"?: string;
  "upload.bytes"?: number;
  "http.response.status_code"?: number;
  "upload.failure_stage"?: string;
};

export interface UploadTrace {
  step<T>(step: UploadTraceStep, run: () => Promise<T>): Promise<T>;
  set(attributes: UploadTraceAttributes): void;
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
    const root = Sentry.startInactiveSpan({ name: "upload.s3", op: "upload.s3", forceTransaction: true, attributes });
    // The web counterpart of the app going to the background: a hidden tab,
    // which browsers throttle.
    let backgrounded = document.visibilityState === "hidden";
    const onVisibility = () => {
      if (document.visibilityState === "hidden") backgrounded = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    let ended = false;
    return {
      async step(step, run) {
        let child: ReturnType<typeof Sentry.startInactiveSpan> | null = null;
        try {
          child = Sentry.startInactiveSpan({ name: `upload.${step}`, op: `upload.${step}`, parentSpan: root });
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
        document.removeEventListener("visibilitychange", onVisibility);
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
