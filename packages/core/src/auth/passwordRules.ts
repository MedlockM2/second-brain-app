import type { TranslationKey } from "../i18n/runtime";

/**
 * The password policy of the Cognito pool (`password_policy` in
 * `infrastructure/terraform/modules/platform/cognito.tf`), one entry per rule, so
 * the sign-up form can show each rule as a badge that turns green when it is met.
 * If the pool's policy changes, this list changes with it, and nothing else.
 */
export const PASSWORD_RULES: readonly { key: TranslationKey; met: (password: string) => boolean }[] = [
  { key: "auth.rule.length", met: (password) => password.length >= 12 },
  { key: "auth.rule.upper", met: (password) => /[A-Z]/.test(password) },
  { key: "auth.rule.lower", met: (password) => /[a-z]/.test(password) },
  { key: "auth.rule.digit", met: (password) => /[0-9]/.test(password) },
];

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.met(password));
}
