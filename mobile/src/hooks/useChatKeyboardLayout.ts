import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Keyboard, Platform, View, type KeyboardEvent, type KeyboardMetrics } from "react-native";

/** Clip to the keyboard's destination without animating the layout a second time. */
export function useChatKeyboardLayout(viewportRef: RefObject<View | null>, focusOnOpen: boolean) {
  const mounted = useRef(false);
  const revision = useRef(0);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [frame, setFrame] = useState<KeyboardMetrics | null>(() => Keyboard.metrics() ?? null);
  const [resolved, setResolved] = useState(() => !focusOnOpen || !!Keyboard.metrics());
  const [laidOutHeight, setLaidOutHeight] = useState<number | null>(null);

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
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    setFrame(next);
    setResolved(true);
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
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [accept]);

  const onInputFocus = useCallback(() => {
    const current = Keyboard.metrics();
    if (current) { accept(current); return; }
    if (resolved) return;
    if (fallback.current) clearTimeout(fallback.current);
    // Hardware keyboards need no IME inset and may emit no keyboard event.
    // Native frames drive normal placement; this only prevents an invisible field.
    fallback.current = setTimeout(() => accept(Keyboard.metrics() ?? null), 1000);
  }, [accept, resolved]);

  const overlapsBottom = viewport && frame && frame.height > 0 &&
    frame.screenX < viewport.x + viewport.width && frame.screenX + frame.width > viewport.x &&
    frame.screenY < viewport.y + viewport.height && frame.screenY + frame.height >= viewport.y + viewport.height - 1;
  // Android may have already resized the native modal. Clipping to screenY,
  // rather than subtracting height, avoids applying that resize twice.
  const height = viewport
    ? overlapsBottom ? Math.max(0, Math.min(viewport.height, frame.screenY - viewport.y)) : viewport.height
    : null;
  return {
    measure, height, onInputFocus,
    onContentLayout: (next: number) => setLaidOutHeight(next),
    ready: resolved && height !== null && laidOutHeight !== null && Math.abs(height - laidOutHeight) < 1,
    keyboardVisible: !!frame?.height,
  };
}
