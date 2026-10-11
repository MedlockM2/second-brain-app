import type { Folder } from "@media-summarizer/core/types/organization";
import { useMemo, useState } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

/**
 * "File in a folder" (capture 18): a search field, the folders this browser
 * filed into lately, then every folder — or, when the search names none, the
 * row that creates it. Folders have one level: every destination is a root
 * folder, and a created one is created at the root.
 *
 * Shared by the `…` of a media, the follow-up of an import, and the unsorted
 * review (task-482). `inline` renders the list without the dialog chrome, for a
 * pane that keeps it open. `showUnsorted` offers Unsorted as a destination; the
 * unsorted review leaves it out.
 */
const RECENT_KEY = "deepn.recentFolders";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Remember a destination, most recent first, on this browser only. */
export function rememberFolder(folderId: string): void {
  try {
    const next = [folderId, ...readRecent().filter((id) => id !== folderId)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // The list of recent folders is a convenience; filing worked anyway.
  }
}

/** The folders this browser filed into lately, among `roots`, most recent first. */
export function recentFolders(roots: Folder[]): Folder[] {
  return readRecent()
    .map((id) => roots.find((folder) => folder.id === id && !folder.is_default))
    .filter((folder): folder is Folder => Boolean(folder));
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

export type FolderPickerProps = {
  /** Root folders, Unsorted first (`useFolders().roots`). */
  roots: Folder[];
  currentId?: string | null;
  showUnsorted?: boolean;
  /** Filing into it; a rejection keeps the picker open with an error. */
  onPick: (folder: Folder) => Promise<void>;
  /** A folder the picker created, before it is picked. */
  onCreated: (folder: Folder) => void;
  /** Number the recent folders 1 to 5, for a screen whose keys pick them. */
  numbered?: boolean;
};

export function FolderPickerList({
  roots,
  currentId = null,
  showUnsorted = true,
  onPick,
  onCreated,
  numbered = false,
}: FolderPickerProps) {
  const { t, tw } = useI18n();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => roots.filter((folder) => showUnsorted || !folder.is_default),
    [roots, showUnsorted],
  );
  const label = (folder: Folder) => (folder.is_default ? tw("nav.unsortedNoCount") : folder.name);
  const needle = fold(query.trim());
  const matches = needle ? candidates.filter((folder) => fold(label(folder)).includes(needle)) : candidates;
  const recent = needle ? [] : recentFolders(candidates);
  const exact = candidates.some((folder) => fold(label(folder)) === needle);

  const pick = async (folder: Folder) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPick(folder);
      rememberFolder(folder.id);
    } catch {
      setError(t("folderPicker.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = query.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    let folder: Folder;
    try {
      folder = await apiRequest<Folder>("/api/folders", { method: "POST", body: { name, parent_folder_id: null } });
    } catch {
      setError(t("folderPicker.createFailed"));
      setBusy(false);
      return;
    }
    onCreated(folder);
    setBusy(false);
    await pick(folder);
  };

  const row = (folder: Folder, number?: number) => {
    const current = folder.id === currentId || (folder.is_default && !currentId);
    return (
      <button
        key={folder.id}
        type="button"
        role="option"
        aria-selected={current}
        className={current ? "frow on" : "frow"}
        disabled={busy || current}
        onClick={() => void pick(folder)}
      >
        <Icon name={folder.is_default ? "file-tray-outline" : "folder-outline"} size={18} />
        <span className="grow ell">{label(folder)}</span>
        {current && <Icon name="checkmark" size={18} />}
        {number !== undefined && <kbd className="kbd">{number}</kbd>}
      </button>
    );
  };

  return (
    <div className="picker">
      <label className="field">
        <Icon name="search-outline" size={18} />
        <input
          autoFocus={!numbered}
          placeholder={tw("picker.search")}
          aria-label={tw("picker.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (matches.length === 1) void pick(matches[0]);
              else if (!exact && query.trim()) void create();
            }
          }}
        />
      </label>
      <div className="list" role="listbox" aria-label={t("folderPicker.title")}>
        {recent.length > 0 && (
          <>
            <div className="caps picker-cap">{tw("picker.recent")}</div>
            {recent.map((folder, i) => row(folder, numbered ? i + 1 : undefined))}
            <div className="caps picker-cap">{tw("picker.all")}</div>
          </>
        )}
        {matches.map((folder) => row(folder))}
        {needle && !exact && (
          <button type="button" className="frow" disabled={busy} onClick={() => void create()}>
            <Icon name="add-circle-outline" size={18} />
            <span className="grow ell">{tw("picker.create", { name: query.trim() })}</span>
          </button>
        )}
      </div>
      {error && (
        <div className="banner-err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** The picker in a dialog: the `…` of a media and the follow-up of an import. */
export function FolderPickerDialog(props: FolderPickerProps & { onClose: () => void }) {
  const { t, tw } = useI18n();
  return (
    <div className="scrim" onClick={props.onClose}>
      <div
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-label={tw("picker.title")}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") props.onClose();
        }}
      >
        <div className="row">
          <h2 className="headline grow">{tw("picker.title")}</h2>
          <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </div>
        <FolderPickerList {...props} />
        <footer>
          <button type="button" className="btn ghost" onClick={props.onClose}>
            {t("common.cancel")}
          </button>
        </footer>
      </div>
    </div>
  );
}
