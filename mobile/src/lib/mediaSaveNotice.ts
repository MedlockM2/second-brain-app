/**
 * The one moment the app knows a media exists that none of its lists has seen.
 *
 * Every list of media here is read on mount and on focus, and re-read on a
 * bounded schedule for as long as a vignette it *already draws* is still being
 * processed (`useProcessingRefresh`). None of those covers a save created behind
 * a screen that has already read itself — and one path does that every time: a
 * media shared to the app on a signed-out session. The ingestion cannot start
 * before the user signs in, so the Home screen mounts and reads its list while
 * the save is still in flight, and both answers to the folder question close the
 * modal without waiting for it (task-389). The tile then appeared only on the next
 * focus change or pull-to-refresh, which reads as "nothing was saved".
 *
 * So the save says so, once, the moment it is created.
 *
 * This is not a refresh policy and carries no schedule of its own: one fact, one
 * notice, one silent re-read per mounted list. *When* a list is worth polling is a
 * different question and belongs to `useProcessingRefresh`, which takes over from
 * here — the re-read puts the vignette on screen, and its non-terminal status is
 * what arms the sweep that settles it.
 *
 * Module scope rather than a context, because the producer (`ShareIntentContext`,
 * which sits at the bottom of the provider tree) and the consumers (the hooks the
 * screens under it hold) would otherwise have to be arranged around each other.
 * Same shape as `SessionManager.subscribe`, for the same reason.
 */

type MediaSaveListener = () => void;

const listeners = new Set<MediaSaveListener>();

/**
 * Tell every mounted list that a save exists it may not know about.
 *
 * A listener that throws is contained: this is called from the success path of an
 * ingestion, and a screen re-reading itself must never turn an accepted save into
 * a failure.
 */
export function announceMediaSave(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.warn("[media] save listener threw", error);
    }
  }
}

/**
 * Listen for as long as the caller is mounted. Returns the unsubscribe, which is
 * what an effect hands back.
 */
export function subscribeToMediaSaves(listener: MediaSaveListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
