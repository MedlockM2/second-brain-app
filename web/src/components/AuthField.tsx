import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { PASSWORD_RULES } from "@media-summarizer/core/auth/passwordRules";
import { templateParts } from "@media-summarizer/core/i18n/parts";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** A password field: masked, with the eye that shows it. */
  secure?: boolean;
  /** Beside the label: « Forgot password? » on sign-in. */
  labelAccessory?: ReactNode;
  /** Under the field: what is wrong with it, or that it is right. */
  message?: { tone: "error" | "success"; content: ReactNode };
  /** Under the field, before the message: the password rules on sign-up. */
  children?: ReactNode;
};

/**
 * A labelled field of the sign-in and sign-up forms, as on mobile: its error is
 * written under it, not in a banner above the form.
 */
export function AuthField({ label, secure = false, labelAccessory, message, children, ...inputProps }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = t(visible ? "auth.hidePassword" : "auth.showPassword");
  const error = message?.tone === "error";
  return <div className="auth-field">
    <div className="auth-label-row">
      <label htmlFor={id}>{label}</label>
      {labelAccessory}
    </div>
    <div className={`field auth-input${secure ? " password-field" : ""}${error ? " invalid" : ""}`}>
      <input {...inputProps} id={id} type={secure ? (visible ? "text" : "password") : inputProps.type}
        aria-invalid={error || undefined} aria-describedby={message ? `${id}-message` : undefined} />
      {secure && <button type="button" className="icon-btn" disabled={inputProps.disabled}
        aria-label={toggleLabel} title={toggleLabel} aria-pressed={visible} aria-controls={id}
        onMouseDown={(event) => event.preventDefault()} onClick={() => setVisible(!visible)}>
        <Icon name={visible ? "eye-off-outline" : "eye-outline"} size={18} />
      </button>}
    </div>
    {children}
    {message && <p id={`${id}-message`} className={`auth-message ${message.tone}`} role={error ? "alert" : "status"}>
      <Icon name={error ? "alert-circle-outline" : "checkmark-circle"} size={14} />
      <span>{message.content}</span>
    </p>}
  </div>;
}

/** The password rules as badges: grey until met, then green, never red. */
export function PasswordRules({ password }: { password: string }) {
  const { t } = useI18n();
  return <ul className="rule-badges" aria-label={t("auth.rulesA11y")}>
    {PASSWORD_RULES.map((rule) => {
      const met = rule.met(password);
      return <li key={rule.key} className={met ? "met" : undefined} aria-checked={met} role="checkbox" aria-readonly>
        <Icon name={met ? "checkmark" : "ellipse-outline"} size={14} />{t(rule.key)}
      </li>;
    })}
  </ul>;
}

/** A translated sentence with elements in its `{slots}` (links, buttons). */
export function SlotText({ template, slots }: { template: string; slots: Record<string, ReactNode> }) {
  return <>{templateParts(template).map((part, index) =>
    <span key={index}>{"slot" in part ? slots[part.slot] : part.text}</span>)}</>;
}

export const CODE_LENGTH = 6;

/**
 * Six boxes drawn over one field: `one-time-code` autofill and a pasted code
 * land whole, and the boxes only show what the field holds.
 */
export function CodeInput({ value, onChange, disabled, invalid }: {
  value: string; onChange: (code: string) => void; disabled?: boolean; invalid?: boolean;
}) {
  const { t } = useI18n();
  return <div className={`code-input${invalid ? " invalid" : ""}`}>
    {Array.from({ length: CODE_LENGTH }, (_, index) =>
      <span key={index} className={index === Math.min(value.length, CODE_LENGTH - 1) ? "box current" : "box"} aria-hidden="true">{value[index] ?? ""}</span>)}
    <input aria-label={t("auth.code")} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={CODE_LENGTH}
      autoFocus value={value} disabled={disabled} onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))} />
  </div>;
}
