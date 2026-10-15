import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Keyboard, Platform, View, type KeyboardEvent, type KeyboardMetrics } from "react-native";

/**
 * Clip to the keyboard's destination without animating the layout a second time.
 * Geometry never controls the input's visibility or focus: keyboard events can
 * precede layout, and that transient mismatch must not hide the active field.
 */
export function useChatKeyboardLayout(viewportRef: RefObject<View | null>) {
  const mounted = useRef(false);
  const revision = useRef(0);
  const [viewport, setViewport] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [frame, setFrame] = useState<KeyboardMetrics | null>(() => Keyboard.metrics() ?? null);

  const measure = useCallback(() => {
    const request = ++revision.current;
    viewportRef.current?.measureInWindow((x, y, width, height) => {
      if (!mounted.current || request !== revision.current || !height || !width) return;
      setViewport((old) => old?.x === x && old.y === y && old.width === width && old.height === height
        ? old : { x, y, width, height });
    });
  }, [viewportRef]);
  const accept = useCallback((next: KeyboardMetrics | null) => {
    if (!mounted.current) return;
    setFrame(next);
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    mounted.current = true;
    const show = (event: KeyboardEvent) => accept(event.endCoordinates);
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", () => accept(null)),
    ];
    if (Platform.OS === "ios") subscriptions.push(
      Keyboard.addListener("keyboardWillShow", show),
      Keyboard.addListener("keyboardWillChangeFrame", show),
      Keyboard.addListener("keyboardWillHide", () => accept(null)),
    );
    return () => {
      mounted.current = false;
      revision.current += 1;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [accept]);

  const overlapsBottom = viewport && frame && frame.height > 0 &&
    frame.screenX < viewport.x + viewport.width && frame.screenX + frame.width > viewport.x &&
    frame.screenY < viewport.y + viewport.height && frame.screenY + frame.height >= viewport.y + viewport.height - 1;
  // Android may have already resized the native modal. Clipping to screenY,
  // rather than subtracting height, avoids applying that resize twice.
  const height = viewport
    ? overlapsBottom ? Math.max(0, Math.min(viewport.height, frame.screenY - viewport.y)) : viewport.height
    : null;
  return {
    measure, height,
    keyboardVisible: !!frame?.height,
  };
}
