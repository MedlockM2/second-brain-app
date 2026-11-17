import { browser } from "wxt/browser";
import type { Folder } from "@media-summarizer/core/types/organization";
import { msg } from "./i18n";
import { icon } from "./icons";

/**
 * The folder of a save: a chip naming it, which opens a menu with a search
 * field over the folders and, when nothing matches exactly, a "Create “…”" row.
 * Built for a library of hundreds of folders, where a native list would have to
 * be scrolled. The root is the menu's positioning context.
 *
 * Keyboard: ↑ ↓ move, Enter picks, Escape closes.
 */
export interface FolderPickerOptions {
  folders: Folder[];
  /** The save's folder; `null` is Unsorted. */
  selected: string | null;
  onPick: (folder: Folder) => Promise<void>;
  onCreate: (name: string) => Promise<Folder>;
  /** Shown when picking or creating failed; the picker stays open. */
  onError: (error: unknown, creating: boolean) => void;
}

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();

export function mountFolderPicker(root: HTMLElement, options: FolderPickerOptions): void {
  const folders = [...options.folders];
  const collator = new Intl.Collator(browser.i18n.getUILanguage(), { sensitivity: "base", numeric: true });
  const label = (folder: Folder): string => {
    const byId = new Map(folders.map((entry) => [entry.id, entry]));
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
  const sort = () => folders.sort((a, b) => Number(b.is_default) - Number(a.is_default) || collator.compare(label(a), label(b)));
  sort();

  let selected = options.selected
    ? folders.find((folder) => folder.id === options.selected) ?? null
    : folders.find((folder) => folder.is_default) ?? null;
  let busy = false;
  let active = 0;
  let rows: { element: HTMLElement; run: () => Promise<void> }[] = [];

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "chip folder";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const triggerLabel = document.createElement("span");
  triggerLabel.className = "picker-value";
  trigger.append(icon("folder-outline", 15), triggerLabel, icon("chevron-down", 13));

  const panel = document.createElement("div");
  panel.className = "menu picker-menu";
  panel.hidden = true;
  const searchRow = document.createElement("label");
  searchRow.className = "picker-search";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = msg("folderSearch");
  search.setAttribute("aria-label", search.placeholder);
  search.setAttribute("role", "combobox");
  search.setAttribute("aria-autocomplete", "list");
  const list = document.createElement("ul");
  list.className = "picker-list";
  list.setAttribute("role", "listbox");
  list.id = `picker-${crypto.randomUUID()}`;
  search.setAttribute("aria-controls", list.id);
  searchRow.append(icon("search-outline", 16), search);
  panel.append(searchRow, list);
  root.replaceChildren(trigger, panel);

  const showSelected = () => {
    triggerLabel.textContent = selected ? label(selected) : msg("unsorted");
    trigger.setAttribute("aria-label", `${msg("folder")} : ${triggerLabel.textContent}`);
  };
  const setOpen = (open: boolean, refocus = true) => {
    panel.hidden = !open;
    trigger.classList.toggle("on", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      search.value = "";
      draw();
      search.focus();
    } else if (refocus) {
      trigger.focus();
    }
  };
  const highlight = (index: number) => {
    active = Math.max(0, Math.min(index, rows.length - 1));
    rows.forEach((row, position) => row.element.setAttribute("aria-selected", String(position === active)));
    const current = rows[active]?.element;
    if (current) {
      search.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView({ block: "nearest" });
    }
  };
  const settle = async (task: () => Promise<Folder>, creating: boolean) => {
    if (busy) return;
    busy = true;
    root.classList.add("busy");
    try {
      selected = await task();
      showSelected();
      setOpen(false);
    } catch (error) {
      options.onError(error, creating);
    } finally {
      busy = false;
      root.classList.remove("busy");
    }
  };

  function draw(): void {
    const query = fold(search.value);
    const matches = folders.filter((folder) => fold(label(folder)).includes(query));
    rows = matches.map((folder) => ({
      element: row(label(folder), folder.id === selected?.id),
      run: () => settle(async () => { await options.onPick(folder); return folder; }, false),
    }));
    const name = search.value.trim();
    if (name && !folders.some((folder) => !folder.is_default && fold(folder.name) === fold(name))) {
      const create = row(msg("folderCreate").replace("{name}", name), false);
      create.classList.add("picker-create");
      create.prepend(icon("add", 16));
      rows.push({
        element: create,
        run: () => settle(async () => {
          const folder = await options.onCreate(name);
          folders.push(folder);
          sort();
          await options.onPick(folder);
          return folder;
        }, true),
      });
    }
    if (rows.length === 0) {
      const empty = document.createElement("li");
      empty.className = "picker-empty";
      empty.textContent = msg("folderNoMatches");
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...rows.map((entry) => entry.element));
    rows.forEach((entry, index) => {
      entry.element.onmousedown = (event) => event.preventDefault();
      entry.element.onclick = () => { highlight(index); void entry.run(); };
    });
    highlight(0);
  }

  function row(text: string, current: boolean): HTMLElement {
    const item = document.createElement("li");
    item.id = `${list.id}-${crypto.randomUUID()}`;
    item.className = current ? "picker-row current" : "picker-row";
    item.setAttribute("role", "option");
    item.textContent = text;
    return item;
  }

  trigger.onclick = () => setOpen(panel.hidden);
  // A click anywhere else closes the menu, as menus do.
  document.addEventListener("mousedown", (event) => {
    if (!panel.hidden && !root.contains(event.target as Node)) setOpen(false, false);
  });
  search.oninput = draw;
  search.onkeydown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); highlight(active + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); highlight(active - 1); }
    else if (event.key === "Enter") { event.preventDefault(); void rows[active]?.run(); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  };
  showSelected();
}
