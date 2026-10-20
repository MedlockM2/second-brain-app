import { createHttpError } from "../api/httpError";
import type { TranslationKey, TranslationParams } from "../i18n/runtime";

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
    AUTH_APPLE_INVALID: "auth.appleFailed",
    AUTH_ACCOUNT_EXISTS: "error.emailAlreadyExists",
    AUTH_SOCIAL_ONLY: "auth.socialOnly",
    AUTH_LINK_EXPIRED: "auth.linkExpired",
    AUTH_PROVIDER_IN_USE: "auth.providerInUse",
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

export type SignInMethod = "password" | "apple" | "google";
const METHODS: SignInMethod[] = ["password", "apple", "google"];

/**
 * A social sign-in refused because its address already belongs to an account
 * (task-529): the person signs in with one of `methods`, then `provider` is linked.
 */
export interface PendingLink {
  provider: SocialProvider;
  methods: SignInMethod[];
}

/** The pending link a refusal carries, from the API (409 detail) or the Hosted UI redirect. */
export function pendingLinkFrom(error: unknown, provider: SocialProvider): PendingLink | null {
  const refusal = error as { code?: string; details?: { methods?: unknown } } | null;
  if (refusal?.code !== "AUTH_ACCOUNT_EXISTS" || !Array.isArray(refusal.details?.methods)) return null;
  const methods = METHODS.filter((method) => (refusal.details?.methods as unknown[]).includes(method));
  return methods.length ? { provider, methods } : null;
}

/**
 * Read the error Cognito puts on the redirect when the pre sign-up trigger refuses:
 * `PreSignUp failed with error AUTH_ACCOUNT_EXISTS:password,apple.`. "retry" is the
 * first sign-in after the trigger linked a known Apple subject, which AWS documents
 * as failing once with "Already found an entry for username".
 */
export function hostedUiRefusal(description: string | null | undefined): Error | "retry" {
  if (description && /Already found an entry for username/i.test(description)) return "retry";
  const match = description?.match(/AUTH_ACCOUNT_EXISTS(?::([a-z,]*))?/);
  if (match) {
    return createHttpError("Account exists", 409, "AUTH_ACCOUNT_EXISTS", undefined, { methods: (match[1] ?? "").split(",") });
  }
  return createHttpError("Authentication failed", 400, "AUTH_UNAVAILABLE");
}

/** « Connectez-vous avec Apple ou votre mot de passe pour y ajouter Google. » */
export function pendingLinkMessage(t: (key: TranslationKey, params?: TranslationParams) => string, link: PendingLink): string {
  const names = link.methods.map((method) => t(`auth.method.${method}`));
  const methods = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${t("auth.or")} ${names[names.length - 1]}` : names[0];
  return t("auth.linkRequired", { methods, provider: t(link.provider === "Google" ? "auth.method.google" : "auth.method.apple") });
}
