import { createHttpError, parseErrorResponse } from "@media-summarizer/core/api/httpError";
import { COGNITO_SCOPES, hostedUiRefusal, pendingLinkFrom, type AuthCodeAction, type CognitoOAuthConfig, type PendingLink, type SocialProvider } from "@media-summarizer/core/auth/cognito";
import { apiRequest } from "../api";
import { Config } from "../config";
import { openSession } from "./sessionStore";

const headers = { "X-Session-Transport": "cookie", "Content-Type": "application/json" };
export async function authAction(path: AuthCodeAction, body: unknown): Promise<void> {
  const response = await fetch(`${Config.API_BASE_URL}/api/auth${path}`, {
    method: "POST", credentials: "include", headers, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const { message, code } = await parseErrorResponse(response, "Authentication failed");
    throw createHttpError(message, response.status, code);
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const OAUTH_KEY = "deepn.cognito.authorization";
const LINK_KEY = "deepn.cognito.pendingLink";
type Purpose = "signIn" | "link";
interface PendingAuthorization { verifier: string; state: string; createdAt: number; provider: SocialProvider; purpose: Purpose; retried?: boolean }

/**
 * A social sign-in refused because its address already has an account (task-529).
 * It survives the Hosted UI redirects of the sign-in that follows; it holds no
 * credential, only which provider to add and which methods open the account.
 */
export function pendingLink(): PendingLink | null {
  try {
    const raw = sessionStorage.getItem(LINK_KEY);
    const stored = raw ? JSON.parse(raw) as PendingLink & { createdAt: number } : null;
    return stored && Date.now() - stored.createdAt < 600_000 ? { provider: stored.provider, methods: stored.methods } : null;
  } catch { return null; }
}
export function setPendingLink(link: PendingLink | null): void {
  try {
    if (link) sessionStorage.setItem(LINK_KEY, JSON.stringify({ ...link, createdAt: Date.now() }));
    else sessionStorage.removeItem(LINK_KEY);
  } catch { /* Without storage the link is offered again on the next refusal. */ }
}

export async function startSocialSignIn(provider: SocialProvider, purpose: Purpose = "signIn", retried = false): Promise<void> {
  const response = await fetch(`${Config.API_BASE_URL}/api/auth/oauth/config`, { headers });
  if (!response.ok) throw createHttpError("Authentication unavailable", response.status, "AUTH_UNAVAILABLE");
  const config = await response.json() as CognitoOAuthConfig;
  if (config.redirect_uri !== `${window.location.origin}/auth/callback`) throw new Error("OAuth callback configuration mismatch");
  // The session proves the account; Cognito may then create the provider profile
  // that /link/complete attaches to it.
  if (purpose === "link") await apiRequest("/api/auth/link/start", { method: "POST", body: { provider } });
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  // Transient PKCE verifier/state only. No session or provider token is persisted.
  const pending: PendingAuthorization = { verifier, state, createdAt: Date.now(), provider, purpose, retried };
  sessionStorage.setItem(OAUTH_KEY, JSON.stringify(pending));
  const url = new URL(`${config.domain}/oauth2/authorize`);
  url.search = new URLSearchParams({ client_id: config.client_id, redirect_uri: config.redirect_uri,
    response_type: "code", scope: COGNITO_SCOPES.join(" "), identity_provider: provider,
    state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  window.location.assign(url);
}

/** "done": signed in or linked. "redirecting": another Hosted UI round has started. */
export type SocialCompletion = "done" | "redirecting";

let completion: Promise<SocialCompletion> | null = null;
export function completeSocialSignIn(): Promise<SocialCompletion> {
  if (!completion) {
    completion = (async () => {
      const params = new URLSearchParams(window.location.search);
      const raw = sessionStorage.getItem(OAUTH_KEY);
      sessionStorage.removeItem(OAUTH_KEY);
      window.history.replaceState(null, "", "/auth/callback");
      if (!raw) throw new Error("No pending authorization");
      const pending = JSON.parse(raw) as PendingAuthorization;
      if (!pending.state || params.get("state") !== pending.state || Date.now() - pending.createdAt > 600_000) {
        throw new Error("Authorization expired or refused");
      }
      if (pending.purpose === "link") setPendingLink(null);
      try {
        if (params.has("error") || !params.get("code")) {
          // The pre sign-up refusal travels in error_description; its raw text is never shown.
          const refusal = hostedUiRefusal(params.get("error_description"));
          if (refusal !== "retry") throw refusal;
          if (pending.retried) throw createHttpError("Authentication failed", 400, "AUTH_UNAVAILABLE");
          await startSocialSignIn(pending.provider, pending.purpose, true);
          return "redirecting";
        }
        const grant = { code: params.get("code"), code_verifier: pending.verifier };
        if (pending.purpose === "link") {
          await apiRequest("/api/auth/link/complete", { method: "POST", body: grant });
          return "done";
        }
        await openSession("/oauth/token", grant);
      } catch (error) {
        // Remembered for the sign-in that opens the account holding the address.
        const link = pending.purpose === "signIn" ? pendingLinkFrom(error, pending.provider) : null;
        if (link) setPendingLink(link);
        throw error;
      }
      const link = pendingLink();
      if (!link) return "done";
      await startSocialSignIn(link.provider, "link");
      return "redirecting";
    })();
  }
  return completion;
}
