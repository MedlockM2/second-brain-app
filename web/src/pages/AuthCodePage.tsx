import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../i18n/I18nProvider";
import { authAction } from "../session/cognito";
import { useSession } from "../session/SessionProvider";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { PasswordField } from "../components/PasswordField";

export function AuthCodePage({ recovery, credentials, onCancel }: { recovery: boolean; credentials?: LoginRequest; onCancel?: () => void }) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useSession();
  const routeState = location.state as { email?: string; from?: string } | null;
  const initialEmail = credentials?.email ?? routeState?.email;
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState(credentials?.password ?? "");
  const [step, setStep] = useState<"email" | "code" | "signIn">(recovery ? "email" : "code");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  async function send() {
    if (busy || !email.trim()) return;
    setBusy(true); setError(null); setSent(false);
    try {
      await authAction(recovery ? "/forgot-password" : "/resend-confirmation", { email: email.trim() });
      setStep("code"); setSent(step === "code");
    } catch (caught) { setError(authErrorKey(caught)); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step === "email") { await send(); return; }
    setBusy(true); setError(null);
    try {
      if (step === "code") {
        await authAction(recovery ? "/confirm-password" : "/confirm-registration", {
          email: email.trim(), code: code.trim(), ...(recovery ? { password } : {}),
        });
        // A failed sign-in retries only the password, never the consumed code.
        setStep("signIn"); setCode("");
      }
      await signIn("/login", { email: email.trim(), password });
      setPassword("");
      navigate(routeState?.from ?? "/", { replace: true });
    } catch (caught) { setError(authErrorKey(caught)); }
    finally { setBusy(false); }
  }
  const titleKey = step === "signIn" ? "login.title" : recovery
    ? step === "email" ? "auth.recoveryTitle" : "auth.newPassword" : "auth.verificationTitle";
  const hintKey = step === "signIn" ? recovery ? "auth.passwordChanged" : "auth.verified" : recovery
    ? step === "email" ? "auth.recoveryHint" : "auth.recoveryCodeHint" : "auth.verificationHint";
  if (step === "signIn" && busy) return <div className="center-page"><p role="status">{t("common.loading")}</p></div>;
  return <div className="center-page"><div className="card auth-card">
    <h1 className="display">{t(titleKey)}</h1>
    <p className="subtle">{t(hintKey)}</p>
      <form className="auth-stack" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        {recovery && step === "code" ? <div className="auth-recipient small subtle">
          <span>{email}</span>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => {
            setStep("email"); setCode(""); setPassword(""); setSent(false); setError(null);
          }}>{t("auth.changeEmail")}</button>
        </div> : <div className="auth-field">
          <label htmlFor="code-email">{t("auth.email")}</label>
          <div className="field"><input id="code-email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={busy} readOnly={step !== "email" && Boolean(initialEmail)} /></div>
        </div>}
        {step === "code" && <>
          {sent && <p role="status">{t("auth.codeSent")}</p>}
          <div className="auth-field">
            <label htmlFor="verification-code">{t("auth.code")}</label>
            <div className="field"><input id="verification-code" autoComplete="one-time-code" inputMode="numeric" required value={code}
              onChange={(e) => setCode(e.target.value)} disabled={busy} /></div>
          </div>
        </>}
        {(step === "signIn" || (step === "code" && (recovery || !credentials))) &&
          <PasswordField label={t(recovery && step === "code" ? "auth.newPassword" : "auth.password")}
            hint={recovery && step === "code" ? t("auth.passwordPolicy") : undefined}
            autoComplete={recovery && step === "code" ? "new-password" : "current-password"}
            minLength={recovery && step === "code" ? 12 : undefined} maxLength={256} required value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={busy} />}
        {error && <p className="banner-err" role="alert">{t(error)}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{t(busy ? "common.loading" : step === "email" ? "auth.sendCode" : step === "signIn" ? "login.submit" : recovery ? "auth.savePassword" : "auth.confirmCode")}</button>
        {step === "code" && <button className="btn" type="button" disabled={busy} onClick={() => void send()}>{t("auth.resendCode")}</button>}
      </form>
    <p className="auth-switch"><Link to="/login" state={routeState?.from ? { from: routeState.from } : undefined} aria-disabled={busy} onClick={(event) => {
      if (busy) event.preventDefault();
      else onCancel?.();
    }}>{t("auth.backToLogin")}</Link></p>
  </div></div>;
}
