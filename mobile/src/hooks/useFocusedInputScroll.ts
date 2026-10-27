import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, type TextInput } from "react-native";
import { Spacing } from "../constants/theme";

/** Reveal a field inside the measured scroll viewport, including headers/footers. */
export function useFocusedInputScroll(scrollRef: RefObject<ScrollView | null>) {
  const focused = useRef<TextInput | null>(null);
  const offset = useRef(0);
  const lastScroll = useRef<ScrollView | null>(null);
  const revision = useRef(0);
  const frame = useRef<number | null>(null);
  const mounted = useRef(false);

  const reveal = useCallback(() => {
    const request = ++revision.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focused.current;
      const scroll = scrollRef.current;
      if (!mounted.current || !input?.isFocused() || !scroll) return;
      if (scroll !== lastScroll.current) {
        lastScroll.current = scroll;
        offset.current = 0;
      }
      scroll.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        if (!mounted.current || request !== revision.current || height <= 0) return;
        input.measureInWindow((_inputX, y, _inputWidth, inputHeight) => {
          if (!mounted.current || request !== revision.current || input !== focused.current ||
            !input.isFocused() || inputHeight <= 0) return;
          const first = top + Spacing.md;
          const last = top + height - Spacing.md;
          const delta = inputHeight > last - first ? y - first
            : y + inputHeight > last ? y + inputHeight - last
            : y < first ? y - first : 0;
          if (Math.abs(delta) > 1) {
            scroll.scrollTo({ y: Math.max(0, offset.current + delta), animated: false });
          }
        });
      });
    });
  }, [scrollRef]);

  const focusInput = useCallback((input: TextInput | null) => {
    focused.current = input;
    reveal();
  }, [reveal]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScroll.current = scrollRef.current;
    offset.current = event.nativeEvent.contentOffset.y;
  }, [scrollRef]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current += 1;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return { focusInput, reveal, onScroll };
}
