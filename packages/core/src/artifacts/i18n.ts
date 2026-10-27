import { CATALOGS } from "../i18n/catalogs";
import { FALLBACK_LOCALE, isSupportedLocale } from "../i18n/locales";
import { createTranslator } from "../i18n/runtime";

/** Labels belong to the stored output language, never the current profile/UI. */
export function artifactTranslator(language: string | null) {
  const base = language?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  const locale = isSupportedLocale(base) ? base : FALLBACK_LOCALE;
  return createTranslator(locale, CATALOGS[locale]);
}

export type ArtifactTranslator = ReturnType<typeof artifactTranslator>;
