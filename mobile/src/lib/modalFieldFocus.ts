import { Platform } from "react-native";

/**
 * Whether the field of a one-field dialog takes the keyboard as its `Modal` is
 * presented (`autoFocus`) rather than from `Modal.onShow` (`focus()`).
 *
 * The goal is the same on both platforms: the keyboard opens with the dialog, so
 * the card is laid out above it before the user can reach for it. The two
 * platforms fire `onShow` at different moments (React Native 0.83.6 native
 * code), and that is the whole reason for the split:
 *
 * - iOS fires it in the completion block of `presentViewController:animated:`,
 *   once the presentation is over. A focus asked there comes after the card is
 *   already on screen without a keyboard, and the keyboard then moves the card
 *   while the user is reaching for it. Taken as the field enters the window
 *   (`autoFocus`, handled natively in `didMoveToWindow`), first responder raises
 *   the keyboard as the presentation starts.
 * - Android fires it from the Dialog's `OnShowListener`, as the dialog is shown
 *   and before its enter animation, so a focus there already raises the keyboard
 *   with the dialog. Taken as the field is attached, it would come before the
 *   dialog window holds input focus (it is created not focusable), and the input
 *   method manager ignores a request to show the keyboard for such a view.
 */
export const FOCUS_DURING_PRESENTATION = Platform.OS === "ios";
