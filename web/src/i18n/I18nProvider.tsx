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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { WEB_CATALOGS } from "./catalogs";
import type { WebTranslationKey } from "./types";

/**
 * The interface language follows the browser — the first of its preferred
 * languages the app ships, English otherwise — unless one is chosen in My
 * account (task-484). The choice stays on this browser, like the theme: it is
 * the chrome around the content, not the reading language, which lives on the
 * account.
 */
export type LocalePreference = SupportedLocale | "browser";

const STORAGE_KEY = "deepn.locale";

function readPreference(): LocalePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) return stored;
  } catch {
    // Storage blocked: follow the browser.
  }
  return "browser";
}

function writePreference(preference: LocalePreference): void {
  try {
    if (preference === "browser") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The language still applies for this visit.
  }
}

const resolve = (preference: LocalePreference): SupportedLocale =>
  preference === "browser" ? browserLocale() : preference;

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
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => void;
  /** A shared key, from `@media-summarizer/core/i18n`. */
  t: typeof t;
  /** A key of the web app's own catalogues. */
  tw: (key: WebTranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18n | null>(null);

const initialPreference = readPreference();
const initialLocale = resolve(initialPreference);
install(initialLocale);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>(initialPreference);
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);

  const apply = useCallback((next: LocalePreference) => {
    const resolved = resolve(next);
    install(resolved);
    setLocale(resolved);
  }, []);

  useEffect(() => {
    if (preference !== "browser") return;
    const onChange = () => apply("browser");
    window.addEventListener("languagechange", onChange);
    return () => window.removeEventListener("languagechange", onChange);
  }, [preference, apply]);

  const setPreference = useCallback(
    (next: LocalePreference) => {
      writePreference(next);
      setPreferenceState(next);
      apply(next);
    },
    [apply],
  );

  const value = useMemo<I18n>(
    () => ({
      locale,
      preference,
      setPreference,
      t,
      tw: (key, params) => interpolate(WEB_CATALOGS[locale][key], params),
    }),
    [locale, preference, setPreference],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
