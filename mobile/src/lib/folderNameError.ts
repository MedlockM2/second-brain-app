import { Alert } from "react-native";
import { t } from "../i18n";

export { isFolderNameConflict } from "@media-summarizer/core/organization/folderNames";

/** Only OK dismisses the refusal; callers keep the draft until it is corrected. */
export function acknowledgeFolderNameError(message = t("folders.duplicateMessage"), title = t("folders.duplicateTitle")): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(title, message,
      [{ text: t("common.ok"), onPress: () => resolve() }], { cancelable: false });
  });
}
