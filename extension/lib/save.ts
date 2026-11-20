import { browser, type Browser } from "wxt/browser";
import { lastFolderId, listFolders, savedItem, savePage } from "./api";
import { saveFailure } from "./errors";
import { readPage } from "./page";
import { noteSaved, setPanelState } from "./panel";
import { NotLinkedError, linkState } from "./session";

/**
 * The save of a click on the icon (or Alt+S): the tab goes into the folder used
 * last, read as the reader sees it, unless the library already holds it. The
 * side panel follows through `PanelState`.
 *
 * A save that failed keeps what it would have sent — the page included, since
 * it cannot be read again without a new click — so the panel can send it again.
 */
const PENDING_KEY = "pendingSave";
interface PendingSave { url: string; title: string | null; folderId: string | null; pageHtml: string | null }

/** Null on any refusal but the end of the link, which the panel shows as "link again". */
async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotLinkedError) throw error;
    return null;
  }
}

async function send(pending: PendingSave): Promise<void> {
  try {
    const mediaItemId = await savePage(pending.url, pending.folderId, pending.pageHtml);
    await browser.storage.session.remove(PENDING_KEY);
    await setPanelState({ kind: "media", mediaItemId, url: pending.url, title: pending.title, origin: "saved" });
    await noteSaved();
  } catch (error) {
    if (error instanceof NotLinkedError) return setPanelState(null);
    await browser.storage.session.set({ [PENDING_KEY]: pending });
    await setPanelState({ kind: "failed", url: pending.url, title: pending.title, failure: saveFailure(error) });
  }
}

export async function saveTab(tab: Browser.tabs.Tab): Promise<void> {
  const url = tab.url ?? "";
  const title = tab.title ?? null;
  if (!/^https?:\/\//.test(url)) return setPanelState({ kind: "notSavable", title });
  // Unlinked, the panel asks to link; the next click saves.
  if ((await linkState()) !== "linked") return setPanelState(null);

  await setPanelState({ kind: "saving", url, title });
  try {
    const [existing, folders, remembered] = await Promise.all([orNull(savedItem(url)), orNull(listFolders()), lastFolderId()]);
    if (existing) {
      await setPanelState({ kind: "media", mediaItemId: existing.media_item_id, url, title, origin: "already" });
      return;
    }
    const folderId = remembered && folders?.some((folder) => folder.id === remembered) ? remembered : null;
    const pageHtml = tab.id !== undefined ? await readPage(tab.id) : null;
    await send({ url, title, folderId, pageHtml });
  } catch (error) {
    if (error instanceof NotLinkedError) return setPanelState(null);
    await browser.storage.session.set({ [PENDING_KEY]: { url, title, folderId: null, pageHtml: null } satisfies PendingSave });
    await setPanelState({ kind: "failed", url, title, failure: saveFailure(error) });
  }
}

/** The panel's "Retry" on a failed save: the same address, folder and page. */
export async function retrySave(): Promise<void> {
  const pending = (await browser.storage.session.get(PENDING_KEY))[PENDING_KEY] as PendingSave | undefined;
  if (!pending) return;
  await setPanelState({ kind: "saving", url: pending.url, title: pending.title });
  await send(pending);
}
