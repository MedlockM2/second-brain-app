import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type KeyboardMetrics,
  type View,
} from "react-native";
import { getKeyboardViewportHeight, type KeyboardViewportRect } from "../lib/keyboardViewport";

/** Follow native keyboard destinations without controlling input focus/visibility. */
export function useKeyboardViewport(viewportRef: RefObject<View | null>, active = true) {
  const mounted = useRef(false);
  const revision = useRef(0);
  const needsRefresh = useRef(true);
  const [viewport, setViewport] = useState<KeyboardViewportRect | null>(null);
  const [keyboard, setKeyboard] = useState<KeyboardMetrics | null>(() => Keyboard.metrics() ?? null);

  const measure = useCallback(() => {
    if (!mounted.current) return;
    if (needsRefresh.current) {
      needsRefresh.current = false;
      setKeyboard(Keyboard.metrics() ?? null);
    }
    const node = viewportRef.current;
    const request = ++revision.current;
    node?.measureInWindow((x, y, width, height) => {
      if (!mounted.current || request !== revision.current || node !== viewportRef.current || !width || !height) return;
      setViewport((old) => old?.x === x && old.y === y && old.width === width && old.height === height
        ? old : { x, y, width, height });
    });
  }, [viewportRef]);

  // Call at Modal.onShow, before requesting focus. In particular, reopening a
  // mounted dialog must not reuse the previous opening's keyboard metrics.
  const refresh = useCallback(() => {
    needsRefresh.current = true;
    measure();
  }, [measure]);
  const accept = useCallback((next: KeyboardMetrics | null) => {
    if (!mounted.current) return;
    needsRefresh.current = false;
    setKeyboard(next);
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    if (!active) return;
    mounted.current = true;
    needsRefresh.current = true;
    const show = (event: KeyboardEvent) => accept(event.endCoordinates);
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", () => accept(null)),
      Dimensions.addEventListener("change", measure),
    ];
    if (Platform.OS === "ios") subscriptions.push(
      Keyboard.addListener("keyboardWillShow", show),
      Keyboard.addListener("keyboardWillChangeFrame", show),
      Keyboard.addListener("keyboardWillHide", () => accept(null)),
    );
    const initialLayout = requestAnimationFrame(measure);
    return () => {
      mounted.current = false;
      revision.current += 1;
      cancelAnimationFrame(initialLayout);
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [active, accept, measure]);

  return {
    measure,
    refresh,
    height: active && viewport ? getKeyboardViewportHeight(viewport, keyboard) : null,
    keyboardVisible: active && !!keyboard?.height,
  };
}
