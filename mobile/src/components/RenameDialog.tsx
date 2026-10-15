/**
 * Where a rename is typed: one field, prefilled with the name the thing has now,
 * and the two answers a naming prompt can get.
 *
 * The field is focused after presentation. The card's first visible frame is
 * already above the keyboard, after its destination has been laid out.
 * A rename is a one-field edit
 * reached from a context menu, and pushing a route for it would take the user
 * away from the list they were filing — the list stays visible behind the scrim,
 * which is what makes the new name land somewhere recognisable.
 *
 * One dialog for every target. A media title and a folder name differ in
 * three things and nothing else: the heading, the placeholder and the ceiling the
 * field stops at (120 for a title, 255 for a folder name), so all three are
 * props and there is no second copy of this card.
 *
 * A failure is reported *inside* the dialog rather than through an alert: the
 * field keeps what was typed, so retrying is one tap and nothing has to be
 * typed twice. The message is handed down already translated by the hook that
 * owns the call.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type KeyboardMetrics,
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

export interface RenameDialogProps {
  visible: boolean;
  /** Names what is being renamed, e.g. `Rename this folder`. */
  heading: string;
  placeholder: string;
  /**
   * The server's own ceiling for this kind of name, so the field stops accepting
   * characters the write would reject.
   */
  maxLength: number;
  /**
   * What the field shows. Held by the hook, which seeds it with the current name
   * when the dialog is opened — so every opening starts from the stored name
   * rather than from a draft left over from a cancelled rename, and no state here
   * has to be resynchronised behind the props.
   */
  value: string;
  onChangeText: (value: string) => void;
  /** The write is in flight: the field is locked and Save shows a spinner. */
  isSaving: boolean;
  /** Translated failure of the last attempt, or `null`. */
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
  /**
   * The primary button's label. `Save` by default; a prompt that names something
   * new rather than renaming it says `Create`.
   */
  submitLabel?: string;
  /** Names the dialog and its controls for a flow, e.g. `media-rename`. */
  testIDPrefix: string;
}

export function RenameDialog(props: RenameDialogProps): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={() => inputRef.current?.focus()}
      onRequestClose={props.isSaving ? undefined : props.onClose}
    >
      {props.visible ? <NamingForm {...props} inputRef={inputRef} /> : null}
    </Modal>
  );
}

interface ModalViewport {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Resolve the keyboard destination, lay it out, then reveal. No layout animation. */
function NamingForm({
  heading,
  placeholder,
  maxLength,
  value,
  onChangeText,
  isSaving,
  errorMessage,
  onClose,
  onSubmit,
  submitLabel = t("common.save"),
  testIDPrefix,
  inputRef,
}: RenameDialogProps & {
  inputRef: RefObject<TextInput | null>;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !isSaving;
  const handleSubmit = () => {
    if (positioned && canSubmit) onSubmit(trimmed);
  };
  const insets = useSafeAreaInsets();
  const viewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const measurement = useRef(0);
  const revealed = useRef(false);
  const noKeyboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState<ModalViewport | null>(null);
  const [keyboard, setKeyboard] = useState(() => {
    const frame = Keyboard.metrics();
    return { resolved: !!frame?.height, frame: frame ?? null };
  });
  const resolved = useRef(keyboard.resolved);
  const [inputFocused, setInputFocused] = useState(false);
  const [laidOutHeight, setLaidOutHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const revision = ++measurement.current;
    viewportRef.current?.measureInWindow((left, top, width, height) => {
      if (
        !mounted.current ||
        revision !== measurement.current ||
        !width ||
        !height
      )
        return;
      setViewport((previous) =>
        previous?.top === top &&
        previous.left === left &&
        previous.width === width &&
        previous.height === height
          ? previous
          : { top, left, width, height },
      );
    });
  }, []);
  const acceptFrame = useCallback(
    (frame: KeyboardMetrics | null, allowNoKeyboard = false) => {
      // Hiding a keyboard from the underlying screen must not reveal the card
      // before this input's keyboard has announced its destination.
      const ready = !!frame?.height || revealed.current || allowNoKeyboard;
      resolved.current = ready;
      if (ready && noKeyboardTimer.current) {
        clearTimeout(noKeyboardTimer.current);
        noKeyboardTimer.current = null;
      }
      setKeyboard({ resolved: ready, frame });
      measure();
    },
    [measure],
  );

  // Register before Modal.onShow requests focus, including when a keyboard was
  // already open in the underlying search field. iOS supplies its destination
  // before the animation; Android supplies it after native window resizing.
  useLayoutEffect(() => {
    mounted.current = true;
    const show = (event: KeyboardEvent) => acceptFrame(event.endCoordinates);
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", () => acceptFrame(null)),
    ];
    if (Platform.OS === "ios")
      subscriptions.push(
        Keyboard.addListener("keyboardWillShow", show),
        Keyboard.addListener("keyboardWillChangeFrame", (event) => {
          if (revealed.current) show(event);
        }),
        Keyboard.addListener("keyboardWillHide", () => acceptFrame(null)),
      );
    return () => {
      mounted.current = false;
      measurement.current += 1;
      subscriptions.forEach((subscription) => subscription.remove());
      if (noKeyboardTimer.current) clearTimeout(noKeyboardTimer.current);
    };
  }, [acceptFrame]);

