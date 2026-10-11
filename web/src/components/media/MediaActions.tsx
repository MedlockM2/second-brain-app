import type { Folder } from "@media-summarizer/core/types/organization";
import type { PatchMediaResponse } from "@media-summarizer/core/types/media";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api";
import { useI18n } from "../../i18n/I18nProvider";
import { Dialog } from "../Dialog";
import { Icon } from "../Icon";
import { NewFolderDialog } from "../NewFolderDialog";

/**
 * The `…` of a media: file it in a folder (an existing one, or a new one at the
 * root), rename it, delete it — the mobile `useMediaActions`, each on its
 * existing endpoint (`PATCH` / `DELETE /api/media/:id`). Folders are never
 * moved from here: a media is filed, a folder stays where it is.
 */
type Open = null | "menu" | "move" | "new-folder" | "rename" | "delete";

export function MediaActions({
  mediaId,
  title,
  folderId,
  roots,
  onFolderCreated,
  onMoved,
  onRenamed,
  onDeleted,
}: {
  mediaId: string;
  title: string;
  folderId: string | null;
  /** The root folders, Unsorted first (`useFolders().roots`). */
  roots: Folder[];
  onFolderCreated: (folder: Folder) => void;
  onMoved: (folder: Folder) => void;
  onRenamed: (title: string) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Open>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const path = `/api/media/${encodeURIComponent(mediaId)}`;

  useEffect(() => {
    if (open !== "menu") return;
    const close = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moveTo = async (folder: Folder) => {
    await apiRequest<PatchMediaResponse>(path, { method: "PATCH", body: { folder_id: folder.id } });
    onMoved(folder);
    setOpen(null);
  };

  const item = (key: Exclude<Open, null | "menu">, icon: Parameters<typeof Icon>[0]["name"], label: string, danger = false) => (
    <button type="button" role="menuitem" className={danger ? "danger" : undefined} onClick={() => setOpen(key)}>
      <Icon name={icon} size={18} />
      {label}
    </button>
  );

  return (
    <div className="menu-anchor" ref={anchor}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t("mediaActions.moreA11y")}
        title={t("mediaActions.moreA11y")}
        aria-haspopup="menu"
        aria-expanded={open === "menu"}
        onClick={() => setOpen(open === "menu" ? null : "menu")}
      >
        <Icon name="ellipsis-horizontal" />
      </button>
      {open === "menu" && (
        <div className="menu" role="menu">
          {item("move", "folder-outline", t("mediaActions.move.label"))}
          {item("new-folder", "add-circle-outline", t("mediaActions.newFolder.label"))}
          {item("rename", "pencil-outline", t("mediaActions.rename.label"))}
          {item("delete", "trash-outline", t("mediaActions.delete.label"), true)}
        </div>
      )}
      {open === "move" && (
        <MoveDialog roots={roots} currentId={folderId} onPick={moveTo} onClose={() => setOpen(null)} />
      )}
      {open === "new-folder" && (
        <NewFolderDialog
          onClose={() => setOpen(null)}
          onCreated={async (folder) => {
            onFolderCreated(folder);
            await moveTo(folder);
          }}
        />
      )}
      {open === "rename" && (
        <RenameDialog
          initial={title}
          onClose={() => setOpen(null)}
          onSave={async (next) => {
            const response = await apiRequest<PatchMediaResponse>(path, { method: "PATCH", body: { title: next } });
            onRenamed(response.title?.trim() || next);
            setOpen(null);
          }}
        />
      )}
      {open === "delete" && (
        <DeleteDialog
          title={title}
          onClose={() => setOpen(null)}
          onConfirm={async () => {
            await apiRequest(path, { method: "DELETE" });
            setOpen(null);
            onDeleted();
          }}
        />
      )}
    </div>
  );
}

/** File the media in one of the root folders. */
function MoveDialog({
  roots,
  currentId,
  onPick,
  onClose,
}: {
  roots: Folder[];
  currentId: string | null;
  onPick: (folder: Folder) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pick = async (folder: Folder) => {
    setBusy(true);
    setFailed(false);
    try {
      await onPick(folder);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("mediaActions.move.label")}
      onClose={onClose}
      footer={
        <button type="button" className="btn ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
      }
    >
      <div className="list" role="listbox" aria-label={t("folderPicker.title")}>
        {roots.map((folder) => {
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
              <span className="grow ell">{folder.is_default ? t("folderPicker.unsorted") : folder.name}</span>
              {current && <Icon name="checkmark" size={18} />}
            </button>
          );
        })}
      </div>
      {failed && (
        <div className="banner-err" role="alert">
          {t("folderPicker.saveFailed")}
        </div>
      )}
    </Dialog>
  );
}

function RenameDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (title: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    const next = value.trim();
    if (!next || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSave(next);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("mediaActions.rename.title")}
      onClose={onClose}
      onSubmit={() => void save()}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn primary" disabled={busy || !value.trim()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="visually-hidden">{t("mediaActions.rename.placeholder")}</span>
        <input
          autoFocus
          placeholder={t("mediaActions.rename.placeholder")}
          value={value}
          maxLength={300}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {failed && (
        <div className="banner-err" role="alert">
          {t("mediaActions.renameFailed")}
        </div>
      )}
    </Dialog>
  );
}

function DeleteDialog({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("mediaActions.deleteTitle")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="btn primary" style={{ background: "var(--error)", color: "var(--on-error)" }} disabled={busy} onClick={() => void confirm()}>
            {t("common.delete")}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{t("mediaActions.deleteBody", { title })}</p>
      {failed && (
        <div className="banner-err" role="alert">
          {t("mediaActions.deleteFailed")}
        </div>
      )}
    </Dialog>
  );
}
