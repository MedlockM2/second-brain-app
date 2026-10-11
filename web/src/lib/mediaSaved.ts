import { useEffect } from "react";

/**
 * "A source was just saved or filed": the screens that list sources re-read
 * themselves when the add flow finishes behind them (the mobile
 * `mediaSaveNotice`). A window event, so no screen has to know the others.
 */
const EVENT = "deepn:media-saved";

export function notifyMediaSaved(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function useOnMediaSaved(reload: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENT, reload);
    return () => window.removeEventListener(EVENT, reload);
  }, [reload]);
}
