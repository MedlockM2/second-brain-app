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
  /**
   * The chat's streaming door (Terraform output `chat_stream_url`, `…/v1`): a
   * separate API from the main one. Empty: answers are followed by re-reading the
   * conversation instead.
   */
  CHAT_STREAM_URL: trimSlash(env.VITE_CHAT_STREAM_URL ?? ""),
  GOOGLE_CLIENT_ID: env.VITE_GOOGLE_CLIENT_ID ?? "",
  APPLE_SERVICES_ID: env.VITE_APPLE_SERVICES_ID ?? "",
  APPLE_REDIRECT_URI: env.VITE_APPLE_REDIRECT_URI ?? "",
  APP_STORE_URL: env.VITE_APP_STORE_URL ?? "",
  PLAY_STORE_URL: env.VITE_PLAY_STORE_URL ?? "",
  /** The public site (`https://www.<domain>`), home of the extension's install page. */
  SITE_URL: trimSlash(env.VITE_SITE_URL ?? ""),
  /**
   * The extension's ids on the Chrome Web Store and on Edge Add-ons: the same
   * package gets a different id in each store; pairing tries them in order.
   */
  EXTENSION_IDS: (env.VITE_EXTENSION_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean),
  /** The feedback board, opened as-is when the API cannot sign the visitor in to it. */
  FEEDBACK_URL: env.VITE_FEEDBACK_URL ?? "",
} as const;

if (!Config.API_BASE_URL) {
  // Fail loudly at start-up rather than send requests to the page's own origin.
  throw new Error(
    "VITE_API_BASE_URL is not set. Copy web/.env.example to web/.env.local and fill it in (web/README.md).",
  );
}
