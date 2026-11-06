/**
 * Where the URL of a media is typed or pasted (task-379): one field, and the two
 * answers a link prompt can get.
 *
 * A surface of the app rather than a system prompt. `Alert.prompt` is iOS-only —
 * it does not exist on Android — so a dialog of our own is the only shape that can
 * be the same on both platforms. It is a card over a scrim for the same reason
 * `RenameDialog` is: a one-field entry reached from a menu, with the screen it was
 * opened from still visible behind it.
 *
 * The keyboard opens with the dialog (`FOCUS_DURING_PRESENTATION`) and the card
 * sits just above it, as `RenameDialog` does — not centred. A centred card is
 * lifted by half the keyboard height when the keyboard arrives, which on a phone
 * is about the distance from the field down to Cancel: a tap aimed at the field
 * as the keyboard came in began on Cancel and closed the dialog. Anchored above
 * the keyboard, the place the field leaves is taken by the keyboard itself, never
 * by an action. For the same reason nothing in the card puts the keyboard away —
 * neither a tap beside the field (`keyboardShouldPersistTaps="always"`) nor Go on
 * a refused link (`submitBehavior="submit"`): either would drop the card under
 * the next tap.
 *
 * Pasting is the keyboard's own paste, which every platform offers on a long press
 * in a text field. There is deliberately no "Paste" button: reading the clipboard
 * needs `expo-clipboard`, and that is a native module and therefore a new build —
 * out of the scope of this entry.
 *
 * Validation and submission belong to the caller. This component only reports what
 * was typed and shows the refusal it is handed back, so the field keeps its
 * content and a correction costs one tap rather than a retype.
 */

import { BudgetForecastNotice } from "./BudgetForecastNotice";
import { useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardViewport, type KeyboardViewportHandle } from "./KeyboardViewport";
import { useFocusedInputScroll } from "../hooks/useFocusedInputScroll";
import { FOCUS_DURING_PRESENTATION } from "../lib/modalFieldFocus";

export interface UrlEntryDialogProps {
  visible: boolean;
  /**
   * What the field shows. Held by the caller, which clears it when the dialog is
   * opened — so every opening starts empty rather than from a draft left over
   * from a cancelled entry.
   */
  value: string;
  onChangeText: (value: string) => void;
  /** Translated refusal of the last attempt, or `null`. */
  errorMessage: string | null;
  onClose: () => void;
  /** The raw text of the field: the caller extracts the URL from it. */
  onSubmit: (text: string) => void;
}

export function UrlEntryDialog({
  visible,
  value,
  onChangeText,
  errorMessage,
  onClose,
  onSubmit,
}: UrlEntryDialogProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const viewportRef = useRef<KeyboardViewportHandle>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputScroll = useFocusedInputScroll(scrollRef);
  const canSubmit = value.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={() => {
        viewportRef.current?.refresh();
        if (!FOCUS_DURING_PRESENTATION) inputRef.current?.focus();
      }}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <KeyboardViewport ref={viewportRef} active={visible}>
          {(keyboardVisible) => (
            <ScrollView
              ref={scrollRef}
              style={styles.form}
              contentContainerStyle={[
                styles.formContent,
                {
                  paddingTop: insets.top + Spacing.md,
                  paddingBottom: Spacing.md + (keyboardVisible ? 0 : insets.bottom),
                },
              ]}
              automaticallyAdjustKeyboardInsets={false}
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
              keyboardShouldPersistTaps="always"
              onLayout={inputScroll.reveal}
              onContentSizeChange={inputScroll.reveal}
              onScroll={inputScroll.onScroll}
              scrollEventThrottle={16}
            >
              <Pressable
                style={styles.backdrop}
                onPress={onClose}
                accessibilityLabel={t("common.dismiss")}
                accessibilityRole="button"
              />
              <View style={styles.card} testID="add-url-dialog">
                <Text style={styles.title}>{t("addUrl.title")}</Text>

                <TextInput
                  ref={inputRef}
                  autoFocus={FOCUS_DURING_PRESENTATION}
                  onFocus={() => inputScroll.focusInput(inputRef.current)}
                  style={styles.input}
                  value={value}
                  onChangeText={onChangeText}
                  placeholder={t("addUrl.placeholder")}
                  placeholderTextColor={Colors.textMuted}
                  // A web address is never capitalised, never a word the dictionary
                  // knows, and never one line broken into two.
                  keyboardType="url"
                  textContentType="URL"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  multiline={false}
                  returnKeyType="go"
                  // A refused link is corrected in place: the keyboard stays open.
                  submitBehavior="submit"
                  onSubmitEditing={handleSubmit}
                  // The field is emptied on every opening, so this only ever clears a
                  // paste the user wants to redo.
                  clearButtonMode="while-editing"
                  accessibilityLabel={t("addUrl.title")}
                  testID="add-url-input"
                />

                <BudgetForecastNotice />
                {errorMessage ? (
                  <Text style={styles.error} testID="add-url-error">
                    {errorMessage}
                  </Text>
                ) : (
                  <Text style={styles.hint}>{t("addUrl.hint")}</Text>
                )}

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                    onPress={onClose}
                    accessibilityLabel={t("common.cancel")}
                    accessibilityRole="button"
                    testID="add-url-cancel"
                  >
                    <Text style={styles.secondaryLabel}>{t("common.cancel")}</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.primaryButtonPressed,
                      !canSubmit && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    accessibilityLabel={t("addUrl.submit")}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSubmit }}
                    testID="add-url-submit"
                  >
                    <Text style={styles.primaryLabel}>{t("addUrl.submit")}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          )}
        </KeyboardViewport>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.scrim,
    },
    form: { flex: 1 },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    formContent: {
      flexGrow: 1,
      justifyContent: "flex-end",
      paddingHorizontal: Spacing.lg,
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      ...Shadows.soft,
    },
    title: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    // A tonal shift instead of a border: the field reads as a recessed surface,
    // which is how the design system separates without lines.
    input: {
      minHeight: TouchTarget.minimum,
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: Typography.body.fontSize,
      color: Colors.textMain,
      // A URL is stable ASCII, so it stays left-to-right even when the interface
      // language is not: an Arabic UI must not reorder the address being typed.
      textAlign: "left",
      writingDirection: "ltr",
    },
    hint: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
    error: {
      fontSize: Typography.small.fontSize,
      color: Colors.error,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: Spacing.sm,
    },
    secondaryButton: {
      minHeight: TouchTarget.minimum,
      paddingHorizontal: Spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.lg,
    },
    secondaryButtonPressed: {
      backgroundColor: Colors.surfaceContainerLow,
    },
    secondaryLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textSubtle,
    },
    primaryButton: {
      minHeight: TouchTarget.minimum,
      minWidth: TouchTarget.large,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.primary,
    },
    primaryButtonPressed: {
      opacity: 0.9,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.onPrimary,
    },
  });
