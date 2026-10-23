import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { authErrorKey } from "@media-summarizer/core/auth/cognito";
import { meetsPasswordPolicy } from "@media-summarizer/core/auth/passwordRules";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../i18n/I18nProvider";
import { authAction } from "../session/cognito";
import { useSession } from "../session/SessionProvider";
import type { LoginRequest } from "@media-summarizer/core/types/auth";
import { AuthField, CODE_LENGTH, CodeInput, PasswordRules, SlotText } from "../components/AuthField";
import { Icon } from "../components/Icon";
import { AuthSplit } from "../components/welcome/AuthSplit";

/** Cognito accepts a new code request about once a minute; the link waits as long. */
const RESEND_DELAY_SECONDS = 60;

/** The webmail of the address's domain, when it is a common one: « Open Gmail ». */
const MAILBOXES: [RegExp, string, string][] = [
  [/^(gmail|googlemail)\.com$/, "Gmail", "https://mail.google.com/"],
  [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, "Outlook", "https://outlook.live.com/mail/"],
  [/^yahoo\.[a-z.]+$/, "Yahoo Mail", "https://mail.yahoo.com/"],
  [/^(icloud|me|mac)\.com$/, "iCloud Mail", "https://www.icloud.com/mail/"],
];

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
  const [error, setError] = useState<TranslationKey | null>(null);
  // A code was just sent on arriving here, by the sign-up or by the "send" of recovery.
  const [resendIn, setResendIn] = useState(recovery ? 0 : RESEND_DELAY_SECONDS);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function send() {
    if (busy || !email.trim()) return;
    setBusy(true); setError(null);
    try {
      await authAction(recovery ? "/forgot-password" : "/resend-confirmation", { email: email.trim() });
      setStep("code"); setCode(""); setResendIn(RESEND_DELAY_SECONDS);
    } catch (caught) { setError(authErrorKey(caught)); }
    finally { setBusy(false); }
  }
  async function confirm(enteredCode = code) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (step === "code") {
        await authAction(recovery ? "/confirm-password" : "/confirm-registration", {
          email: email.trim(), code: enteredCode, ...(recovery ? { password } : {}),
        });
        // A failed sign-in retries only the password, never the consumed code.
        setStep("signIn"); setCode("");
      }
      await signIn("/login", { email: email.trim(), password });
      setPassword("");
      navigate(routeState?.from ?? "/", { replace: true });
    } catch (caught) {
      setError(authErrorKey(caught));
      if (step === "code") setCode("");
    }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === "email") void send();
    else void confirm();
  }
  // A sign-up that carries its password confirms on the sixth digit.
  function onCode(next: string) {
    setCode(next); setError(null);
    if (next.length === CODE_LENGTH && !recovery && password) void confirm(next);
  }

  if (step === "signIn" && busy) return <AuthSplit><p role="status">{t("common.loading")}</p></AuthSplit>;

  const back = <p className="auth-switch"><Link to="/login" state={routeState?.from ? { from: routeState.from } : undefined} aria-disabled={busy} onClick={(event) => {
    if (busy) event.preventDefault();
    else onCancel?.();
  }}>{t("auth.backToLogin")}</Link></p>;
  const errorBanner = error && <p className="banner-err" role="alert"><Icon name="alert-circle-outline" size={18} /><span>{t(error)}</span></p>;

  if (step === "email") return <AuthSplit>
    <h1 className="display auth-title">{t("auth.recoveryTitle")}</h1>
    <p className="subtle auth-subtitle">{t("auth.recoveryHint")}</p>
    <form className="auth-stack" onSubmit={submit} aria-busy={busy}>
      <AuthField label={t("auth.email")} type="email" autoComplete="email" required value={email} disabled={busy}
        placeholder={t("auth.emailPlaceholder")} onChange={(event) => setEmail(event.target.value)} />
      {errorBanner}
      <button className="btn primary auth-submit" type="submit" disabled={busy || !email.trim()}>{t("auth.sendCode")}</button>
    </form>
    {back}
  </AuthSplit>;

  if (step === "signIn") return <AuthSplit>
    <h1 className="display auth-title">{t("login.title")}</h1>
    <p className="subtle auth-subtitle">{t(recovery ? "auth.passwordChanged" : "auth.verified")}</p>
    <form className="auth-stack" onSubmit={submit} aria-busy={busy}>
      <AuthField secure label={t("auth.password")} autoComplete="current-password" maxLength={256} required value={password}
        disabled={busy} onChange={(event) => setPassword(event.target.value)} />
      {errorBanner}
      <button className="btn primary auth-submit" type="submit" disabled={busy || !password}>{t("login.submit")}</button>
    </form>
    {back}
  </AuthSplit>;

  // The code step. « Edit » goes back to where the address was typed.
  const edit = recovery
    ? () => { setStep("email"); setCode(""); setPassword(""); setError(null); }
    : onCancel;
  const needsPassword = recovery || !credentials;
  const domain = email.trim().split("@")[1]?.toLowerCase() ?? "";
  const mailbox = MAILBOXES.find(([pattern]) => pattern.test(domain));
  const canSubmit = !busy && code.length === CODE_LENGTH && (recovery ? meetsPasswordPolicy(password) : password.length > 0);
  return <AuthSplit>
    <span className="auth-envelope" aria-hidden="true"><Icon name="mail-open-outline" size={24} /></span>
    <h1 className="display auth-title">{t(recovery ? "auth.newPassword" : "auth.codeTitle")}</h1>
    <p className="subtle auth-subtitle">
      {t("auth.codeSentTo")} <b className="auth-recipient-email">{email}</b>
      {edit && <> · <button type="button" className="auth-inline" disabled={busy} onClick={edit}>{t("auth.changeEmail")}</button></>}
    </p>
    <form className="auth-stack" onSubmit={submit} aria-busy={busy}>
      <CodeInput value={code} onChange={onCode} disabled={busy} invalid={Boolean(error)} />
      {errorBanner}
      <p className="small subtle" style={{ margin: 0 }}>
        <SlotText template={t("auth.codeHelp")} slots={{
          resend: resendIn > 0
            ? <span className="muted">{t("auth.resendIn", { time: `0:${String(resendIn).padStart(2, "0")}` })}</span>
            : <button type="button" className="auth-inline" disabled={busy} onClick={() => void send()}>{t("auth.resendLink")}</button>,
        }} />
      </p>
      {needsPassword && <AuthField secure label={t(recovery ? "auth.newPassword" : "auth.password")}
        autoComplete={recovery ? "new-password" : "current-password"} minLength={recovery ? 12 : undefined} maxLength={256}
        required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)}>
        {recovery && <PasswordRules password={password} />}
      </AuthField>}
      {needsPassword && <button className="btn primary auth-submit" type="submit" disabled={!canSubmit}>
        {t(recovery ? "auth.savePassword" : "auth.confirmCode")}
      </button>}
      {mailbox && <a className="btn tonal auth-submit" href={mailbox[2]} target="_blank" rel="noreferrer">
        <Icon name="open-outline" size={18} />{t("auth.openMail", { provider: mailbox[1] })}
      </a>}
    </form>
    {back}
  </AuthSplit>;
}
