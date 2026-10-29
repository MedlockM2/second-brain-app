import { useSyncExternalStore } from "react";
import { resourceKeys, resourceSession } from "../services/resourceCache";
import type { ListMediaResponse, MediaType } from "@media-summarizer/core/types/media";

/**
 * The imports that have left the app and that no list can show yet (task-568).
 *
 * A save only exists on the server once its ingestion call has answered, and for
 * a file that call waits on the direct PUT to S3 (task-345): a heavy photo on a
 * mobile network leaves the Home screen unchanged for twenty seconds, with the
 * modal already closed (task-389). An owner who saw nothing re-imported, and got
 * two saves. So the import is drawn the moment it leaves, as the vignette it will
 * become, and handed over to the real one once the list holds it.
 *
 * One entry per submission, in one of two states: still waiting for its
 * `media_item_id`, or holding it and waiting for the list to catch up. A failure
 * removes it; the error is said where it always was.
 *
 * Module scope, like `mediaSaveNotice`, for the same reason: the producer is
 * `ShareIntentContext`, at the bottom of the provider tree, and the consumer is
 * the Home screen under it.
 */

export interface PendingSave {
  /** Identity of the submission, stable for as long as the entry lives. */
  key: string;
  /** ISO 8601, when the submission left: the date its generic title carries. */
  startedAt: string;
  mediaType: MediaType;
  /** A `title_label_key`, so the vignette reads like the save it stands for. */
  labelKey: string;
  /**
   * The media the list already held when this left. Whatever the list shows
   * beyond them may be this very save, read before its own answer was processed.
   */
  knownIds: ReadonlySet<string>;
  /** Set once the ingestion answered. */
  mediaItemId: string | null;
}

/**
 * How long an answered entry may wait for the list to show it. The save is
 * announced the moment it is answered, so this only bounds the cases where the
 * list never will — a refused re-read, a deduplicated save sitting past the
 * first page.
 */
const SETTLED_LIFETIME_MS = 2 * 60 * 1000;

let entries: readonly PendingSave[] = [];
let sequence = 0;
const listeners = new Set<() => void>();

function publish(next: readonly PendingSave[]): void {
  entries = next;
  for (const listener of [...listeners]) listener();
}

/** Record a submission leaving, and return the key that settles it. */
export function beginPendingSave(save: {
  mediaType: MediaType;
  labelKey: string;
}): string {
  sequence += 1;
  const key = `pending:${sequence}`;
  const listed =
    resourceSession().cache.snapshot<ListMediaResponse>(resourceKeys.mediaPage())
      .data?.items ?? [];
  publish([
    ...entries,
    {
      key,
      startedAt: new Date().toISOString(),
      mediaType: save.mediaType,
      labelKey: save.labelKey,
      knownIds: new Set(listed.map((item) => item.media_item_id)),
      mediaItemId: null,
    },
  ]);
  return key;
}

/** The submission answered: the entry now names the save it stands for. */
export function resolvePendingSave(key: string, mediaItemId: string): void {
  if (!mediaItemId) {
    dropPendingSave(key);
    return;
  }
  publish(
    entries.map((entry) =>
      entry.key === key ? { ...entry, mediaItemId } : entry,
    ),
  );
  setTimeout(() => dropPendingSave(key), SETTLED_LIFETIME_MS);
}

/** The submission failed, or the list now draws the save itself. */
export function dropPendingSave(key: string): void {
  if (!entries.some((entry) => entry.key === key)) return;
  publish(entries.filter((entry) => entry.key !== key));
}

/** Drop every answered entry whose save the list now holds. */
export function settlePendingSaves(listedIds: ReadonlySet<string>): void {
  if (!entries.some((entry) => entry.mediaItemId && listedIds.has(entry.mediaItemId))) {
    return;
  }
  publish(
    entries.filter(
      (entry) => !(entry.mediaItemId && listedIds.has(entry.mediaItemId)),
    ),
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): readonly PendingSave[] {
  return entries;
}

export function usePendingSaves(): readonly PendingSave[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
