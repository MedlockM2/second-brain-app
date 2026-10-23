import { authErrorKey, pendingLinkMessage, type SocialProvider } from "@media-summarizer/core/auth/cognito";
import { meetsPasswordPolicy } from "@media-summarizer/core/auth/passwordRules";
import { authAction, pendingLink, setPendingLink, startSocialSignIn } from "../session/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthCodePage } from "./AuthCodePage";
import { AuthField, PasswordRules, SlotText } from "../components/AuthField";
import { AuthSplit } from "../components/welcome/AuthSplit";

const TERMS_URL = "https://mediasummarizer.com/terms";
const PRIVACY_POLICY_URL = "https://mediasummarizer.com/privacy";

/**
 * Sign in and sign up, beside the welcome carousel: Apple, Google, « or », then
 * the e-mail form at once. Sign-up shows the password rules as badges and asks
 * for the password twice. A new account goes on to the e-mail code, then to the
 * reading language, like any account that has never chosen one.
 */
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "");
  // A social sign-in refused for an address that already has an account (task-529).
  const [link] = useState(pendingLink);
  const [accountExists, setAccountExists] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmationLeft, setConfirmationLeft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [verification, setVerification] = useState<LoginRequest | null>(null);
  const register = mode === "register";
  const matches = confirmation.length > 0 && confirmation === password;
  const ready = !register || (email.trim().length > 0 && meetsPasswordPolicy(password) && matches);

  const after = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true); setError(null); setAccountExists(false);
    const credentials = { email: email.trim(), password };
    try {
      if (register) {
        await authAction("/register", credentials);
        setVerification(credentials);
        setPassword(""); setConfirmation("");
      } else {
        await signIn("/login", credentials);
        if (link) {
          // Signed in to the account holding the address: add the refused provider.
          try { await startSocialSignIn(link.provider, "link"); return; }
          catch { setPendingLink(null); }
        }
        navigate(after, { replace: true });
      }
    } catch (caught) {
      if (register && (caught as { code?: string }).code === "AUTH_ACCOUNT_EXISTS") {
        setAccountExists(true);
      } else if ((caught as { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        setVerification(credentials);
        setPassword("");
      } else { setError(authErrorKey(caught)); }
    } finally { setBusy(false); }
  }
  async function social(provider: SocialProvider) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await startSocialSignIn(provider); }
    catch (caught) { setError(authErrorKey(caught)); setBusy(false); }
  }

  // Keep credentials in this mounted form only, never in router state or storage.
  // Leaving the verification flow unmounts the form and drops them.
  if (verification) return <AuthCodePage recovery={false} credentials={verification} onCancel={() => setVerification(null)} />;

  const routeState = { ...(location.state as object | null), email: email.trim() };
  const wrongPassword = !register && error === "error.invalidCredentials";
  const formError = error && !wrongPassword ? error : null;

  return (
    <AuthSplit>
      <h1 className="display auth-title">{t(register ? "register.title" : "login.title")}</h1>
      <p className="subtle auth-subtitle">{t(register ? "register.subtitle" : "login.subtitle")}</p>

      {link && !register && <p className="auth-notice" role="status">{pendingLinkMessage(t, link)}</p>}

      <div className="auth-providers">
        <button type="button" className="btn auth-provider apple" disabled={busy} onClick={() => void social("SignInWithApple")}>
          <Icon name="logo-apple" size={18} />{t("auth.continueWithApple")}
        </button>
        <button type="button" className="btn auth-provider google" disabled={busy} onClick={() => void social("Google")}>
          <Icon name="logo-google" size={18} />{t("auth.continueWithGoogle")}
        </button>
        <div className="auth-or"><span>{t("auth.or")}</span></div>
      </div>

      <form className="auth-stack" onSubmit={(event) => void submit(event)}>
        <AuthField label={t("auth.email")} type="email" autoComplete="email" required
          placeholder={t("auth.emailPlaceholder")} value={email} disabled={busy}
          onChange={(event) => { setEmail(event.target.value); setAccountExists(false); setError(null); }} />

        {accountExists ? (
          <div className="auth-exists" role="status">
            <div className="row" style={{ gap: 8 }}><Icon name="person-circle-outline" size={18} /><b>{t("register.existsTitle")}</b></div>
            <p className="small subtle" style={{ margin: 0 }}>{t("register.existsBody")}</p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Link className="btn primary" to="/login" state={routeState}>{t("login.submit")}</Link>
              <Link className="btn tonal" to="/forgot-password" state={routeState}>{t("auth.forgotPasswordAction")}</Link>
            </div>
          </div>
        ) : <>
          <AuthField secure label={t("auth.password")}
            labelAccessory={register ? undefined : <Link className="auth-accessory" to="/forgot-password" state={routeState}>{t("auth.forgotPassword")}</Link>}
            minLength={register ? 12 : undefined} maxLength={256} disabled={busy} required
            autoComplete={register ? "new-password" : "current-password"}
            placeholder={t(register ? "register.passwordPlaceholder" : "login.passwordPlaceholder")}
            value={password} onChange={(event) => { setPassword(event.target.value); setError(null); }}
            message={wrongPassword ? { tone: "error", content: <SlotText template={t("login.wrongPassword")}
              slots={{ reset: <Link to="/forgot-password" state={routeState}>{t("login.resetLink")}</Link> }} /> } : undefined}>
            {register && <PasswordRules password={password} />}
          </AuthField>
          {register && <AuthField secure label={t("auth.confirmPassword")} maxLength={256} disabled={busy} required
            autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            onBlur={() => setConfirmationLeft(true)}
            message={matches && meetsPasswordPolicy(password)
              ? { tone: "success", content: t("auth.passwordsMatch") }
              : confirmationLeft && confirmation.length > 0 && !matches
                ? { tone: "error", content: t("auth.passwordsMismatch") } : undefined} />}
          {formError && (
            <div className="banner-err" role="alert">
              <Icon name="alert-circle-outline" size={18} />
              <span>{t(formError)}</span>
            </div>
          )}
          <button type="submit" className="btn primary auth-submit" disabled={busy || !ready}>
            {t(register ? "register.submit" : "login.submit")}
          </button>
        </>}
      </form>

      {register && !accountExists && <p className="small subtle auth-legal">
        <SlotText template={t("register.legal")} slots={{
          terms: <a href={TERMS_URL} target="_blank" rel="noreferrer">{t("paywall.terms")}</a>,
          privacy: <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">{t("paywall.privacy")}</a>,
        }} />
      </p>}

      <p className="small subtle auth-switch">
        {t(register ? "register.hasAccount" : "login.noAccount")}{" "}
        <Link to={register ? "/login" : "/register"} state={location.state}>
          {t(register ? "register.signInLink" : "login.signUpLink")}
        </Link>
      </p>
    </AuthSplit>
  );
}
