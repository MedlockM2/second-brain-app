import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../i18n/I18nProvider";
import { authAction } from "../session/cognito";
import { useSession } from "../session/SessionProvider";
import type { LoginRequest } from "@media-summarizer/core/types/auth";

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
  const [step, setStep] = useState<"email" | "code" | "signIn" | "done">(recovery ? "email" : "code");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  async function send() {
    if (busy || !email.trim()) return;
    setBusy(true); setError(null); setSent(false);
    try {
      await authAction(recovery ? "/forgot-password" : "/resend-confirmation", { email: email.trim() });
      setStep("code"); setSent(true);
    } catch (caught) { setError(authErrorKey(caught)); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step === "email") { await send(); return; }
    setBusy(true); setError(null);
    try {
      if (recovery) {
        await authAction("/confirm-password", { email: email.trim(), code: code.trim(), password });
        setCode(""); setPassword(""); setStep("done");
      } else {
        if (step === "code") {
          await authAction("/confirm-registration", { email: email.trim(), code: code.trim() });
          // A failed sign-in retries only the password, never the consumed code.
          setStep("signIn"); setCode("");
        }
        await signIn("/login", { email: email.trim(), password });
        setPassword("");
        navigate(routeState?.from ?? "/", { replace: true });
      }
    } catch (caught) { setError(authErrorKey(caught)); }
    finally { setBusy(false); }
  }
  if (step === "signIn" && busy) return <div className="center-page"><p role="status">{t("common.loading")}</p></div>;
  return <div className="center-page"><div className="card auth-card">
    <h1 className="display">{t(step === "signIn" ? "login.title" : recovery ? "auth.recoveryTitle" : "auth.verificationTitle")}</h1>
    <p className="subtle">{t(step === "signIn" ? "auth.verified" : recovery ? "auth.recoveryHint" : "auth.verificationHint")}</p>
    {step === "done" ? <p role="status">{t("auth.passwordChanged")}</p> :
      <form className="auth-stack" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <label className="field"><span>{t("auth.email")}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} readOnly={step !== "email" && Boolean(initialEmail)} />
        </label>
        {step === "code" && <>
          {sent && <p role="status">{t("auth.codeSent")}</p>}
          <label className="field"><span>{t("auth.code")}</span>
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
          </label>
        </>}
        {((recovery && step === "code") || (!recovery && (!credentials || step === "signIn"))) &&
          <label className="field"><span>{t(recovery ? "auth.newPassword" : "auth.password")}</span>
            <input type="password" autoComplete={recovery ? "new-password" : "current-password"} minLength={recovery ? 12 : undefined} maxLength={256} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            {recovery && <span className="small subtle">{t("auth.passwordPolicy")}</span>}
          </label>}
        {error && <p className="banner-err" role="alert">{t(error)}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{t(busy ? "common.loading" : step === "email" ? "auth.sendCode" : step === "signIn" ? "login.submit" : recovery ? "auth.savePassword" : "auth.confirmCode")}</button>
        {step === "code" && <button className="btn" type="button" disabled={busy} onClick={() => void send()}>{t("auth.resendCode")}</button>}
      </form>}
    <p className="auth-switch"><Link to="/login" state={routeState?.from ? { from: routeState.from } : undefined} aria-disabled={busy} onClick={(event) => {
      if (busy) event.preventDefault();
      else onCancel?.();
    }}>{t("auth.backToLogin")}</Link></p>
  </div></div>;
}
