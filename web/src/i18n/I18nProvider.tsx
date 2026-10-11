import { CATALOGS } from "@media-summarizer/core/i18n/catalogs";
import {
  FALLBACK_LOCALE,
  isRTLLocale,
  isSupportedLocale,
  type SupportedLocale,
} from "@media-summarizer/core/i18n/locales";
import {
  setActiveCatalog,
  t,
  type TranslationParams,
} from "@media-summarizer/core/i18n/runtime";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { WEB_CATALOGS } from "./catalogs";
import type { WebTranslationKey } from "./types";

/**
 * The interface language follows the browser: the first of its preferred
 * languages the app ships, English otherwise. Choosing another one is a setting
 * of the account page (task-484).
 */
function browserLocale(): SupportedLocale {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (isSupportedLocale(base)) return base;
  }
  return FALLBACK_LOCALE;
}

function install(locale: SupportedLocale): void {
  // The shared catalogues live in a module-level runtime that the copy helpers
  // of packages/core read directly; it is switched before the tree re-renders.
  setActiveCatalog(locale, CATALOGS[locale]);
  document.documentElement.lang = locale;
  document.documentElement.dir = isRTLLocale(locale) ? "rtl" : "ltr";
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

type I18n = {
  locale: SupportedLocale;
  /** A shared key, from `@media-summarizer/core/i18n`. */
  t: typeof t;
  /** A key of the web app's own catalogues. */
  tw: (key: WebTranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18n | null>(null);

const initialLocale = browserLocale();
install(initialLocale);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);

  useEffect(() => {
    const onChange = () => {
      const next = browserLocale();
      install(next);
      setLocale(next);
    };
    window.addEventListener("languagechange", onChange);
    return () => window.removeEventListener("languagechange", onChange);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      t,
      tw: (key, params) => interpolate(WEB_CATALOGS[locale][key], params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
