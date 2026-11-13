import { isNormalCancellation } from "./cancellation";
import type { HttpError } from "../api/httpError";

/**
 * A failure the app handled and showed to the user, reported to Sentry as an
 * event of its own (task-611).
 *
 * Without this, Sentry only hears about what reaches the global error handler
 * (a crash, a render error, an unhandled rejection). An import refused, a load
 * that failed, a transfer to S3 cut off: each one left a breadcrumb, which
 * Sentry only sends along with a later event. The server side of those
 * failures already has its CloudWatch alarms; what only the device sees
 * (offline, timeout, S3 refusing a PUT, an unreadable file) did not.
 *
 * Every field is an enum, a figure or a normalized route. **Never** a signed
 * URL, a query string, a file name, text the user typed or media content: the
 * event is built from these fields only, never from an error's message.
 */
export type HandledFailure = {
  /** What was being done: `api.request`, `upload`, `import`, `chat.stream`… */
  operation: string;
  /** Short, stable reason: `network`, `http_503`, an upload stage… */
  cause: string;
  /** `METHOD /path` with ids folded (`routeOf`); absent when not an HTTP call. */
  route?: string;
  status?: number;
  /** The step that failed, for a flow that has steps (an upload, an import). */
  failureStage?: string;
  /** The kind of media involved, when there is one (`document`, `audio`, `url`…). */
  mediaType?: string;
  /** The `X-Request-ID` of the call that failed (task-610). */
  requestId?: string;
  /**
   * `error` for a 5xx the API Gateway sent and a failed import; `warning`
   * otherwise.
   */
  level?: "warning" | "error";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Folds one path segment that is data, not route: an id becomes `:id`, and
 * anything encoded or unusual (text a user typed into a path) becomes
 * `:value`. Static segments are lowercase words with hyphens or underscores.
 */
function foldSegment(segment: string): string {
  if (!segment) return segment;
  if (UUID.test(segment) || /^\d+$/.test(segment)) return ":id";
  if (/^[0-9a-f]{16,}$/i.test(segment)) return ":id";
  if (/\d/.test(segment) && /^[A-Za-z0-9_-]{16,}$/.test(segment)) return ":id";
  if (!/^[a-z][a-z0-9_.-]*$/.test(segment)) return ":value";
  return segment;
}

/**
 * `GET /api/media/:id/raw-content` out of a method and a path or URL: no
 * scheme, no host, no query string, no fragment, ids folded. That is what
 * makes one issue per route rather than one per media.
 */
export function routeOf(method: string, pathOrUrl: string): string {
  const withoutHost = pathOrUrl.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "");
  const cut = withoutHost.search(/[?#]/);
  const path = cut === -1 ? withoutHost : withoutHost.slice(0, cut);
  return `${method.toUpperCase()} ${path.split("/").map(foldSegment).join("/") || "/"}`;
}

/**
 * The refusals that are part of normal use and stay breadcrumbs: a session
 * that expired (401), a plan limit (402, 429), a media deleted meanwhile (404).
 */
export const EXPECTED_STATUSES: ReadonlySet<number> = new Set([401, 402, 404, 429]);

/**
 * The cause of a failed call or flow, as a short stable string: `http_<status>`
 * for an HTTP refusal, `network` for a call that got no answer, `unexpected`
 * for anything else. `null` for what is not a failure to report: a normal
 * cancellation (task-609) or an expected refusal.
 */
export function failureCauseOf(error: unknown): string | null {
  if (isNormalCancellation(error)) return null;
  const status = (error as HttpError | null)?.status;
  if (typeof status === "number") {
    return EXPECTED_STATUSES.has(status) ? null : `http_${status}`;
  }
  if (error instanceof TypeError) return "network";
  return "unexpected";
}

/**
 * The header API Gateway puts on every response it sends, its own 5xx
 * included. A 5xx without it was made on the way, by a proxy, a VPN or a
 * carrier gateway, and the request never reached the API.
 */
export const GATEWAY_REQUEST_ID_HEADER = "apigw-requestid";

/**
 * What to report for an answer from the API: nothing below 500; `http_<status>`
 * at `error` when the API Gateway sent the 5xx; `network` at `warning` when it
 * did not, since the device's network failed, not the server. The status stays
 * on the event either way.
 */
export function serverFailureOf(response: {
  status: number;
  headers: Pick<Headers, "has">;
}): Pick<HandledFailure, "cause" | "status" | "level"> | null {
  const { status } = response;
  if (status < 500) return null;
  if (response.headers.has(GATEWAY_REQUEST_ID_HEADER)) {
    return { cause: `http_${status}`, status, level: "error" };
  }
  return { cause: "network", status, level: "warning" };
}

/**
 * What a platform's reporter sends to Sentry for one handled failure.
 *
 * The fingerprint keeps the route apart for a server fault, so one broken
 * route makes one issue. A `network` failure leaves it out: a device that
 * loses its connection fails every call it has in flight, and that is one
 * event to look at, not one issue per route.
 */
export function describeHandledFailure(failure: HandledFailure): {
  message: string;
  level: "warning" | "error";
  tags: Record<string, string>;
  fingerprint: string[];
} {
  const tags: Record<string, string> = {
    "failure.operation": failure.operation,
    "failure.cause": failure.cause,
  };
  if (failure.route) tags["failure.route"] = failure.route;
  if (failure.status !== undefined) tags["http.status_code"] = String(failure.status);
  if (failure.failureStage) tags["failure.stage"] = failure.failureStage;
  if (failure.mediaType) tags["media.type"] = failure.mediaType;
  if (failure.requestId) tags.request_id = failure.requestId;
  return {
    message: `${failure.operation} failed: ${failure.cause}${failure.route ? ` (${failure.route})` : ""}`,
    level: failure.level ?? "warning",
    tags,
    fingerprint:
      failure.cause === "network"
        ? ["handled-failure", failure.operation, failure.cause]
        : ["handled-failure", failure.operation, failure.route ?? "-", failure.cause],
  };
}
