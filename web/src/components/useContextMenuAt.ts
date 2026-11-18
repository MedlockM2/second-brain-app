import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const MENU_WIDTH = 236;
const MENU_HEIGHT = 200;

/**
 * The right-click twin of a `…` button: a `contextmenu` on the element that
 * holds the button (the row, the tile, the card) opens the same menu, hung at
 * the cursor instead of under the button. The mobile long press, on the web.
 *
 * Off unless `enabled`, so a `…` that sits in a page header does not turn the
 * whole header into a target. A right click on the button itself, or inside the
 * open menu or one of its dialogs, is left to the browser.
 */
export function useContextMenuAt(
  anchor: RefObject<HTMLElement | null>,
  enabled: boolean,
  menuOpen: boolean,
  openMenu: () => void,
) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const open = useRef(openMenu);
  useEffect(() => {
    open.current = openMenu;
  });

  useEffect(() => {
    if (!enabled) return;
    const host = anchor.current?.parentElement;
    if (!host) return;
    const onContextMenu = (event: MouseEvent) => {
      if (anchor.current?.contains(event.target as Node)) return;
      event.preventDefault();
      setPoint({ x: event.clientX, y: event.clientY });
      open.current();
    };
    host.addEventListener("contextmenu", onContextMenu);
    return () => host.removeEventListener("contextmenu", onContextMenu);
  }, [anchor, enabled]);

  const style: CSSProperties | undefined = point && menuOpen
    ? {
        position: "fixed",
        insetInlineEnd: "auto",
        top: Math.max(8, Math.min(point.y, window.innerHeight - MENU_HEIGHT)),
        left: Math.max(8, Math.min(point.x, window.innerWidth - MENU_WIDTH)),
      }
    : undefined;
  return { style, reset: useCallback(() => setPoint(null), []) };
}
