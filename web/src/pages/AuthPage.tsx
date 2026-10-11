import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { Config } from "../config";
import { useI18n } from "../i18n/I18nProvider";
import { AppleSignInButton, type AppleCredential } from "../session/AppleSignInButton";
import { GoogleSignInButton } from "../session/GoogleSignInButton";
import { useSession } from "../session/SessionProvider";
import type { SignInRoute } from "../session/sessionStore";

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

  async function open(route: SignInRoute, body: unknown, failure: (status?: number) => TranslationKey) {
    setBusy(true);
    setError(null);
    try {
      await signIn(route, body);
      navigate(after, { replace: true });
    } catch (caught) {
      setError(failure((caught as { status?: number } | null)?.status));
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void open(register ? "/register" : "/login", { email, password }, (status) => {
      if (!register && status === 401) return "error.invalidCredentials";
      if (register && status === 400) return "error.emailAlreadyExists";
      return register ? "register.failed" : "login.failed";
    });
  };

  const onGoogle = (idToken: string) =>
    void open("/google/native", { id_token: idToken }, () => "auth.google.failed");

  const onApple = ({ identityToken, user }: AppleCredential) =>
    void open("/apple/native", { identity_token: identityToken, user }, () => "auth.apple.failed");

  const hasGoogle = Boolean(Config.GOOGLE_CLIENT_ID);
  const hasApple = Boolean(Config.APPLE_SERVICES_ID && Config.APPLE_REDIRECT_URI);

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
          {hasGoogle && (
            <GoogleSignInButton onIdToken={onGoogle} onError={() => setError("auth.google.failed")} />
          )}
          {hasApple && (
            <AppleSignInButton onCredential={onApple} onError={() => setError("auth.apple.failed")} />
          )}
          {(hasGoogle || hasApple) && <div className="small muted auth-or">{t("auth.or")}</div>}

          <form className="auth-stack" style={{ marginTop: 0 }} onSubmit={onSubmit}>
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
