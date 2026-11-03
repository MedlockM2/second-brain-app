import { useRef, useState } from "react";
import { Alert } from "react-native";
import { MAX_ARTIFACT_TITLE_LENGTH } from "@media-summarizer/core/types/artifacts";
import type { AnchoredContextMenuProps, AnchorRect } from "../components/AnchoredContextMenu";
import type { RenameDialogProps } from "../components/RenameDialog";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";

/** The library's menu and naming dialog, shared by artifact rows and Home tiles. */
export function useArtifactActions<T>({ titleOf, rename, remove }: {
  titleOf: (item: T) => string;
  rename: (item: T, title: string) => Promise<void>;
  remove: (item: T) => Promise<void>;
}) {
  const [target, setTarget] = useState<T | null>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [visible, setVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const closeRename = () => { if (!busy.current) setRenameVisible(false); };
  const submit = async (title: string) => {
    if (target === null || busy.current) return;
    if (title === titleOf(target)) { setRenameVisible(false); return; }
    busy.current = true;
    setRenaming(true);
    setError(null);
    try {
      await rename(target, title);
      setRenameVisible(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { fallback: t("artifactActions.renameFailed") }));
    } finally { busy.current = false; setRenaming(false); }
  };
  const deleteTarget = async (item: T) => {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    try { await remove(item); setVisible(false); }
    catch (err) {
      Alert.alert(t("common.error"), getFriendlyErrorMessage(err, { fallback: t("artifactActions.deleteFailed") }));
    } finally { busy.current = false; setDeleting(false); }
  };

  const menuProps: Omit<AnchoredContextMenuProps<T>, "renderPreview"> = {
    visible, target, anchor, isBusy: deleting,
    onClose: () => { if (!busy.current) setVisible(false); },
    testIDPrefix: "artifact-actions",
    actions: [
      { key: "rename", icon: "pencil-outline", label: t("mediaActions.rename.label"), closesMenu: true,
        testID: "artifact-actions-rename", onPress: () => {
          if (target === null) return;
          setDraft(titleOf(target)); setError(null); setRenameVisible(true);
        } },
      { key: "delete", icon: "trash-outline", label: t("common.delete"), closesMenu: false,
        destructive: true, isBusy: deleting, testID: "artifact-actions-delete", onPress: () => {
          if (target === null || busy.current) return;
          const item = target;
          Alert.alert(t("artifactActions.deleteTitle"), t("artifactActions.deleteBody", { title: titleOf(item) }), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.delete"), style: "destructive", onPress: () => void deleteTarget(item) },
          ]);
        } },
    ],
  };
  const renameProps: RenameDialogProps = {
    visible: renameVisible, heading: t("artifactActions.rename.title"), placeholder: t("artifactActions.rename.placeholder"),
    maxLength: MAX_ARTIFACT_TITLE_LENGTH, value: draft, onChangeText: value => { setDraft(value); setError(null); },
    isSaving: renaming, errorMessage: error, onClose: closeRename, onSubmit: title => void submit(title), testIDPrefix: "artifact-rename",
  };
  return { open: (item: T, rect: AnchorRect) => {
    if (busy.current) return;
    setTarget(item); setAnchor(rect); setVisible(true);
  }, menuProps, renameProps };
}
