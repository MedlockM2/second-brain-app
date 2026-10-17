import { createHttpError, parseErrorResponse } from "@media-summarizer/core/api/httpError";
import { COGNITO_SCOPES, type AuthCodeAction, type CognitoOAuthConfig, type SocialProvider } from "@media-summarizer/core/auth/cognito";
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
export async function startSocialSignIn(provider: SocialProvider): Promise<void> {
  const response = await fetch(`${Config.API_BASE_URL}/api/auth/oauth/config`, { headers });
  if (!response.ok) throw createHttpError("Authentication unavailable", response.status, "AUTH_UNAVAILABLE");
  const config = await response.json() as CognitoOAuthConfig;
  if (config.redirect_uri !== `${window.location.origin}/auth/callback`) throw new Error("OAuth callback configuration mismatch");
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  // Transient PKCE verifier/state only. No session or provider token is persisted.
  sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ verifier, state, createdAt: Date.now() }));
  const url = new URL(`${config.domain}/oauth2/authorize`);
  url.search = new URLSearchParams({ client_id: config.client_id, redirect_uri: config.redirect_uri,
    response_type: "code", scope: COGNITO_SCOPES.join(" "), identity_provider: provider,
    state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  window.location.assign(url);
}

let completion: Promise<void> | null = null;
export function completeSocialSignIn(): Promise<void> {
  if (!completion) {
    completion = (async () => {
      const params = new URLSearchParams(window.location.search);
      const raw = sessionStorage.getItem(OAUTH_KEY);
      sessionStorage.removeItem(OAUTH_KEY);
      window.history.replaceState(null, "", "/auth/callback");
      if (!raw) throw new Error("No pending authorization");
      const pending = JSON.parse(raw) as { state: string; verifier: string; createdAt: number };
      if (!pending.state || params.get("state") !== pending.state || Date.now() - pending.createdAt > 600_000 || !params.get("code") || params.has("error")) {
        throw new Error("Authorization expired or refused");
      }
      await openSession("/oauth/token", { code: params.get("code"), code_verifier: pending.verifier });
    })();
  }
  return completion;
}
