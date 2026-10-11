import { WEB_APP_ORIGIN } from "../lib/config";
import { msg } from "../lib/i18n";
import { lastFolderId, saveSelection } from "../lib/api";
import { NotLinkedError, savePairing } from "../lib/session";

/**
 * The service worker: the "save the selection" context menu, and the one-click
 * pairing message from the web app.
 */
const MENU_ID = "save-selection";

async function flash(text: string, color: string): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 3000);
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: msg("menuSaveSelection"), contexts: ["selection"] });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !info.selectionText) return;
    void (async () => {
      try {
        await saveSelection(info.selectionText!, info.pageUrl ?? tab?.url ?? null, await lastFolderId());
        await flash("✓", "#1c1b1a");
      } catch (error) {
        await flash("!", "#ba1a1a");
        // Not linked: the popup is where the reader links it.
        if (error instanceof NotLinkedError) await chrome.action.openPopup?.().catch(() => undefined);
      }
    })();
  });

  /**
   * One-click pairing (complement §7). Only a page of the web app can send this
   * — the manifest's `externally_connectable` names its origin alone — and the
   * origin is checked again here, as an allow-list on the exact origin, before
   * anything is stored.
   */
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    const valid =
      sender.origin === WEB_APP_ORIGIN &&
      message?.type === "pair" &&
      typeof message.token === "string" &&
      message.token.length > 0;
    if (!valid) {
      sendResponse({ ok: false });
      return false;
    }
    void savePairing(message.token).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  });
});
