/** Build-time configuration (`.env.example`); validated by wxt.config.ts when the manifest is built. */
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
export const WEB_APP_ORIGIN = String(import.meta.env.VITE_WEB_APP_ORIGIN ?? "").replace(/\/+$/, "");

/** Where the web app pairs the extension in one click. */
export const ACCOUNT_EXTENSION_URL = `${WEB_APP_ORIGIN}/account/extension`;
