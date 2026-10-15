import { isFolderNameConflict } from "@media-summarizer/core/organization/folderNames";
import type { Folder } from "@media-summarizer/core/types/organization";
import { useState } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { Dialog } from "./Dialog";

/**
 * Create a folder at the root of the library. Folders have one level: the body
 * always names no parent, and no screen offers to create one inside another.
 * `onCreated` may be async (filing a media into the new folder): the dialog
 * stays busy until it settles, and stays open with the name if it throws.
 */
export function NewFolderDialog({
  onCreated,
  onClose,
}: {
  onCreated: (folder: Folder) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nameConflict, setNameConflict] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const folder = await apiRequest<Folder>("/api/folders", {
        method: "POST",
        body: { name: trimmed, parent_folder_id: null },
      });
      await onCreated(folder);
    } catch (error) {
      if (isFolderNameConflict(error)) setNameConflict(true);
      // The dialog stays open with the typed name, so a retry is one click.
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
      title={t("search.newFolder.title")}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {t("search.newFolder.create")}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="visually-hidden">{t("folderPicker.namePlaceholder")}</span>
        <input
          autoFocus
          placeholder={t("folderPicker.namePlaceholder")}
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {failed && (
        <div className="banner-err" role="alert">
          {t("folderPicker.createFailed")}
        </div>
      )}
    </Dialog>
  );
}
