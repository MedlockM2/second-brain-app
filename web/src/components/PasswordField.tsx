import { useId, useState, type InputHTMLAttributes } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  label: string;
  hint?: string;
};

export function PasswordField({ label, hint, ...inputProps }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = t(visible ? "auth.hidePassword" : "auth.showPassword");
  return <div className="auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="field password-field">
      <input {...inputProps} id={id} type={visible ? "text" : "password"} aria-describedby={hint ? `${id}-hint` : undefined} />
      <button type="button" className="icon-btn" disabled={inputProps.disabled}
        aria-label={toggleLabel} title={toggleLabel} aria-pressed={visible} aria-controls={id}
        onMouseDown={(event) => event.preventDefault()} onClick={() => setVisible(!visible)}>
        <Icon name={visible ? "eye-off-outline" : "eye-outline"} size={18} />
      </button>
    </div>
    {hint && <p id={`${id}-hint`} className="small subtle">{hint}</p>}
  </div>;
}
