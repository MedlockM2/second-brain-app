import { useEffect } from "react";

/**
 * Re-read a list while something on it is still being processed, and stop as
 * soon as nothing is — the web counterpart of the mobile hook of the same name
 * (task-405): a tile marked "processing" must not keep its marker until the
 * page is reloaded.
 *
 * A budget caps the re-reads, so a job stuck server-side does not poll forever.
 */
const INTERVAL_MS = 5_000;
const MAX_ROUNDS = 36;

export function useProcessingRefresh(active: boolean, reload: () => void): void {
  useEffect(() => {
    if (!active) return;
    let rounds = 0;
    const timer = window.setInterval(() => {
      rounds += 1;
      if (rounds > MAX_ROUNDS) {
        window.clearInterval(timer);
        return;
      }
      reload();
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, reload]);
}
