import { browser } from "wxt/browser";
import type { MediaItemContract, MediaType } from "@media-summarizer/core/types/media";
import {
  claimPairingCode,
  createFolder,
  listFolders,
  mediaItem,
  moveMedia,
  rememberFolder,
  savePage,
  saveSelection,
} from "../../lib/api";
import { ACCOUNT_EXTENSION_URL, mediaUrl } from "../../lib/config";
import {
  clearContextFailure,
  contextFailure,
  failureMessage,
  onContextFailureChange,
  retryable,
  saveFailure,
} from "../../lib/errors";
import { mountFolderPicker } from "../../lib/folderPicker";
import { localize, msg } from "../../lib/i18n";
import { icon, type IconName } from "../../lib/icons";
import { mediaStage } from "../../lib/media";
import { onPanelStateChange, type PanelState, panelState } from "../../lib/panel";
import { retrySave } from "../../lib/save";
import { linkedAccount, linkState, type LinkState, NotLinkedError, signOut } from "../../lib/session";
import { $, el, note, type Scope, sleep } from "./dom";
import { mountNotebook, type NotebookView } from "./notebook";
import { mountReader, type ReaderView } from "./reader";

/**
 * The side panel: the page the reader saved, as the app's media page shows it —
 * its header (state, folder, "Open in Deepn"), then the Lecture and Cahier tabs
 * (mockup `mobile-design-mockups/extension_panneau_lateral`).
 *
 * The service worker writes what to show (`lib/panel.ts`) as the save of a click
 * on the icon goes: saving, the media, a failure, a page that cannot be saved.
 * Unlinked, the panel is where the extension gets linked. A right-click save that
 * failed shows as a banner on top, with the same save to send again.
 */
const MEDIA_POLL_MS = 3000;
const POLL_LIMIT = 200;
type Tab = "reader" | "notebook";

/** The tab the reader last chose, kept from one media to the next. */
let activeTab: Tab = "reader";
let mounted: { mediaItemId: string; scope: Scope; setOrigin(origin: "saved" | "already"): void } | null = null;
let rendering = Promise.resolve();

if (import.meta.env.FIREFOX) {
  $("pair-instructions").dataset.msg = "pairFirefox";
  $("code-instructions").dataset.msg = "pairFirefoxCode";
}
localize(document);
const render = () => (rendering = rendering.then(draw, draw));
void render();
void drawBanner();
onPanelStateChange(() => void render());
onContextFailureChange(() => void drawBanner());
browser.storage.onChanged.addListener((changes, area) => {
  // Linked from the web app, or the link ended: the panel follows.
  if (area === "local" && ("refresh" in changes || "expired" in changes)) void render();
});

/** A refusal that ends the link sends the whole panel to "link again". */
function unlinked(error: unknown): boolean {
  if (!(error instanceof NotLinkedError)) return false;
  void render();
  return true;
}

function unmount(): void {
  if (mounted) mounted.scope.alive = false;
  mounted = null;
}

async function draw(): Promise<void> {
  const link = await linkState();
  void drawAccount(link);
  $("pair").hidden = link === "linked";
  $("pair-expired").hidden = link !== "expired";
  const view = $("view");
  const foot = $("foot");
  if (link !== "linked") {
    unmount();
    view.replaceChildren();
    foot.replaceChildren();
    return;
  }
  const state = await panelState();
  if (state?.kind === "media") return mountMedia(state);
  unmount();
  foot.replaceChildren();
  view.replaceChildren(...placeholder(state));
}

