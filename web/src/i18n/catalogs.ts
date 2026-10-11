import type { SupportedLocale } from "@media-summarizer/core/i18n/locales";
import { ar } from "./ar";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { hi } from "./hi";
import { it } from "./it";
import { ja } from "./ja";
import { nl } from "./nl";
import { pt } from "./pt";
import type { WebCatalog } from "./types";
import { zh } from "./zh";

/** The web app's own catalogues, one per interface language of the app. */
export const WEB_CATALOGS: Record<SupportedLocale, WebCatalog> = {
  en,
  fr,
  es,
  de,
  it,
  pt,
  nl,
  ja,
  zh,
  ar,
  hi,
};
