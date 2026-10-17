import type { TranslationKey } from "../i18n/runtime";

export type SocialProvider = "Google" | "SignInWithApple";
export interface CognitoOAuthConfig {
  domain: string;
  client_id: string;
  redirect_uri: string;
}
export type AuthCodeAction = "/register" | "/confirm-registration" | "/resend-confirmation" | "/forgot-password" | "/confirm-password";

/** Same codes and translations on every platform; provider prose never reaches a screen. */
export function authErrorKey(error: unknown): TranslationKey {
  const code = (error as { code?: string } | null)?.code;
  const keys: Record<string, TranslationKey> = {
    AUTH_CODE_INVALID: "auth.codeInvalid",
    AUTH_CODE_EXPIRED: "auth.codeExpired",
    AUTH_PASSWORD_POLICY: "auth.passwordPolicy",
    AUTH_RATE_LIMITED: "auth.rateLimited",
    AUTH_RESET_REQUIRED: "auth.resetRequired",
    EMAIL_NOT_VERIFIED: "error.emailNotVerified",
    INVALID_CREDENTIALS: "error.invalidCredentials",
  };
  return (code && keys[code]) || "auth.unavailable";
}

export const COGNITO_SCOPES = ["openid", "email", "aws.cognito.signin.user.admin"];
