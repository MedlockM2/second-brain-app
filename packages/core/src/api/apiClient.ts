import { createHttpError, parseErrorResponse, type HttpError } from "./httpError";

/**
 * The header that ties one app call to the server's log lines for it
 * (task-610). The API's `request_id_middleware` takes it as is, binds it to
 * every log line of the request and echoes it on the response.
 */
export const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * The request id of the call an error comes from, when the shared client
 * raised it: an HTTP refusal, or a transport failure (offline, timeout) that
 * never got an answer. The crash reporters tag events with it.
 */
export function requestIdOf(error: unknown): string | undefined {
  const value =
    typeof error === "object" && error !== null
      ? (error as HttpError).requestId
      : undefined;
  return typeof value === "string" ? value : undefined;
}

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
  /** A fresh random id (a UUID) for the `X-Request-ID` of one request. */
  newRequestId: () => string;
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
  requestId: string,
): Promise<T> {
  if (!response.ok) {
    const { message, code, quotaErrorCode, details } = await parseErrorResponse(
      response,
      fallbackMessage,
    );
    const error = createHttpError(
      message,
      response.status,
      code,
      quotaErrorCode,
      details,
    );
    error.requestId = requestId;
    throw error;
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

    // One id per HTTP request: the replay after a refused token gets its own,
    // and the error carries the id of the attempt that actually failed.
    let requestId = "";
    const response = await sendAuthenticated(async (accessToken) => {
      requestId = platform.newRequestId();
      const init: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders,
          Authorization: `Bearer ${accessToken}`,
          [REQUEST_ID_HEADER]: requestId,
        },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      try {
        return await platform.fetch(url, init);
      } catch (error) {
        // A transport failure has no response to read an id from: the app
        // keeps the one it sent, which the API logged if the request arrived.
        if (typeof error === "object" && error !== null) {
          (error as HttpError).requestId = requestId;
        }
        throw error;
      }
    });

    return parseResponse<T>(
      response,
      `Request failed: ${method} ${path}`,
      requestId,
    );
  }

  return { sendAuthenticated, apiRequest };
}
