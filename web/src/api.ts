import { createApiClient, type RequestOptions } from "@media-summarizer/core/api/apiClient";
import { Config } from "./config";
import { invalidateResources } from "./lib/resourceCache";
import {
  getAccessToken,
  refreshAccessToken,
  SESSION_EXPIRED_CODE,
  SESSION_EXPIRED_MESSAGE,
} from "./session/sessionStore";

/**
 * The web app's API client: the shared client of `packages/core`, bound to the
 * API host of this build, the browser's `fetch` and the in-memory session.
 * Ordinary calls carry the bearer token only; the refresh cookie is scoped to
 * /api/auth and never rides along.
 */
const client = createApiClient({
  baseUrl: Config.API_BASE_URL,
  fetch: (url, init) => fetch(url, init),
  getAccessToken,
  refreshAccessToken,
  sessionExpired: { message: SESSION_EXPIRED_MESSAGE, code: SESSION_EXPIRED_CODE },
});

export const { sendAuthenticated } = client;

/**
 * The shared client's request, plus one rule of the reading cache: a write that
 * succeeded marks what the cache holds stale (`lib/resourceCache.ts`).
 */
export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await client.apiRequest<T>(path, options);
  if (options.method && options.method !== "GET") invalidateResources();
  return result;
}
