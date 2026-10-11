import {
  createHttpError,
  parseErrorResponse,
} from "@media-summarizer/core/api/httpError";
import type { AuthUser, WebSessionResponse } from "@media-summarizer/core/types/auth";
import { Config } from "../config";

/**
 * The single owner of the web session (task-473, docs/AUTHENTICATION_SETUP.md).
 *
 * The refresh token is an HttpOnly cookie set by the API host: this code never
 * sees it, and only asks for it to be sent (`credentials: "include"`) on the
 * /api/auth routes. The access token lives in this module's memory and nowhere
 * else — never in localStorage, where any script on the page could read it. A
 * reload therefore starts with no access token and reopens the session with one
 * /refresh, carried by the cookie.
 *
 * Every rotation goes through `refreshAccessToken`, which hands concurrent
 * callers the same promise: the refresh token is single-use.
 */

/** Selects the cookie transport on the API (api/dependencies/session.py). */
const TRANSPORT_HEADERS = { "X-Session-Transport": "cookie" } as const;

/** The code the shared API client raises when there is no session to send with. */
export const SESSION_EXPIRED_CODE = "SESSION_EXPIRED";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

/** A token is rotated this long before it expires, so a request never leaves with a dying one. */
const REFRESH_BUFFER_MS = 30_000;

export type SessionEvent =
  | { type: "opened"; user: AuthUser }
  | { type: "refreshed"; user: AuthUser }
  | { type: "closed" };

type Listener = (event: SessionEvent) => void;

let accessToken: string | null = null;
let expiresAt = 0;
let inflightRefresh: Promise<string> | null = null;
const listeners = new Set<Listener>();

function emit(event: SessionEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function onSessionEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** When the access token in hand expires (epoch ms), or 0 without a session. */
export function accessTokenExpiresAt(): number {
  return accessToken ? expiresAt : 0;
}

function adopt(payload: WebSessionResponse): void {
  accessToken = payload.access_token;
  expiresAt = Date.now() + payload.expires_in * 1000;
}

function forget(): void {
  accessToken = null;
  expiresAt = 0;
}

function authPost(
  path: string,
  { body, bearer }: { body?: unknown; bearer?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...TRANSPORT_HEADERS };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return fetch(`${Config.API_BASE_URL}/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function refuse(response: Response, fallback: string): Promise<never> {
  const { message, code, details } = await parseErrorResponse(response, fallback);
  throw createHttpError(message, response.status, code, undefined, details);
}

/** The routes that open a session: they answer with the user and set the cookie. */
export type SignInRoute = "/login" | "/register" | "/google/native" | "/apple/native";

export async function openSession(route: SignInRoute, body: unknown): Promise<AuthUser> {
  const response = await authPost(route, { body });
  if (!response.ok) await refuse(response, `Sign-in failed: ${route}`);
  const payload = (await response.json()) as WebSessionResponse;
  adopt(payload);
  emit({ type: "opened", user: payload.user });
  return payload.user;
}

/**
 * A fresh access token, rotated through the cookie.
 *
 * A 401 means the cookie is gone, expired or revoked: the session is over and
 * the error carries `SESSION_EXPIRED`. Anything else (no network, a 5xx) keeps
 * the session as it is and rejects with the transport error, for the caller to
 * retry.
 */
export function refreshAccessToken(): Promise<string> {
  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      const response = await authPost("/refresh");
      if (response.status === 401) {
        forget();
        emit({ type: "closed" });
        throw createHttpError(SESSION_EXPIRED_MESSAGE, 401, SESSION_EXPIRED_CODE);
      }
      if (!response.ok) await refuse(response, "Session refresh failed");
      const payload = (await response.json()) as WebSessionResponse;
      adopt(payload);
      emit({ type: "refreshed", user: payload.user });
      return payload.access_token;
    })().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

/** The access token to send now, rotated first if it is about to expire; null without a session. */
export async function getAccessToken(): Promise<string | null> {
  if (!accessToken) return null;
  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) return accessToken;
  return refreshAccessToken();
}

/** Close this browser's session: revoke its lineage and drop the cookie. */
export async function closeSession(): Promise<void> {
  // /logout authenticates the caller: a token that died while the tab sat idle
  // would leave the lineage alive and the cookie in place.
  const bearer = await getAccessToken().catch(() => null);
  forget();
  try {
    if (bearer) await authPost("/logout", { bearer });
  } finally {
    // Signed out here whatever the network said: the lineage expires on its own.
    emit({ type: "closed" });
  }
}
