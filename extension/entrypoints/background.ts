import { browser, type Browser } from "wxt/browser";
import { WEB_APP_ORIGIN } from "../lib/config";
import { clearContextFailure, type ContextSave, rememberContextFailure } from "../lib/errors";
import { msg } from "../lib/i18n";
import { lastFolderId, savePage, saveSelection } from "../lib/api";
import { readSelection } from "../lib/page";
import { openPanel } from "../lib/panel";
import { saveTab } from "../lib/save";
import { savePairing } from "../lib/session";

/**
 * The service worker. The toolbar button and its shortcut (Alt+S) open the
 * side panel and save the tab (`lib/save.ts`); the context menu saves a
 * selection or a link without opening anything; the web app hands over the
 * pairing in one click.
 */
const MENU_SELECTION = "save-selection";
const MENU_LINK = "save-link";

async function flash(text: string, color: string, clearAfterMs: number | null): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color });
  await browser.action.setBadgeText({ text });
  if (clearAfterMs !== null) setTimeout(() => void browser.action.setBadgeText({ text: "" }), clearAfterMs);
}

/** What the clicked menu saves, read from the page where it can be: a selection keeps its line breaks. */
async function contextSave(info: Browser.contextMenus.OnClickData, tab: Browser.tabs.Tab | undefined): Promise<ContextSave | null> {
  const folderId = await lastFolderId();
  if (info.menuItemId === MENU_LINK && info.linkUrl && /^https?:\/\//.test(info.linkUrl)) {
    return { kind: "link", url: info.linkUrl, folderId };
  }
  if (info.menuItemId !== MENU_SELECTION || !info.selectionText) return null;
  const read = tab?.id !== undefined ? await readSelection(tab.id, info.frameId) : null;
  return { kind: "selection", text: read ?? info.selectionText, url: info.pageUrl ?? tab?.url ?? null, folderId };
}

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    // The panel opens from this click only: before anything is awaited.
    void openPanel(tab.windowId).catch(() => undefined);
    void saveTab(tab);
  });

  browser.runtime.onInstalled.addListener(() => {
    // An update keeps the previous version's items: start from none.
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({ id: MENU_SELECTION, title: msg("menuSaveSelection"), contexts: ["selection"] });
      browser.contextMenus.create({
        id: MENU_LINK,
        title: msg("menuSaveLink"),
        contexts: ["link"],
        targetUrlPatterns: ["http://*/*", "https://*/*"],
      });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      const save = await contextSave(info, tab);
      if (!save) return;
      try {
        if (save.kind === "link") await savePage(save.url, save.folderId);
        else await saveSelection(save.text, save.url, save.folderId);
        await clearContextFailure().catch(() => undefined);
        await flash("✓", "#1c1b1a", 3000);
      } catch (error) {
        // The "!" stays until the side panel shows why, with the same save to send again.
        await rememberContextFailure(error, save).catch(() => undefined);
        await flash("!", "#ba1a1a", null);
      }
    })();
  });

  /**
   * One-click pairing (complement §7). Only a page of the web app can send this
   * — the manifest's `externally_connectable` names its origin alone — and the
   * origin is checked again here, as an allow-list on the exact origin, before
   * anything is stored.
   */
  if (import.meta.env.FIREFOX) return;

  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
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
