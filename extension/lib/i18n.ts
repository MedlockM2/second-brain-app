import { browser } from "wxt/browser";
import type messages from "../public/_locales/en/messages.json";
/**
 * The extension's strings, from `public/_locales` (written by scripts/messages.py)
 * in the browser's language. A missing message shows its key, never nothing.
 */
export function msg(key: string): string {
  // data-msg attributes supply keys at runtime; WXT's generated overloads only
  // accept literal keys, while the browser API also accepts a missing key.
  return browser.i18n.getMessage(key as keyof typeof messages) || key;
}

/** Fill every element carrying `data-msg` (text) or `data-msg-placeholder`. */
export function localize(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-msg]").forEach((element) => {
    element.textContent = msg(element.dataset.msg!);
  });
  root.querySelectorAll<HTMLInputElement>("[data-msg-placeholder]").forEach((element) => {
    element.placeholder = msg(element.dataset.msgPlaceholder!);
    element.setAttribute("aria-label", element.placeholder);
  });
  document.documentElement.lang = browser.i18n.getUILanguage();
  document.documentElement.dir = browser.i18n.getMessage("@@bidi_dir") || "ltr";
}

/** "Chrome on macOS": how the account names this extension in its list. */
export function clientLabel(): string {
  const ua = navigator.userAgent;
  const browserName = /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : "Browser";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browserName} · ${os}` : browserName;
}
