import path from "node:path";
import { defineConfig } from "wxt";
import { loadEnv } from "vite";

/**
 * Deepn's extension for Chrome and Edge: one package for both stores (task-487).
 *
 * The manifest asks for as little as the job needs (owner decision, point 4 —
 * the extension does what the apps do): `activeTab` to read the current tab's
 * address when the toolbar button is pressed, `contextMenus` for "save the
 * selection", `storage` for the session. No `<all_urls>`, no broad host
 * permission: the one host is the API's own, so the extension can call it
 * without the API's CORS naming an extension origin. It never reads a page's
 * content.
 *
 * `externally_connectable` lets the web app — and only it — hand the
 * extension its token in one click (complement §7).
 *
 * Build-time configuration, from `.env` files (see `.env.example`):
 * VITE_API_BASE_URL and VITE_WEB_APP_ORIGIN.
 */
const env = loadEnv(process.env.NODE_ENV === "development" ? "development" : "production", __dirname, "VITE_");

function origin(name: string): string {
  const value = (env[name] ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\/[a-z0-9.-]+(:[0-9]+)?$/.test(value)) {
    throw new Error(`${name} must be an origin such as https://app.example.com (extension/.env.example)`);
  }
  return value;
}

/** A match pattern for an origin. Match patterns carry no port; the exact origin,
 * port included, is checked again where a message is received (background.ts). */
function matchPattern(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}/*`;
}

export default defineConfig({
  srcDir: ".",
  zip: { artifactTemplate: "deepn-extension-{{version}}.zip" },
  vite: () => ({
    resolve: {
      // The shared code is source, imported by path: the extension is its own npm
      // project so that its tooling never moves a version the mobile app resolves.
      alias: { "@media-summarizer/core": path.resolve(__dirname, "../packages/core/src") },
    },
  }),
  manifest: () => {
    const api = origin("VITE_API_BASE_URL");
    const webApp = origin("VITE_WEB_APP_ORIGIN");
    return {
      minimum_chrome_version: "116",
      name: "__MSG_extName__",
      description: "__MSG_extDescription__",
      default_locale: "en",
      permissions: ["activeTab", "contextMenus", "storage"],
      host_permissions: [matchPattern(api)],
      externally_connectable: { matches: [matchPattern(webApp)] },
      action: { default_title: "__MSG_actionTitle__" },
    };
  },
});
