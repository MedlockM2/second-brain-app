import { authErrorKey, type SocialProvider } from "@media-summarizer/core/auth/cognito";
import { authAction, startSocialSignIn } from "../session/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const register = mode === "register";

  const after = (location.state as { from?: string } | null)?.from ?? "/";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (register) {
        await authAction("/register", { email, password });
        setPassword("");
        navigate("/verify-email", { state: { email } });
      } else {
        await signIn("/login", { email, password });
        navigate(after, { replace: true });
      }
    } catch (caught) {
      if ((caught as { code?: string }).code === "EMAIL_NOT_VERIFIED") {
        navigate("/verify-email", { state: { email } });
      } else { setError(authErrorKey(caught)); }
    } finally { setBusy(false); }
  }
  async function social(provider: SocialProvider) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await startSocialSignIn(provider); }
    catch (caught) { setError(authErrorKey(caught)); setBusy(false); }
  }

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

        <div className="auth-stack">
          <button type="button" className="btn" disabled={busy} onClick={() => void social("Google")}>{t("auth.continueWithGoogle")}</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void social("SignInWithApple")}>{t("auth.signInWithApple")}</button>
          <div className="small muted auth-or">{t("auth.or")}</div>

          <form className="auth-stack" style={{ marginTop: 0 }} onSubmit={(event) => void submit(event)}>
            <label className="field">
              <span className="visually-hidden">{t("auth.email")}</span>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="visually-hidden">{t("auth.password")}</span>
              <input
                type="password"
                minLength={register ? 12 : undefined}
                maxLength={256}
                disabled={busy}
                autoComplete={register ? "new-password" : "current-password"}
                required
                placeholder={t(register ? "register.passwordPlaceholder" : "login.passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <div className="banner-err" role="alert">
                <Icon name="alert-circle-outline" size={18} />
                <span>{t(error)}</span>
              </div>
            )}
            <button type="submit" className="btn primary" disabled={busy}>
              {t(register ? "register.submit" : "login.submit")}
            </button>
            {!register && <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>}
            {register && <p className="small subtle">{t("auth.passwordPolicy")}</p>}
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
