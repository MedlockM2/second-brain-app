import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Keyboard, type FlatList, type View } from "react-native";
import { useIsFocused } from "expo-router";
import { TAB_BAR_CLEARANCE } from "../constants/tabBar";
import { Spacing } from "../constants/theme";

type Measured = Pick<View, "measureInWindow">;

/** One measured coordinate system for editing and revealing a sorted folder. */
export function useLibraryTarget<T>(
  viewport: React.RefObject<View | null>,
  list: React.RefObject<FlatList<T> | null>,
  offset: React.RefObject<number>,
  editingId: string | null,
  revealId: string | null,
  onRevealed: () => void,
  topClearance: number,
) {
  const focused = useIsFocused();
  const slots = useRef(new Map<string, Measured>());
  const field = useRef<{ id: string; node: Measured } | null>(null);
  const geometry = useRef(Keyboard.metrics());
  const frame = useRef<number | null>(null);
  const revision = useRef(0);
  const [bottomSpace, setBottomSpace] = useState(0);
  const committedSpace = useRef(0);
  const state = useRef({ editingId, revealId, focused, onRevealed });

  const request = useCallback(() => {
    const version = ++revision.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const current = state.current;
      const id = current.editingId ?? current.revealId;
      if (!id || !current.focused) return;
      if (!current.editingId && Keyboard.isVisible()) return;
      const node = current.editingId && field.current?.id === id
        ? field.current.node : slots.current.get(id);
      if (!node) return;
      viewport.current?.measureInWindow((_x, top, _w, height) => {
        if (version !== revision.current) return;
        const keyboard = geometry.current;
        const overlap = keyboard ? Math.max(0, top + height - keyboard.screenY) : 0;
        // Reserve scroll range first; onContentSizeChange remeasures after commit.
        if (committedSpace.current !== overlap) {
          setBottomSpace(overlap);
          return;
        }
        const bottom = Math.min(top + height - (overlap ? 0 : TAB_BAR_CLEARANCE),
          keyboard?.screenY ?? Infinity) - Spacing.md;
        node.measureInWindow((_nx, y, _nw, h) => {
          if (version !== revision.current || height <= 0 || h <= 0) return;
          const delta = h > bottom - top - topClearance ? y - top - topClearance
            : y + h > bottom ? y + h - bottom
            : y < top + topClearance ? y - top - topClearance : 0;
          if (Math.abs(delta) > 1) {
            list.current?.scrollToOffset({ offset: Math.max(0, offset.current + delta), animated: false });
          } else if (!current.editingId && current.revealId) current.onRevealed();
        });
      });
    });
  }, [viewport, list, offset, topClearance]);
  useLayoutEffect(() => {
    state.current = { editingId, revealId, focused, onRevealed };
    committedSpace.current = bottomSpace;
    request();
  }, [editingId, revealId, focused, onRevealed, bottomSpace, request]);
  useEffect(() => {
    const subscriptions = ["keyboardWillChangeFrame", "keyboardDidChangeFrame", "keyboardDidShow", "keyboardDidHide"].map((event) =>
      Keyboard.addListener(event as Parameters<typeof Keyboard.addListener>[0], (value) => {
        geometry.current = event === "keyboardDidHide" ? undefined : value.endCoordinates;
        request();
      }));
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      revision.current += 1;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [request]);
  const register = useCallback((id: string, node: View | null) => {
    if (node) slots.current.set(id, node); else slots.current.delete(id);
    if (state.current.revealId === id || state.current.editingId === id) request();
  }, [request]);
  const revealField = useCallback((id: string, node: View) => {
    field.current = { id, node };
    request();
  }, [request]);
  return { bottomSpace, register, revealField, request };
}
