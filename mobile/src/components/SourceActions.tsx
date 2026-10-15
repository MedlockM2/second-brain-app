import React, { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useShareIntake, type ShareSelectedFolder } from "../contexts/ShareIntentContext";
import { AddSourceSheet } from "./AddSourceSheet";
import { UrlEntryDialog } from "./UrlEntryDialog";
import { capturePhotoToImport, pickFileToImport, pickPhotoFromLibrary, type LocalImportResult } from "../lib/localImport";
import { validateShareIntentPayload } from "../lib/urlValidation";
import { TAB_BAR_CLEARANCE } from "../constants/tabBar";
import { BorderRadius, Spacing, TouchTarget, type Theme } from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";

/** The same imports everywhere; destination is captured before a picker/auth flow. */
export function SourceActions({ folder = null, bottomOffset = TAB_BAR_CLEARANCE }: {
  folder?: ShareSelectedFolder | null; bottomOffset?: number;
}) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { startLocalUpload, startUrlEntry } = useShareIntake();
  const [isSourceSheetVisible, setSourceSheetVisible] = useState(false);
  const [isUrlDialogVisible, setUrlDialogVisible] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const urlHandedOver = useRef(false);
  const handleImportResult = useCallback(
    (result: LocalImportResult, contentType: "file" | "photo") => {
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        Alert.alert(result.title, result.message);
        return;
      }
      startLocalUpload(result.file, contentType, folder);
    },
    [startLocalUpload, folder],
  );

  // Both are fired by the sheet once it has finished closing, so the system
  // picker never has to present itself over a modal on its way out.
  const handleImportFile = useCallback(async () => {
    handleImportResult(await pickFileToImport(), "file");
  }, [handleImportResult]);

  const handleImportPhoto = useCallback(async () => {
    handleImportResult(await pickPhotoFromLibrary(), "photo");
  }, [handleImportResult]);

  const handleTakePhoto = useCallback(async () => {
    handleImportResult(await capturePhotoToImport(), "photo");
  }, [handleImportResult]);

  /**
   * Fired by the sheet once it has closed, for the same reason the two pickers
   * are: the dialog is a modal presented on the controller the sheet is leaving.
   */
  const handleEnterUrl = useCallback(() => {
    setUrlDraft("");
    setUrlError(null);
    urlHandedOver.current = false;
    setUrlDialogVisible(true);
  }, []);

  const handleCloseUrlDialog = useCallback(() => {
    setUrlDialogVisible(false);
    setUrlDraft("");
    setUrlError(null);
  }, []);

  /**
   * The one gate before an ingestion starts: the same extraction the share intent
   * goes through, so a link pasted with the sentence around it or typed without
   * its scheme is accepted here exactly as it is when it arrives from another app.
   *
   * A refusal stays in the dialog — no save is created, and the confirmation
   * screen is not opened — and leaves the field as it was, so a missing character
   * costs a correction rather than a retype.
   */
  const handleSubmitUrl = useCallback(
    (text: string) => {
      if (urlHandedOver.current) return;

      const validation = validateShareIntentPayload(text);
      if (!validation.valid) {
        setUrlError(t("addUrl.error.invalid"));
        return;
      }

      urlHandedOver.current = true;
      setUrlDialogVisible(false);
      setUrlDraft("");
      setUrlError(null);
      startUrlEntry(validation.url, folder);
    },
    [startUrlEntry, folder],
  );

  return (<>
      <View style={[styles.actions, { bottom: bottomOffset }]} pointerEvents="box-none">
        <Pressable
          testID={`${folder ? "folder" : "inbox"}-camera-button`}
          style={({ pressed }) => [
            styles.cameraButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={handleTakePhoto}
          accessibilityLabel={t("home.takePhotoA11y")}
          accessibilityRole="button"
        >
          <Ionicons name="camera" size={24} color={Colors.surface} />
        </Pressable>

        <Pressable
          testID={`${folder ? "folder" : "inbox"}-add-button`}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => setSourceSheetVisible(true)}
          accessibilityLabel={t("addSource.title")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={28} color={Colors.onPrimary} />
        </Pressable>
      </View>

      <AddSourceSheet
        visible={isSourceSheetVisible}
        onClose={() => setSourceSheetVisible(false)}
        onEnterUrl={handleEnterUrl}
        onImportFile={handleImportFile}
        onImportPhoto={handleImportPhoto}
      />

      <UrlEntryDialog
        visible={isUrlDialogVisible}
        value={urlDraft}
        onChangeText={setUrlDraft}
        errorMessage={urlError}
        onClose={handleCloseUrlDialog}
        onSubmit={handleSubmitUrl}
      />
  </>);
}
const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) => StyleSheet.create({
    actions: {
      position: "absolute",
      left: 0,
      right: 0,
      // Absolutely positioned, so nothing insets it for the bar: this row is the
      // reason `TAB_BAR_CLEARANCE` exists.
      padding: Spacing.sm,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: Spacing.md,
    },
    addButton: {
      width: TouchTarget.large,
      height: TouchTarget.large,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...Shadows.soft,
    },
    cameraButton: {
      width: TouchTarget.large,
      height: TouchTarget.large,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.textMain,
      alignItems: "center",
      justifyContent: "center",
      ...Shadows.soft,
    },
    addButtonPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },
});