  const onInputFocus = useCallback(() => {
    setInputFocused(true);
    measure();
    if (resolved.current) return;
    if (noKeyboardTimer.current) clearTimeout(noKeyboardTimer.current);
    // A hardware keyboard or an IME that emits no frame must not leave the
    // form hidden indefinitely. Normal placement is driven by native events.
    noKeyboardTimer.current = setTimeout(
      () => acceptFrame(Keyboard.metrics() ?? null, true),
      1000,
    );
  }, [measure, acceptFrame]);

  const frame = keyboard.frame;
  const touchesBottom =
    viewport &&
    frame &&
    frame.height > 0 &&
    frame.screenY <= viewport.top + viewport.height + 1 &&
    frame.screenY + frame.height >= viewport.top + viewport.height - 1 &&
    frame.screenX < viewport.left + viewport.width &&
    frame.screenX + frame.width > viewport.left;
  // Clip to the keyboard's final top, rather than subtracting its height again
  // from an Android modal that the OS may already have resized.
  const targetHeight =
    viewport && keyboard.resolved
      ? touchesBottom
        ? Math.max(0, Math.min(viewport.height, frame.screenY - viewport.top))
        : viewport.height
      : null;
  const positioned =
    inputFocused &&
    targetHeight !== null &&
    laidOutHeight !== null &&
    Math.abs(laidOutHeight - targetHeight) < 1;
  useLayoutEffect(() => {
    if (positioned) revealed.current = true;
  }, [positioned]);

  return (
    <View
      ref={viewportRef}
      style={styles.root}
      onLayout={measure}
      collapsable={false}
    >
      <View
        style={targetHeight === null ? styles.form : { height: targetHeight }}
        onLayout={(event) => {
          if (!revealed.current)
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          setLaidOutHeight(event.nativeEvent.layout.height);
        }}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.form}
          contentContainerStyle={[
            styles.formContent,
            {
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: Spacing.md + (touchesBottom ? 0 : insets.bottom),
            },
          ]}
          automaticallyAdjustKeyboardInsets={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
        >
          {/* The root paints the scrim; this transparent target closes the
                dialog from the space around the card without covering it. */}
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            disabled={isSaving}
            accessibilityLabel={t("common.dismiss")}
            accessibilityRole="button"
          />

          <View
            style={[styles.card, !positioned && styles.pendingCard]}
            pointerEvents={positioned ? "auto" : "box-none"}
            accessibilityElementsHidden={!positioned}
            importantForAccessibility={
              positioned ? "auto" : "no-hide-descendants"
            }
            testID={`${testIDPrefix}-dialog`}
          >
            <Text style={styles.title}>{heading}</Text>

            <TextInput
              ref={inputRef}
              style={styles.input}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
              onFocus={onInputFocus}
              selectTextOnFocus
              editable={!isSaving}
              maxLength={maxLength}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel={heading}
              testID={`${testIDPrefix}-input`}
            />

            {errorMessage ? (
              <Text style={styles.error} testID={`${testIDPrefix}-error`}>
                {errorMessage}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={onClose}
                disabled={isSaving || !positioned}
                accessibilityLabel={t("common.cancel")}
                accessibilityRole="button"
                testID={`${testIDPrefix}-cancel`}
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
                disabled={!canSubmit || !positioned}
                accessibilityLabel={submitLabel}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                testID={`${testIDPrefix}-save`}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryLabel}>{submitLabel}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.scrim,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    form: { flex: 1 },
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
    pendingCard: { opacity: 0 },
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
