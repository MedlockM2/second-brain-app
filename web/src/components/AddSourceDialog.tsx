import { extractUrlFromText } from "@media-summarizer/core/media/urlValidation";
import { validateSharedNoteText } from "@media-summarizer/core/types/sharedContent";
import { isImageUpload, prepareLocalUploadFile } from "@media-summarizer/core/types/upload";
import { useRef, useState, type DragEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { addFile, addLink, addNote } from "../media/ingest";
import { startPendingImport } from "../media/pendingImports";
import { AudioNoteRecorder } from "./AudioNoteRecorder";
import { Icon } from "./Icon";

/**
 * Add one source: a pasted link, a pasted text (saved as a note), or one file
 * chosen or dropped here (captures 14 and the mockup's add dialog). With a
 * `folder`, the source is filed there on arrival; without one it lands in
 * Unsorted. "Add" starts one tracked import and releases the dialog immediately,
 * as on mobile. The caller can offer filing before the server names the save.
 *
 * `initialFile` / `initialText` open it already filled: a file dropped anywhere
 * in the app, a link pasted outside a text field.
 */
export function AddSourceDialog({
  folder,
  initialFile = null,
  initialText = "",
  initialRecording = false,
  onStarted,
  onClose,
}: {
  folder: { id: string; name: string } | null;
  initialFile?: File | null;
  initialText?: string;
  initialRecording?: boolean;
  onStarted: (importKey: string) => void;
  onClose: () => void;
}) {
  const { t, tw } = useI18n();
  const [link, setLink] = useState(initialText);
  const [file, setFile] = useState<File | null>(initialFile);
  const [recording, setRecording] = useState(initialRecording);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);

  const take = (files: FileList | null) => {
    const first = files?.[0];
    if (!first) return;
    setFile(first);
    setLink("");
    setError(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(false);
    take(event.dataTransfer.files);
  };

  const submit = (recordedFile?: File) => {
    if (submitted.current) return;
    setError(null);
    const selectedFile = recordedFile ?? file;
    const url = selectedFile ? null : extractUrlFromText(link);
    const folderId = folder?.id ?? null;
    let mediaType: "unknown" | "audio" | "document" | "shared_text" = url ? "unknown" : "shared_text";
    let labelKey = url ? "saved_item" : "shared_note";
    if (selectedFile) {
      const prepared = prepareLocalUploadFile({ uri: "", name: selectedFile.name, mimeType: selectedFile.type, size: selectedFile.size });
      if ("rejection" in prepared) { setError(prepared.rejection.message); return; }
      mediaType = prepared.file.kind === "audio" ? "audio" : "document";
      labelKey = recordedFile ? "voice_note" : prepared.file.kind === "audio" ? "audio_note"
        : isImageUpload(prepared.file) ? "photo" : "document";
    } else if (!url) {
      const validated = validateSharedNoteText(link);
      if ("rejection" in validated) { setError(validated.rejection.message); return; }
    }
    submitted.current = true;
    const key = startPendingImport({ kind: selectedFile ? "file" : "other", mediaType, labelKey, folderId }, () =>
      selectedFile ? addFile(selectedFile, folderId) : url ? addLink(url, folderId) : addNote(link, folderId),
    );
    onStarted(key);
  };

  const title = folder ? tw("add.titleFolder", { name: folder.name }) : tw("add.titleLibrary");

  if (recording) return <AudioNoteRecorder
    onClose={onClose}
    onRecorded={(audio) => {
      setFile(audio);
      setLink("");
      setRecording(false);
      void submit(audio);
    }}
  />;

  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="row">
          <h2 className="headline grow">{title}</h2>
          <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {file ? (
          <div className="file-chip">
            <Icon name="document-attach-outline" size={18} />
            <span className="grow ell">{file.name}</span>
            <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label={tw("add.removeFile")} onClick={() => setFile(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : (
          <>
            <label className="field note-field" style={{ borderRadius: "var(--r-md)" }}>
              <Icon name="link-outline" size={18} />
              <textarea
                autoFocus
                rows={link.includes("\n") || link.length > 80 ? 4 : 1}
                placeholder={tw("add.linkPlaceholder")}
                aria-label={tw("add.linkPlaceholder")}
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => {
                  // Enter adds a link; a note takes its line breaks with Shift+Enter.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </label>
            <p className="small muted" style={{ margin: "-6px 4px 0" }}>
              {link.trim() && !extractUrlFromText(link) ? tw("add.noteHint") : tw(folder ? "add.hintFolder" : "add.hintLibrary")}
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
            {!folder && <p className="small muted" style={{ margin: "0 4px" }}>{tw("add.tip")}</p>}
          </>
        )}

        {error && (
          <div className="banner-err" role="alert">
            <Icon name="alert-circle-outline" size={18} />
            <span>{error}</span>
          </div>
        )}

        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn primary" disabled={!file && !link.trim()}>
            {t("addUrl.submit")}
          </button>
        </footer>
      </form>
    </div>
  );
}
