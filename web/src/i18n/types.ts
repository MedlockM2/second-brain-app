import type { en } from "./en";

/** Every key the web app translates on its own, taken from the `en` catalogue. */
export type WebTranslationKey = keyof typeof en;

/** A web catalogue: every key of `en`, so a missing one is a `tsc` error. */
export type WebCatalog = Record<WebTranslationKey, string>;
