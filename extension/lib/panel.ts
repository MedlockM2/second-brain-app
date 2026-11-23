import { browser } from "wxt/browser";
import type { SaveFailure } from "./errors";

/**
 * What the side panel shows, written by the service worker as the save of a
 * click goes, and watched by the panel. Session storage: memory, gone with the
 * browser, closed to pages.
 *
 * The panel keeps its page: without the `tabs` permission it cannot see the tab
 * the reader moves to. The next click on the icon saves that page and replaces
 * this state.
 */
export type PanelState =
  | { kind: "saving"; url: string; title: string | null }
  | { kind: "media"; mediaItemId: string; url: string; title: string | null }
  | { kind: "failed"; url: string; title: string | null; failure: SaveFailure }
  | { kind: "notSavable"; title: string | null };

const PANEL_KEY = "panelState";
const SAVED_KEY = "savedAt";

export async function setPanelState(state: PanelState | null): Promise<void> {
  if (state) await browser.storage.session.set({ [PANEL_KEY]: state });
  else await browser.storage.session.remove(PANEL_KEY);
}

export async function panelState(): Promise<PanelState | null> {
  return ((await browser.storage.session.get(PANEL_KEY))[PANEL_KEY] as PanelState | undefined) ?? null;
}

export function onPanelStateChange(listener: (state: PanelState | null) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && PANEL_KEY in changes) listener((changes[PANEL_KEY].newValue as PanelState | undefined) ?? null);
  });
}

/** A save went through, from the icon or the context menu: the panel checks the web account again (TASK-638). */
export async function noteSaved(): Promise<void> {
  await browser.storage.session.set({ [SAVED_KEY]: Date.now() });
}

export function onSaved(listener: () => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && SAVED_KEY in changes) listener();
  });
}

interface FirefoxSidebar { sidebarAction?: { open(): Promise<void> } }

/**
 * Open the panel: Chrome and Edge's side panel, Firefox's sidebar. Both only
 * open from a click, so this must be called before the click handler awaits
 * anything. Firefox for Android has neither: nothing opens there.
 */
export function openPanel(windowId: number): Promise<void> {
  if (import.meta.env.FIREFOX) {
    const sidebar = (browser as unknown as FirefoxSidebar).sidebarAction;
    return sidebar ? sidebar.open() : Promise.resolve();
  }
  return browser.sidePanel.open({ windowId });
}
