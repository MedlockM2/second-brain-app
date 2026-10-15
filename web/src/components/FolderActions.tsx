import { isFolderNameConflict } from "@media-summarizer/core/organization/folderNames";
import type { Folder } from "@media-summarizer/core/types/organization";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/**
 * The `…` of a folder: Rename and Delete, and nothing else — folders have one
 * level, so there is no "move the folder" and no folder inside a folder
 * (owner decision, 2026-10-11). Deleting a folder deletes none of its sources:
 * the API moves them to Unsorted (`DELETE /api/folders/:id`).
 */
export function FolderActions({
  folder,
  onRenamed,
  onDeleted,
}: {
  folder: Folder;
  onRenamed: (folder: Folder) => void;
  onDeleted: () => void;
}) {
  const { t, tw } = useI18n();
  const [open, setOpen] = useState<null | "menu" | "rename" | "delete">(null);
  const anchor = useRef<HTMLDivElement>(null);
  const path = `/api/folders/${encodeURIComponent(folder.id)}`;

  useEffect(() => {
    if (open !== "menu") return;
    const close = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="menu-anchor" ref={anchor}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t("folderActions.moreA11y")}
        title={t("folderActions.moreA11y")}
        aria-haspopup="menu"
        aria-expanded={open === "menu"}
        onClick={() => setOpen(open === "menu" ? null : "menu")}
      >
        <Icon name="ellipsis-horizontal" />
      </button>
      {open === "menu" && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={() => setOpen("rename")}>
            <Icon name="pencil-outline" size={18} />
            {t("folderActions.rename.label")}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => setOpen("delete")}>
            <Icon name="trash-outline" size={18} />
            {t("folderActions.delete.label")}
          </button>
        </div>
      )}
      {open === "rename" && (
        <RenameFolderDialog
          initial={folder.name}
          onClose={() => setOpen(null)}
          onSave={async (name) => {
            const saved = await apiRequest<Folder>(path, { method: "PUT", body: { name } });
            onRenamed({ ...folder, ...saved });
            setOpen(null);
          }}
        />
      )}
      {open === "delete" && (
        <ConfirmDelete
          body={t("folderActions.deleteBody", { name: folder.name, unsorted: tw("nav.unsortedNoCount") })}
          onClose={() => setOpen(null)}
          onConfirm={async () => {
            await apiRequest(path, { method: "DELETE" });
            onDeleted();
          }}
        />
      )}
    </div>
  );
}

function RenameFolderDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nameConflict, setNameConflict] = useState(false);
  const save = async () => {
    const name = value.trim();
    if (!name || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSave(name);
    } catch (error) {
      if (isFolderNameConflict(error)) setNameConflict(true);
      setFailed(true);
      setBusy(false);
    }
  };
  if (nameConflict) return (
    <Dialog title={t("folders.duplicateTitle")} onClose={() => {}}
      footer={<button type="button" className="btn primary" autoFocus
        onClick={() => setNameConflict(false)}>{t("common.ok")}</button>}>
      <p role="alert">{t("folders.duplicateMessage")}</p>
    </Dialog>
  );

  return (
    <Dialog
      title={t("folderActions.rename.title")}
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
        <span className="visually-hidden">{t("folderActions.rename.placeholder")}</span>
        <input
          autoFocus
          placeholder={t("folderActions.rename.placeholder")}
          value={value}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {failed && (
        <div className="banner-err" role="alert">
          {t("folderActions.renameFailed")}
        </div>
      )}
    </Dialog>
  );
}

function ConfirmDelete({
  body,
  onConfirm,
  onClose,
}: {
  body: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Dialog
      title={t("folderActions.deleteTitle")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ background: "var(--error)", color: "var(--on-error)" }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                await onConfirm();
              } catch {
                setFailed(true);
                setBusy(false);
              }
            }}
          >
            {t("common.delete")}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{body}</p>
      {failed && (
        <div className="banner-err" role="alert">
          {t("folderActions.deleteFailed")}
        </div>
      )}
    </Dialog>
  );
}
