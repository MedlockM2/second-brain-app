import type { Folder } from "@media-summarizer/core/types/organization";
import { createContext, useCallback, useContext, useState } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { useFolders } from "../media/useFolders";
import { filePendingImport, isPendingImportKey, usePendingImportOutcome } from "../media/pendingImports";
import { mediaPath } from "../routes";
import { Link } from "react-router";
import { AddSourceDialog } from "./AddSourceDialog";
import { Dialog } from "./Dialog";
import { FolderPickerDialog } from "./FolderPicker";

/**
 * The bar's "Add": the add dialog, then — the source being on its way to
 * Unsorted — the offer to file it now (the mockup's "add2" step), then the
 * folder picker. The import never waits on that choice: it started on "Add".
 */
type Step =
  | { kind: "closed" }
  | { kind: "add"; file: File | null; text: string; recordAudio: boolean; nonce: number }
  | { kind: "offer"; mediaId: string }
  | { kind: "pick"; mediaId: string };

export function useAddFlow() {
  const { t, tw } = useI18n();
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const outcome = usePendingImportOutcome(step.kind === "offer" || step.kind === "pick" ? step.mediaId : "");
  const failed = outcome?.state === "failed";

  const open = useCallback((preset?: { file?: File | null; text?: string; recordAudio?: boolean }) => {
    // A new nonce remounts the dialog, so a second drop replaces the first.
    setStep({ kind: "add", file: preset?.file ?? null, text: preset?.text ?? "", recordAudio: preset?.recordAudio ?? false, nonce: Date.now() });
  }, []);
  const close = () => setStep({ kind: "closed" });

  const node = (
    <>
      {step.kind === "add" && (
        <AddSourceDialog
          key={step.nonce}
          folder={null}
          initialFile={step.file}
          initialText={step.text}
          initialRecording={step.recordAudio}
          onClose={() => setStep((current) => (current.kind === "add" ? { kind: "closed" } : current))}
          onStarted={(mediaId) => {
            setStep({ kind: "offer", mediaId });
          }}
        />
      )}
      {(step.kind === "offer" || step.kind === "pick") && failed && (
        <Dialog title={t("share.saveFailed")} onClose={close} footer={
          <button type="button" className="btn primary" onClick={close}>{t("common.close")}</button>
        }>
          <p role="alert">{outcome.message}</p>
        </Dialog>
      )}
      {step.kind === "offer" && !failed && (
        <Dialog
          title={tw("add.afterTitle")}
          onClose={close}
          footer={
            <>
              <button type="button" className="btn ghost" onClick={close}>
                {tw("add.leaveUnsorted")}
              </button>
              <Link className="btn ghost" to={mediaPath(step.mediaId)} onClick={close}>
                {tw("add.openWhileUploading")}
              </Link>
              <button type="button" className="btn primary" autoFocus onClick={() => setStep({ kind: "pick", mediaId: step.mediaId })}>
                {tw("add.chooseFolder")}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{tw("add.afterBody")}</p>
        </Dialog>
      )}
      {step.kind === "pick" && !failed && <FilePicker mediaId={step.mediaId} onDone={() => {
        setStep(current => current.kind === "pick" && current.mediaId === step.mediaId ? { kind: "closed" } : current);
      }} />}
    </>
  );

  return { open, node };
}

/** File one media into a root folder chosen in the picker. */
export function FilePicker({ mediaId, onDone }: { mediaId: string; onDone: (folderName: string | null) => void }) {
  const { tw } = useI18n();
  const folders = useFolders();
  const file = async (folder: Folder) => {
    if (isPendingImportKey(mediaId)) filePendingImport(mediaId, folder.id);
    else await apiRequest(`/api/media/${encodeURIComponent(mediaId)}`, { method: "PATCH", body: { folder_id: folder.id } });
    onDone(folder.is_default ? tw("nav.unsortedNoCount") : folder.name);
  };
  return (
    <FolderPickerDialog
      roots={folders.roots}
      showUnsorted={false}
      onPick={file}
      onCreated={folders.add}
      onClose={() => onDone(null)}
    />
  );
}

type OpenAdd = (preset?: { file?: File | null; text?: string; recordAudio?: boolean }) => void;

/** The bar's add flow, for a screen that offers its own way in (the empty Home). */
export const AddFlowContext = createContext<OpenAdd | null>(null);

export function useOpenAdd(): OpenAdd {
  const open = useContext(AddFlowContext);
  if (!open) throw new Error("useOpenAdd must be used inside the app shell");
  return open;
}
