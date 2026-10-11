import { createApiClient } from "@media-summarizer/core/api/apiClient";
import { Config } from "./config";
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
export const { sendAuthenticated, apiRequest } = createApiClient({
  baseUrl: Config.API_BASE_URL,
  fetch: (url, init) => fetch(url, init),
  getAccessToken,
  refreshAccessToken,
  sessionExpired: { message: SESSION_EXPIRED_MESSAGE, code: SESSION_EXPIRED_CODE },
});
