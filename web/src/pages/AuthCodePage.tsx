import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../i18n/I18nProvider";
import { authAction } from "../session/cognito";

export function AuthCodePage({ recovery }: { recovery: boolean }) {
  const { t } = useI18n();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email;
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">(recovery ? "email" : "code");
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
      await authAction(recovery ? "/confirm-password" : "/confirm-registration", {
        email: email.trim(), code: code.trim(), ...(recovery ? { password } : {}),
      });
      setCode(""); setPassword(""); setStep("done");
    } catch (caught) { setError(authErrorKey(caught)); }
    finally { setBusy(false); }
  }
  return <div className="center-page"><div className="card auth-card">
    <h1 className="display">{t(recovery ? "auth.recoveryTitle" : "auth.verificationTitle")}</h1>
    <p className="subtle">{t(recovery ? "auth.recoveryHint" : "auth.verificationHint")}</p>
    {step === "done" ? <p role="status">{t(recovery ? "auth.passwordChanged" : "auth.verified")}</p> :
      <form className="auth-stack" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <label className="field"><span>{t("auth.email")}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} readOnly={step === "code" && Boolean(initialEmail)} />
        </label>
        {step === "code" && <>
          {sent && <p role="status">{t("auth.codeSent")}</p>}
          <label className="field"><span>{t("auth.code")}</span>
            <input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
          </label>
          {recovery && <label className="field"><span>{t("auth.newPassword")}</span>
            <input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            <span className="small subtle">{t("auth.passwordPolicy")}</span>
          </label>}
        </>}
        {error && <p className="banner-err" role="alert">{t(error)}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{t(busy ? "common.loading" : step === "email" ? "auth.sendCode" : recovery ? "auth.savePassword" : "auth.confirmCode")}</button>
        {step === "code" && <button className="btn" type="button" disabled={busy} onClick={() => void send()}>{t("auth.resendCode")}</button>}
      </form>}
    <p className="auth-switch"><Link to="/login">{t("auth.backToLogin")}</Link></p>
  </div></div>;
}
