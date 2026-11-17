import path from "node:path";
import { defineConfig } from "wxt";
import { loadEnv } from "vite";

/**
 * Deepn's Chromium and Firefox targets (task-487/488).
 *
 * The toolbar button has no popup: a click (or Alt+S) opens the side panel
 * (`entrypoints/sidepanel`; `sidePanel` on Chromium, `sidebar_action` on Firefox,
 * both added by WXT) and saves the tab.
 *
 * The manifest asks for as little as the job needs: `activeTab` and `scripting`
 * to read the tab the reader clicked on — its address, its page, its selection —
 * on that click only (the toolbar button, Alt+S, the context menu); never before,
 * never another tab (owner decision of 2026-11-17, way A of task-490).
 * `contextMenus` for "save the selection" and "save this link", `storage` for the
 * session. No content script, no `<all_urls>`, no `tabs`, no broad host
 * permission: the one host is the API's own, so the extension can call it
 * without the API's CORS naming an extension origin.
 *
 * `externally_connectable` lets the web app — and only it — hand the
 * extension its token in one click (complement §7).
 *
 * Build-time configuration, from `.env` files (see `.env.example`):
 * VITE_API_BASE_URL and VITE_WEB_APP_ORIGIN.
 */
function origin(name: string, mode: string): string {
  const env = loadEnv(mode, __dirname, "VITE_");
  if (Object.keys(env).some((key) => !["VITE_API_BASE_URL", "VITE_WEB_APP_ORIGIN"].includes(key))) {
    throw new Error("Only the two documented public origins belong in extension VITE_* settings.");
  }
  const value = (env[name] ?? "").replace(/\/+$/, "");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute origin.`); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash) throw new Error(`${name} must be an origin without credentials or path.`);
  if (mode === "distribution" && (url.protocol !== "https:" ||
    /^(localhost|127\.|\[::1\])/.test(url.hostname) ||
    /(^|\.)(invalid|test|example|localhost)$/.test(url.hostname) ||
    /(^|\.)example\.(com|net|org)$/.test(url.hostname))) {
    throw new Error(`${name} must be the public HTTPS origin chosen for distribution.`);
  }
  return url.origin;
}

/** A match pattern for an origin. Match patterns carry no port; the exact origin,
 * port included, is checked again where a message is received (background.ts). */
function matchPattern(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}/*`;
}

export default defineConfig({
  srcDir: ".",
  zip: { zipSources: false, artifactTemplate: "deepn-extension-{{version}}-{{browser}}.zip" },
  vite: () => ({
    resolve: {
      // The shared code is source, imported by path: the extension is its own npm
      // project so that its tooling never moves a version the mobile app resolves.
      alias: { "@media-summarizer/core": path.resolve(__dirname, "../packages/core/src") },
    },
  }),
  manifest: ({ browser, mode }) => {
    const api = origin("VITE_API_BASE_URL", mode);
    const webApp = origin("VITE_WEB_APP_ORIGIN", mode);
    return {
      ...(browser === "firefox" ? {
        browser_specific_settings: {
          gecko_android: { strict_min_version: "142.0" },
          gecko: {
            id: "{f6106a71-7280-40b0-9f84-adf2e3f9d355}",
            strict_min_version: "140.0",
            data_collection_permissions: {
              required: ["authenticationInfo", "personallyIdentifyingInfo", "browsingActivity", "websiteContent"],
            },
          },
        },
      } : {
        minimum_chrome_version: "140",
        externally_connectable: { matches: [matchPattern(webApp)] },
      }),
      name: "__MSG_extName__",
      description: "__MSG_extDescription__",
      default_locale: "en",
      permissions: ["activeTab", "contextMenus", "scripting", "storage"],
      host_permissions: [matchPattern(api)],
      action: { default_title: "__MSG_actionTitle__" },
      // The shortcut is the click on the button: it opens the panel and saves.
      commands: { _execute_action: { suggested_key: { default: "Alt+S" } } },
    };
  },
});
