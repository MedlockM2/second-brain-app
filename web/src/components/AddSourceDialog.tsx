import { extractUrlFromText } from "@media-summarizer/core/media/urlValidation";
import { useRef, useState, type DragEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { addFile, addLink } from "../media/ingest";
import { Icon } from "./Icon";

/**
 * Add one source: a pasted link, or one file chosen or dropped here (capture
 * 14). With a `folder`, the source is filed there on arrival; without one it
 * lands in Unsorted. The import starts on "Add" and the dialog closes: the
 * page re-reads itself and shows the source being processed.
 */
export function AddSourceDialog({
  folder,
  onAdded,
  onClose,
}: {
  folder: { id: string; name: string } | null;
  onAdded: (mediaItemId: string) => void;
  onClose: () => void;
}) {
  const { t, tw } = useI18n();
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const take = (files: FileList | null) => {
    const first = files?.[0];
    if (!first) return;
    setFile(first);
    setLink("");
    setError(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files);
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    let url: string | null = null;
    if (!file) {
      url = extractUrlFromText(link);
      if (!url) {
        setError(t("addUrl.error.invalid"));
        return;
      }
    }
    setBusy(true);
    try {
      const id = file ? await addFile(file, folder?.id ?? null) : await addLink(url!, folder?.id ?? null);
      onAdded(id);
      onClose();
    } catch (caught) {
      setError((caught as Error).message);
      setBusy(false);
    }
  };

  const title = folder ? tw("add.titleFolder", { name: folder.name }) : tw("add.titleLibrary");

  return (
    <div className="scrim" onClick={busy ? undefined : onClose}>
      <form
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="row">
          <h2 className="headline grow">{title}</h2>
          <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose} disabled={busy}>
            <Icon name="close" />
          </button>
        </div>

        {file ? (
          <div className="file-chip">
            <Icon name="document-attach-outline" size={18} />
            <span className="grow ell">{file.name}</span>
            <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label={tw("add.removeFile")} onClick={() => setFile(null)} disabled={busy}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : (
          <>
            <label className="field" style={{ borderRadius: "var(--r-md)" }}>
              <Icon name="link-outline" size={18} />
              <input
                autoFocus
                type="url"
                inputMode="url"
                placeholder={tw("add.linkPlaceholder")}
                aria-label={t("addSource.enterUrl.label")}
                value={link}
                onChange={(event) => setLink(event.target.value)}
              />
            </label>
            <p className="small muted" style={{ margin: "-6px 4px 0" }}>
              {tw(folder ? "add.hintFolder" : "add.hintLibrary")}
            </p>
            <div
              className={over ? "dropzone over" : "dropzone"}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <Icon name="cloud-upload-outline" size={24} />
              <div style={{ fontWeight: 500 }}>
                {tw("add.drop")}{" "}
                <button type="button" className="link" onClick={() => picker.current?.click()}>
                  {tw("add.browse")}
                </button>
              </div>
              <div className="small muted">{tw("add.formats")}</div>
              <input ref={picker} type="file" hidden onChange={(event) => take(event.target.files)} />
            </div>
          </>
        )}

        {error && (
          <div className="banner-err" role="alert">
            <Icon name="alert-circle-outline" size={18} />
            <span>{error}</span>
          </div>
        )}

        <footer>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn primary" disabled={busy || (!file && !link.trim())}>
            {busy && file ? tw("add.uploading") : t("addUrl.submit")}
          </button>
        </footer>
      </form>
    </div>
  );
}
