import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { AuthCodeAction, CognitoOAuthConfig, SocialProvider } from "@media-summarizer/core/auth/cognito";
import { COGNITO_SCOPES, hostedUiRefusal } from "@media-summarizer/core/auth/cognito";
import {
  RegisterRequest,
  LoginRequest,
  TokenVerificationResponse,
  AuthUser,
} from "@media-summarizer/core/types/auth";
import { Config } from "../constants/config";
import { createHttpError, parseErrorResponse } from "@media-summarizer/core/api/httpError";
import { apiRequest } from "./apiClient";
import { TokenStorage } from "./tokenStorage";
import { SessionManager } from "./sessionManager";

/**
 * Authentication endpoints for mobile.
 *
 * These are the calls that open or close a session. Everything about keeping one
 * alive — rotating the tokens, deciding what a failure means, purging the
 * keychain — belongs to SessionManager, which is the only caller of the refresh
 * endpoint. There is no refresh entry point here for a screen to reach for.
 *
 * Cognito credentials are carried through the existing secure transport.
 * Key differences from the web frontend:
 * - expo-secure-store instead of localStorage/sessionStorage
 * - the refresh token is stored explicitly: the API returns it in the JSON body
 *   of login/refresh, since a mobile client cannot read an httpOnly
 *   cookie
 * - all storage operations are async
 */
WebBrowser.maybeCompleteAuthSession();

export class AuthService {
  private static async postUnauthenticated<T>(
    path: string,
    body: unknown,
    fallbackMessage: string,
  ): Promise<T> {
    const response = await fetch(`${Config.API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const { message, code } = await parseErrorResponse(
        response,
        fallbackMessage,
      );
      throw createHttpError(message, response.status, code);
    }

    return (await response.json()) as T;
  }

  static async action(path: AuthCodeAction, body: unknown): Promise<void> {
    await this.postUnauthenticated(`/api/auth${path}`, body, "Authentication failed");
  }

  static async register(data: RegisterRequest): Promise<void> {
    await this.action("/register", data);
  }

  static async login(data: LoginRequest): Promise<TokenVerificationResponse> {
    const result = await this.postUnauthenticated<TokenVerificationResponse>(
      "/api/auth/login",
      data,
      "Login failed",
    );
    await SessionManager.persistSession(result);
    return result;
  }

  static async loginWithSocial(provider: SocialProvider): Promise<TokenVerificationResponse | null> {
    if (provider === "SignInWithApple" && Platform.OS === "ios") {
      const proof = await this.appleProof();
      if (!proof) return null;
      const result = await this.postUnauthenticated<TokenVerificationResponse>(
        "/api/auth/apple/native", proof, "Authentication failed",
      );
      await SessionManager.persistSession(result);
      return result;
    }
    const grant = await this.authorize(provider);
    if (!grant) return null;
    const result = await this.postUnauthenticated<TokenVerificationResponse>(
      "/api/auth/oauth/token", grant, "Authentication failed",
    );
    await SessionManager.persistSession(result);
    return result;
  }

  /**
   * Add `provider` to the signed-in account once its address was refused for
   * already having one (task-529). The session proves the account, the fresh
   * provider proof the new identity. false when the person cancels.
   */
  static async linkProvider(provider: SocialProvider): Promise<boolean> {
    if (provider === "SignInWithApple" && Platform.OS === "ios") {
      const proof = await this.appleProof();
      if (!proof) return false;
      await apiRequest("/api/auth/link/apple", { method: "POST", body: proof });
      return true;
    }
    await apiRequest("/api/auth/link/start", { method: "POST", body: { provider } });
    const grant = await this.authorize(provider);
    if (!grant) return false;
    await apiRequest("/api/auth/link/complete", { method: "POST", body: grant });
    return true;
  }

  /** Hosted UI authorization (Google everywhere, Apple off iOS); null when cancelled. */
  private static async authorize(provider: SocialProvider, retried = false): Promise<{ code: string; code_verifier: string } | null> {
    const response = await fetch(`${Config.API_BASE_URL}/api/auth/oauth/config`);
    if (!response.ok) {
      throw createHttpError("Authentication unavailable", response.status, "AUTH_UNAVAILABLE");
    }
    const config = await response.json() as CognitoOAuthConfig;
    const discovery = {
      authorizationEndpoint: `${config.domain}/oauth2/authorize`,
      tokenEndpoint: `${config.domain}/oauth2/token`,
    };
    const request = new AuthSession.AuthRequest({
      clientId: config.client_id, redirectUri: config.redirect_uri,
      responseType: AuthSession.ResponseType.Code, scopes: COGNITO_SCOPES,
      usePKCE: true, extraParams: { identity_provider: provider },
    });
    await request.makeAuthUrlAsync(discovery);
    // A shared-cookie session makes iOS ask « Deepn souhaite utiliser <Cognito
    // domain> », exposing a technical host. A private session skips that alert and
    // also keeps no Cognito cookie that would reopen the last account after logout.
    const outcome = await request.promptAsync(discovery, { preferEphemeralSession: true });
    if (outcome.type === "cancel" || outcome.type === "dismiss") return null;
    if (outcome.type === "error") {
      // The pre sign-up refusal travels in error_description; its raw text is never shown.
      const refusal = hostedUiRefusal(outcome.params.error_description ?? outcome.error?.description);
      if (refusal === "retry" && !retried) return this.authorize(provider, true);
      throw refusal === "retry" ? createHttpError("Authentication failed", 400, "AUTH_UNAVAILABLE") : refusal;
    }
    if (outcome.type !== "success" || !outcome.params.code || !request.codeVerifier) {
      throw createHttpError("Authentication failed", 400, "AUTH_UNAVAILABLE");
    }
    return { code: outcome.params.code, code_verifier: request.codeVerifier };
  }

  /** The Apple sheet's one-use proof for /apple/native or /link/apple; null when cancelled. */
  private static async appleProof(): Promise<{ identity_token: string; authorization_code: string; nonce: string } | null> {
    const nonce = Crypto.randomUUID();
    const state = Crypto.randomUUID();
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
        state,
      });
      if (credential.state !== state || !credential.identityToken || !credential.authorizationCode) {
        throw createHttpError("Authentication failed", 401, "AUTH_APPLE_INVALID");
      }
      return { identity_token: credential.identityToken, authorization_code: credential.authorizationCode, nonce };
    } catch (error) {
      if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
      throw error;
    }
  }

  /** The signed-in profile. GET /api/auth/me */
  static async getCurrentUser(): Promise<AuthUser> {
    return apiRequest<AuthUser>("/api/auth/me");
  }

  /**
   * Close the session on the backend, then locally.
   *
   * The tokens are read here rather than passed in: nothing outside this layer
   * holds them, and the local session is dropped whatever the call answers — a
   * logout the network swallowed must still sign the user out of the device.
   *
   * Log out this device only: the access token says who is signing out, the
   * refresh token says from which device, and the server revokes just that token
   * lineage — so signing out here leaves the account's other devices signed in.
   * With no refresh token stored there is no lineage to close server side, so
   * the local wipe is all that is left to do.
   */
  static async logout(): Promise<void> {
    const accessToken = await TokenStorage.getAccessToken();
    const refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${Config.API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // Ignore network errors during logout - we clear tokens regardless
      }
    }
    await SessionManager.clearSession();
  }
}
