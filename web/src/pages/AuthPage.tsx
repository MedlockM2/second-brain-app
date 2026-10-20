import { authErrorKey, pendingLinkMessage, type SocialProvider } from "@media-summarizer/core/auth/cognito";
import { authAction, pendingLink, setPendingLink, startSocialSignIn } from "../session/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthCodePage } from "./AuthCodePage";
import { PasswordField } from "../components/PasswordField";

/**
 * Sign in and sign up (capture 19-connexion.png): Google, Apple, then email and
 * password. A new account goes on to the reading-language step; so does any
 * account that has never chosen one, whichever way it signed in.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [verification, setVerification] = useState<LoginRequest | null>(null);
  const register = mode === "register";

  const after = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setAccountExists(false);
    const credentials = { email: email.trim(), password };
    try {
      if (register) {
        await authAction("/register", credentials);
        setVerification(credentials);
        setPassword("");
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

  return (
    <div className="center-page">
      <div className="card auth-card">
        <div className="row" style={{ marginBottom: 24 }}>
          <LogoMark large />
          <b className="headline">Deepn</b>
        </div>
        <h1 className="display">{t(register ? "register.title" : "login.title")}</h1>
        <p className="subtle" style={{ marginTop: 4 }}>
          {t(register ? "register.subtitle" : "login.subtitle")}
        </p>

        {link && !register && <p className="subtle" role="status" style={{ marginTop: 16 }}>{pendingLinkMessage(t, link)}</p>}

        <div className="auth-stack">
          <button type="button" className="btn" disabled={busy} onClick={() => void social("Google")}>{t("auth.continueWithGoogle")}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void social("SignInWithApple")}>{t("auth.signInWithApple")}</button>
          <div className="small muted auth-or">{t("auth.or")}</div>

          <form className="auth-stack" style={{ marginTop: 0 }} onSubmit={(event) => void submit(event)}>
            <div className="auth-field">
              <label htmlFor="auth-email">{t("auth.email")}</label>
              <div className="field">
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(event) => { setEmail(event.target.value); setAccountExists(false); }}
              />
              </div>
            </div>
            <PasswordField
                label={t("auth.password")}
                hint={register ? t("auth.passwordPolicy") : undefined}
                minLength={register ? 12 : undefined}
                maxLength={256}
                disabled={busy}
                autoComplete={register ? "new-password" : "current-password"}
                required
                placeholder={t(register ? "register.passwordPlaceholder" : "login.passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            {error && (
              <div className="banner-err" role="alert">
                <Icon name="alert-circle-outline" size={18} />
                <span>{t(error)}</span>
              </div>
            )}
            {accountExists && (
              <div className="banner-err" role="alert">
                <Icon name="alert-circle-outline" size={18} />
                <span>
                  {t("error.emailAlreadyExists")}{" "}
                  <Link to="/login" state={{ ...(location.state as object | null), email: email.trim() }}>{t("register.signInLink")}</Link>
                  {" · "}
                  <Link to="/forgot-password" state={{ ...(location.state as object | null), email: email.trim() }}>{t("auth.forgotPassword")}</Link>
                </span>
              </div>
            )}
            <button type="submit" className="btn primary" disabled={busy}>
              {t(register ? "register.submit" : "login.submit")}
            </button>
            {!register && <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>}
          </form>
        </div>

        <p className="small subtle auth-switch">
          {t(register ? "register.hasAccount" : "login.noAccount")}{" "}
          <Link to={register ? "/login" : "/register"} state={location.state}>
            {t(register ? "register.signInLink" : "login.signUpLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
