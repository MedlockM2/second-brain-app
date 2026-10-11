/**
 * Build-time configuration, read once from the VITE_* variables (`.env.example`).
 *
 * Everything here ends up in the bundle and is public: the API host, OAuth
 * client identifiers, store links. A sign-in provider left unconfigured is not
 * an error — its button is simply not offered.
 */
const env = import.meta.env;

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const Config = {
  API_BASE_URL: trimSlash(env.VITE_API_BASE_URL ?? ""),
  GOOGLE_CLIENT_ID: env.VITE_GOOGLE_CLIENT_ID ?? "",
  APPLE_SERVICES_ID: env.VITE_APPLE_SERVICES_ID ?? "",
  APPLE_REDIRECT_URI: env.VITE_APPLE_REDIRECT_URI ?? "",
  APP_STORE_URL: env.VITE_APP_STORE_URL ?? "",
  PLAY_STORE_URL: env.VITE_PLAY_STORE_URL ?? "",
} as const;

if (!Config.API_BASE_URL) {
  // Fail loudly at start-up rather than send requests to the page's own origin.
  throw new Error(
    "VITE_API_BASE_URL is not set. Copy web/.env.example to web/.env.local and fill it in (web/README.md).",
  );
}
