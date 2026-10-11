import { ACCOUNT_EXTENSION_URL } from "../../lib/config";
import { claimPairingCode, lastFolderId, listFolders, rememberFolder, savePage } from "../../lib/api";
import { localize, msg } from "../../lib/i18n";
import { NotLinkedError, linkState, signOut } from "../../lib/session";

/**
 * The toolbar popup: save the current tab's address into a folder — the
 * reading of the tab is what `activeTab` grants, on this click — or, when the
 * extension is not linked to an account, the two ways to link it.
 */
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

localize(document);
void render();

async function render(): Promise<void> {
  const state = await linkState();
  $("save").hidden = state !== "linked";
  $("pair").hidden = state === "linked";
  $("pair-expired").hidden = state !== "expired";
  if (state === "linked") await showSave();
}

async function showSave(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const savable = /^https?:\/\//.test(url);
  $("page-title").textContent = tab?.title ?? "";
  $("page-host").textContent = savable ? new URL(url).hostname.replace(/^www\./, "") : "";
  const button = $<HTMLButtonElement>("save-page");
  const status = $("save-status");
  button.disabled = !savable;
  status.textContent = "";
  status.classList.remove("error");
  if (!savable) {
    button.disabled = true;
    status.textContent = msg("notSavable");
  }

  const select = $<HTMLSelectElement>("folder");
  try {
    const [folders, remembered] = await Promise.all([listFolders(), lastFolderId()]);
    const collator = new Intl.Collator(chrome.i18n.getUILanguage(), { sensitivity: "base", numeric: true });
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const folderName = (folder: (typeof folders)[number]): string => {
      const names = [folder.is_default ? msg("unsorted") : folder.name];
      const seen = new Set([folder.id]);
      let parent = folder.parent_folder_id;
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        const ancestor = byId.get(parent);
        if (!ancestor) break;
        names.unshift(ancestor.name);
        parent = ancestor.parent_folder_id;
      }
      return names.join(" / ");
    };
    folders.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || collator.compare(folderName(a), folderName(b)));
    select.replaceChildren(
      ...folders.map((folder) => new Option(folderName(folder), folder.id)),
    );
    if (remembered && folders.some((folder) => folder.id === remembered)) select.value = remembered;
  } catch (error) {
    if (error instanceof NotLinkedError) return render();
    // Without the list, the source still lands in Unsorted.
    select.replaceChildren(new Option(msg("unsorted"), ""));
  }

  select.onchange = () => { void rememberFolder(select.value || null); };

  button.onclick = async () => {
    button.disabled = true;
    status.classList.remove("error");
    status.textContent = msg("saving");
    try {
      const folderId = select.value || null;
      await savePage(url, folderId);
      await rememberFolder(folderId);
      status.textContent = msg("saved");
    } catch (error) {
      if (error instanceof NotLinkedError) return render();
      status.classList.add("error");
      status.textContent = msg("saveFailed");
      button.disabled = false;
    }
  };

  $("sign-out").onclick = async () => {
    try {
      await signOut();
      await render();
    } catch {
      status.classList.add("error");
      status.textContent = msg("signOutFailed");
    }
  };
}

$("open-account").onclick = () => void chrome.tabs.create({ url: ACCOUNT_EXTENSION_URL });

$<HTMLFormElement>("rescue").onsubmit = async (event) => {
  event.preventDefault();
  const status = $("pair-status");
  status.textContent = "";
  const linked = await claimPairingCode($<HTMLInputElement>("email").value, $<HTMLInputElement>("code").value).catch(() => false);
  if (linked) await render();
  else status.textContent = msg("pairFailed");
};
