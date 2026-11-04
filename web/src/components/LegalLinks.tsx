import { PRIVACY_POLICY_URL, TERMS_URL } from "@media-summarizer/core/constants/legal";
import { useI18n } from "../i18n/I18nProvider";
import { SlotText } from "./AuthField";

/** The same public destinations on sign-in, sign-up and My account. */
export function LegalLinks({ registration = false }: { registration?: boolean }) {
  const { t } = useI18n();
  const privacy = <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">{t("paywall.privacy")}</a>;
  return (
    <p className="small subtle auth-legal">
      {registration ? <SlotText template={t("register.legal")} slots={{ privacy }} /> : privacy}
      {" · "}
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">{t("paywall.terms")}</a>
    </p>
  );
}
