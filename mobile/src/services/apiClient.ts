import { createApiClient } from "@media-summarizer/core/api/apiClient";
import { Config } from "../constants/config";
import { SessionManager } from "./sessionManager";

/**
 * The mobile app's API client: the shared client of `packages/core`, bound to
 * the API host of this build, React Native's `fetch` and the keychain session.
 */
export const { sendAuthenticated, apiRequest } = createApiClient({
  baseUrl: Config.API_BASE_URL,
  fetch: (url, init) => fetch(url, init),
  getAccessToken: () => SessionManager.getAccessToken(),
  refreshAccessToken: () => SessionManager.refreshAccessToken(),
  sessionExpired: {
    message: SessionManager.SESSION_EXPIRED_MESSAGE,
    code: SessionManager.SESSION_EXPIRED_CODE,
  },
});
