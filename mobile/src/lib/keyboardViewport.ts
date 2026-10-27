import { Platform, type KeyboardMetrics } from "react-native";

export interface KeyboardViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Height above the keyboard, bounded by the window's actual available space. */
export function getKeyboardViewportHeight(
  viewport: KeyboardViewportRect,
  keyboard: KeyboardMetrics | null | undefined,
): number {
  const bottom = viewport.y + viewport.height;
  if (
    !keyboard || keyboard.height <= 0 || keyboard.width <= 0 ||
    keyboard.screenX >= viewport.x + viewport.width ||
    keyboard.screenX + keyboard.width <= viewport.x ||
    keyboard.screenY >= bottom ||
    keyboard.screenY + keyboard.height <= viewport.y
  ) return viewport.height;

  // Preserve iOS floating-keyboard behaviour. Android's reported height excludes
  // the navigation bar, so its rectangle need not reach an edge-to-edge window's
  // bottom even when the keyboard is docked (notably with three-button navigation).
  if (Platform.OS === "ios" && keyboard.screenY + keyboard.height < bottom - 1) {
    return viewport.height;
  }

  // adjustResize may already have shortened the viewport. Never subtract the
  // keyboard height from it a second time.
  return Math.max(0, Math.min(viewport.height, keyboard.screenY - viewport.y));
}