/** The account saves go to, from `/api/auth/me`: on screen as long as the extension is linked. */
async function drawAccount(link: LinkState): Promise<void> {
  const box = $("account");
  if (link !== "linked") {
    box.hidden = true;
    return;
  }
  const account = await linkedAccount().catch((error) => {
    unlinked(error);
    return null;
  });
  const email = $("account-email");
  email.textContent = account?.email ?? "";
  email.title = account?.email ?? "";
  box.hidden = !account;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** What shows before there is a media: nothing saved yet, saving, a failure, a page that cannot be saved. */
function placeholder(state: Exclude<PanelState, { kind: "media" }> | null): Node[] {
  if (!state) return [el("div", { className: "empty" }, el("span", { className: "logo big" }), note(msg("panelEmpty")))];
  if (state.kind === "notSavable") {
    return [el("div", { className: "empty" }, el("p", { className: "empty-title", text: state.title ?? "" }), note(msg("notSavable")))];
  }
  const head = el("header", { className: "mh" },
    el("div", { className: "mh-row" }, el("span", { className: "thumb t-article" }, icon("newspaper", 24)),
      el("div", { className: "mh-id" }, el("div", { className: "kicker", text: hostOf(state.url) }), el("h1", { className: "mh-title", text: state.title || hostOf(state.url) }))));
  if (state.kind === "saving") {
    head.append(el("div", { className: "mh-meta" }, el("span", { className: "chip", attrs: { role: "status" } }, icon("sync-outline", 15, "spin"), msg("saving"))));
    return [head];
  }
  const body = el("div", { className: "pad" }, note(`${msg("saveFailed")} ${failureMessage(state.failure)}`, true));
  if (retryable(state.failure)) {
    const retry = el("button", { className: "btn primary", attrs: { type: "button" }, text: msg("retry") });
    retry.onclick = () => { retry.disabled = true; void retrySave(); };
    body.append(retry);
  }
  return [head, body];
}

const THUMBS: Partial<Record<MediaType, [IconName, string]>> = {
  article: ["newspaper", "t-article"],
  youtube_video: ["play-circle-outline", "t-video"],
  short_video: ["play-circle-outline", "t-video"],
  podcast_episode: ["headset-outline", "t-audio"],
  audio: ["headset-outline", "t-audio"],
  audio_file: ["headset-outline", "t-audio"],
  image_post: ["images-outline", "t-image"],
};

function mountMedia(state: Extract<PanelState, { kind: "media" }>): void {
  if (mounted?.mediaItemId === state.mediaItemId) {
    mounted.setOrigin(state.origin);
    return;
  }
  unmount();
  const scope: Scope = { alive: true };
  const id = state.mediaItemId;
  let origin = state.origin;
  let media: MediaItemContract | null = null;
  const openInApp = () => void browser.tabs.create({ url: mediaUrl(id) });

  // --- Header -------------------------------------------------------------------------------
  const thumb = el("span", { className: "thumb t-article" }, icon("newspaper", 24));
  const kicker = el("div", { className: "kicker", text: hostOf(state.url) });
  const title = el("h1", { className: "mh-title", text: state.title || hostOf(state.url) });
  const open = el("button", { className: "ibtn", attrs: { type: "button", "aria-label": msg("openInDeepn"), title: msg("openInDeepn") } }, icon("open-outline", 18));
  open.onclick = openInApp;
  const more = el("button", { className: "ibtn", attrs: { type: "button", "aria-label": msg("moreActions"), title: msg("moreActions"), "aria-haspopup": "menu", "aria-expanded": "false" } }, icon("ellipsis-horizontal", 18));
  const shortcut = el("div", { className: "mrow muted-row" }, icon("time-outline", 16));
  const signOutRow = el("button", { className: "mrow", attrs: { type: "button", role: "menuitem" } }, icon("log-out-outline", 16), msg("signOut"));
  const menu = el("div", { className: "menu more-menu", attrs: { role: "menu" } }, shortcut, signOutRow);
  menu.hidden = true;
  void showShortcut(shortcut);
  const chip = el("span", { className: "chip", attrs: { role: "status" } });
  const picker = el("div", { className: "picker" });
  const headerStatus = el("p", { className: "status", attrs: { role: "status" } });
  const header = el("header", { className: "mh" },
    el("div", { className: "mh-row" }, thumb, el("div", { className: "mh-id" }, kicker, title), el("div", { className: "mh-btns" }, open, more, menu)),
    el("div", { className: "mh-meta" }, chip, picker), headerStatus);

  const closeMenu = () => {
    menu.hidden = true;
    more.setAttribute("aria-expanded", "false");
  };
  more.onclick = () => {
    menu.hidden = !menu.hidden;
    more.setAttribute("aria-expanded", String(!menu.hidden));
  };
  menu.onkeydown = (event) => { if (event.key === "Escape") { closeMenu(); more.focus(); } };
  document.addEventListener("mousedown", (event) => {
    if (!menu.hidden && !more.contains(event.target as Node) && !menu.contains(event.target as Node)) closeMenu();
  });
  signOutRow.onclick = async () => {
    closeMenu();
    try {
      await signOut();
      await render();
    } catch {
      headerStatus.className = "status error";
      headerStatus.textContent = msg("signOutFailed");
    }
  };

  function drawChip(): void {
    const stage = media ? mediaStage(media.status) : "processing";
    const [glyph, text, tone] = stage === "processing"
      ? ["sync-outline", msg("statusProcessing"), ""] as const
      : stage === "failed"
        ? ["alert-circle-outline", msg("statusFailed"), "err"] as const
        : ["checkmark-circle", msg(origin === "already" ? "alreadySaved" : "saved"), "ok"] as const;
    chip.className = `chip ${tone}`.trim();
    chip.replaceChildren(icon(glyph, 15, stage === "processing" ? "spin" : ""), text);
  }

  function drawHeader(): void {
    if (!media) return;
    const host = hostOf(media.original_url || state.url);
    kicker.textContent = media.creator_name && media.creator_name !== host ? `${media.creator_name} · ${host}` : host;
    title.textContent = media.title || state.title || host;
    const [glyph, tone] = THUMBS[media.media_type] ?? ["document-text-outline", ""];
    thumb.className = `thumb ${tone}`.trim();
    if (media.media_image) {
      const image = el("img", { attrs: { src: media.media_image, alt: "" } });
      image.onerror = () => thumb.replaceChildren(icon(glyph, 24));
      thumb.replaceChildren(image);
    } else {
      thumb.replaceChildren(icon(glyph, 24));
    }
    drawChip();
  }

  // --- Tabs -----------------------------------------------------------------------------------
  const reader: ReaderView = mountReader(scope, id, unlinked);
  const notebook: NotebookView = mountNotebook(scope, id, openInApp, unlinked);
  const readerPanel = el("div", { className: "pad", attrs: { role: "tabpanel", id: "panel-reader" } }, reader.element);
  const notebookPanel = el("div", { className: "pad", attrs: { role: "tabpanel", id: "panel-notebook" } }, notebook.element);
  const tabButton = (tab: Tab, glyph: IconName, label: string) =>
    el("button", { className: "tab", attrs: { type: "button", role: "tab", "aria-controls": `panel-${tab}` } }, icon(glyph, 17), msg(label));
  const readerTab = tabButton("reader", "book-outline", "tabReader");
  const notebookTab = tabButton("notebook", "sparkles-outline", "tabNotebook");
  const tabs = el("nav", { className: "tabs", attrs: { role: "tablist" } }, readerTab, notebookTab);

  function select(tab: Tab): void {
    activeTab = tab;
    readerTab.classList.toggle("on", tab === "reader");
    notebookTab.classList.toggle("on", tab === "notebook");
    readerTab.setAttribute("aria-selected", String(tab === "reader"));
    notebookTab.setAttribute("aria-selected", String(tab === "notebook"));
    readerPanel.hidden = tab !== "reader";
    notebookPanel.hidden = tab !== "notebook";
    // The composer belongs to the conversation, so to the Lecture tab.
    $("foot").replaceChildren(...(tab === "reader" ? [reader.composer] : []));
  }
  readerTab.onclick = () => select("reader");
  notebookTab.onclick = () => {
    // A click on the tab while an entry is open brings the list back.
    if (activeTab === "notebook") notebook.showList();
    select("notebook");
  };

  $("view").replaceChildren(header, tabs, readerPanel, notebookPanel);
  select(activeTab);
  drawChip();

  // --- The folder, once the media says which it is ----------------------------------------------
  let pickerMounted = false;
  async function mountPicker(folderId: string | null): Promise<void> {
    pickerMounted = true;
    const folders = await listFolders().catch((error) => (unlinked(error) ? null : []));
    if (!scope.alive || folders === null) return;
    mountFolderPicker(picker, {
      folders,
      selected: folderId,
      onPick: async (folder) => {
        headerStatus.textContent = "";
        const target = folder.is_default ? null : folder.id;
        await moveMedia(id, target);
        await rememberFolder(target);
      },
      onCreate: (name) => createFolder(name),
      onError: (error, creating) => {
        if (unlinked(error)) return;
        const failure = saveFailure(error);
        headerStatus.className = "status error";
        headerStatus.textContent = failure.code === "unknown"
          ? msg(creating ? "folderCreateFailed" : "folderMoveFailed")
          : failureMessage(failure);
      },
    });
  }

  // --- The media, followed until it is processed and previewed ---------------------------------
  void (async () => {
    for (let attempt = 0; attempt < POLL_LIMIT && scope.alive; attempt += 1) {
      try {
        const item = await mediaItem(id);
        if (!scope.alive) return;
        media = item;
        headerStatus.textContent = "";
        drawHeader();
        reader.update(item);
        if (!pickerMounted) void mountPicker(item.folder_id);
        if (mediaStage(item.status) !== "processing" && item.review_blurb_status !== "pending") return;
      } catch (error) {
        if (unlinked(error)) return;
        if (!media && scope.alive) {
          headerStatus.className = "status error";
          headerStatus.textContent = msg("panelLoadFailed");
        }
      }
      await sleep(MEDIA_POLL_MS);
    }
  })();

  mounted = {
    mediaItemId: id,
    scope,
    setOrigin(next) {
      origin = next;
      drawChip();
    },
  };
}

/** "Alt+S", or whatever the reader set in the browser's shortcut settings. */
async function showShortcut(row: HTMLElement): Promise<void> {
  // Firefox for Android has no keyboard shortcuts at all.
  const commands = browser.commands ? await browser.commands.getAll().catch(() => []) : [];
  const keys = commands.find((command) => command.name === "_execute_action")?.shortcut;
  row.hidden = !keys;
  if (keys) row.append(msg("shortcutHint").replace("{keys}", keys));
}

/** A right-click save that failed: why, and the same save again. */
async function drawBanner(): Promise<void> {
  const banner = $("banner");
  const failed = await contextFailure().catch(() => null);
  if (!failed) {
    banner.hidden = true;
    return;
  }
  const { failure, save } = failed;
  const what = msg(save.kind === "link" ? "linkFailed" : "selectionFailed");
  const text = el("p", { text: `${what} ${failureMessage(failure)}` });
  const dismiss = el("button", { className: "ibtn small", attrs: { type: "button", "aria-label": msg("dismiss"), title: msg("dismiss") } }, icon("close", 16));
  dismiss.onclick = () => void clearContextFailure();
  const actions: Node[] = [];
  if (retryable(failure)) {
    const retry = el("button", { className: "link", attrs: { type: "button" } }, icon("refresh-outline", 15), msg("retry"));
    retry.onclick = async () => {
      retry.disabled = true;
      try {
        if (save.kind === "link") await savePage(save.url, save.folderId);
        else await saveSelection(save.text, save.url, save.folderId);
        await clearContextFailure();
      } catch (error) {
        if (unlinked(error)) return;
        text.textContent = `${what} ${failureMessage(saveFailure(error))}`;
        retry.disabled = false;
      }
    };
    actions.push(retry);
  }
  banner.replaceChildren(icon("alert-circle-outline", 18), el("div", { className: "banner-body" }, text, ...actions), dismiss);
  banner.hidden = false;
}

// --- Pairing ---------------------------------------------------------------------------------------
$("open-account").onclick = () => void browser.tabs.create({ url: ACCOUNT_EXTENSION_URL });
$<HTMLFormElement>("rescue").onsubmit = async (event) => {
  event.preventDefault();
  const status = $("pair-status");
  status.textContent = "";
  const linked = await claimPairingCode($<HTMLInputElement>("email").value, $<HTMLInputElement>("code").value).catch(() => false);
  if (linked) await render();
  else status.textContent = msg("pairFailed");
};
