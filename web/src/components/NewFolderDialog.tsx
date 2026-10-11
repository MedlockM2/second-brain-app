import type { Folder } from "@media-summarizer/core/types/organization";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";

/**
 * Create a folder at the root of the library. Folders have one level: the body
 * always names no parent, and no screen offers to create one inside another.
 */
export function NewFolderDialog({
  onCreated,
  onClose,
}: {
  onCreated: (folder: Folder) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const folder = await apiRequest<Folder>("/api/folders", {
        method: "POST",
        body: { name: trimmed, parent_folder_id: null },
      });
      onCreated(folder);
    } catch {
      // The dialog stays open with the typed name, so a retry is one click.
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("search.newFolder.title")}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 className="headline">{t("search.newFolder.title")}</h2>
        <label className="field">
          <span className="visually-hidden">{t("folderPicker.namePlaceholder")}</span>
          <input
            ref={input}
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
        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {t("search.newFolder.create")}
          </button>
        </footer>
      </form>
    </div>
  );
}
