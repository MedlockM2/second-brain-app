import { createHttpError, parseErrorResponse } from "./httpError";

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * What an app hands the client: where the API lives, how a request leaves, and
 * how the session's access token is read and rotated.
 *
 * None of it is imported here. The mobile app keeps its token in the keychain
 * and sends through React Native's `fetch`; the web app keeps its session in a
 * refresh cookie. The client only knows the order of operations.
 */
export type ApiClientPlatform = {
  baseUrl: string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** The current access token, or null when there is no session at all. */
  getAccessToken: () => Promise<string | null>;
  /** A fresh access token; rejects with a session-expired error when it cannot. */
  refreshAccessToken: () => Promise<string>;
  /** The error raised when there is no session to send with. */
  sessionExpired: { message: string; code: string };
};

export type ApiClient = {
  sendAuthenticated: <R extends { status: number }>(
    send: (accessToken: string) => Promise<R>,
  ) => Promise<R>;
  apiRequest: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>;
};

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    const { message, code, quotaErrorCode, details } = await parseErrorResponse(
      response,
      fallbackMessage,
    );
    throw createHttpError(
      message,
      response.status,
      code,
      quotaErrorCode,
      details,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Base API client for every authenticated call.
 *
 * The bearer token is resolved here, at the moment the request leaves — never
 * handed in by a screen, which could only ever pass a copy taken when it
 * rendered. That is what makes the 401 interceptor possible: on a refusal it
 * rotates the session once and replays the request with the token it just
 * obtained, and only propagates the error if that replay fails too.
 */
export function createApiClient(platform: ApiClientPlatform): ApiClient {
  async function sendAuthenticated<R extends { status: number }>(
    send: (accessToken: string) => Promise<R>,
  ): Promise<R> {
    const accessToken = await platform.getAccessToken();
    if (!accessToken) {
      throw createHttpError(
        platform.sessionExpired.message,
        401,
        platform.sessionExpired.code,
      );
    }

    const response = await send(accessToken);
    if (response.status !== 401) {
      return response;
    }

    // The token was refused mid-flight (clock skew, an expiry we read as still
    // valid, a rotation from another path). One refresh, one replay, then
    // whatever comes back is the answer — a second 401 is not a transport problem.
    const refreshedToken = await platform.refreshAccessToken();
    return send(refreshedToken);
  }

  async function apiRequest<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { method = "GET", body, headers: extraHeaders } = options;
    const url = `${platform.baseUrl}${path}`;

    const response = await sendAuthenticated((accessToken) => {
      const init: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders,
          Authorization: `Bearer ${accessToken}`,
        },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      return platform.fetch(url, init);
    });

    return parseResponse<T>(response, `Request failed: ${method} ${path}`);
  }

  return { sendAuthenticated, apiRequest };
}
