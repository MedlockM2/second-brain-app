import {
  LOCALE_ENDONYMS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@media-summarizer/core/i18n/locales";
import type { AuthUser } from "@media-summarizer/core/types/auth";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { apiRequest } from "../api";
import { Icon } from "../components/Icon";
import { useI18n } from "../i18n/I18nProvider";
import { useSession } from "../session/SessionProvider";

/**
 * The reading language, chosen once at sign-up (capture "Langue à
 * l'inscription"). The eleven reading languages are the eleven interface
 * languages (`V1_READING_LANGUAGES` on the API), so the interface language is
 * the natural first guess. Setting a first language never counts against the
 * once-a-month change limit.
 */
export function ReadingLanguagePage() {
  const { t, locale } = useI18n();
  const { setUser } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [choice, setChoice] = useState<SupportedLocale>(locale);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const user = await apiRequest<AuthUser>("/api/auth/me", {
        method: "PATCH",
        body: { reading_language: choice },
      });
      setUser(user);
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <div className="card auth-card wide">
        <h1 className="display">{t("onboarding.language.title")}</h1>
        <p className="subtle">{t("onboarding.language.subtitle")}</p>
        <div className="lang-grid" role="radiogroup" aria-label={t("readingLanguage.title")}>
          {SUPPORTED_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={choice === code}
              aria-label={t("readingLanguage.selectA11y", { language: LOCALE_ENDONYMS[code] })}
              className="lang-option"
              lang={code}
              onClick={() => setChoice(code)}
            >
              {LOCALE_ENDONYMS[code]}
            </button>
          ))}
        </div>
        {failed && (
          <div className="banner-err" role="alert" style={{ marginBottom: 12 }}>
            <Icon name="alert-circle-outline" size={18} />
            <span>{t("readingLanguage.saveFailed")}</span>
          </div>
        )}
        <button
          type="button"
          className="btn primary"
          style={{ width: "100%" }}
          disabled={busy}
          aria-label={t("onboarding.language.continueA11y")}
          onClick={save}
        >
          {t("common.continue")}
        </button>
      </div>
    </div>
  );
}
