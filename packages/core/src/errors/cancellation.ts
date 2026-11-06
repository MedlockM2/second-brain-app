import { isResourceSuperseded } from "../cache/resourceCache";

/**
 * Whether an error is the app cancelling its own work, not something failing
 * (task-609).
 *
 * Two kinds, both deliberate:
 * - `ResourceSupersededError`: the resource cache dropped a read that a newer
 *   one, an account switch or a language change made obsolete;
 * - `AbortError`: a `fetch` the app aborted through its `AbortController`
 *   (a chat stream closed by the screen, a request given up on a timeout).
 *
 * Shared by the mobile and web `beforeSend`, so neither reports one as an
 * issue. Matched on the type or the error name only, never on a message: a
 * generic message such as "Network request failed" is a real failure.
 */
export function isNormalCancellation(error: unknown): boolean {
  if (isResourceSuperseded(error)) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
