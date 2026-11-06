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
 * removes it; the error is said where it always was, unless the media page is
 * showing that very import (below).
 *
 * The vignette opens the media page before the media exists (task-603): the page
 * route carries the entry's key, reads the import's outcome here, and takes the
 * real id as soon as the ingestion names it. The outcome outlives the entry — a
 * page opened on a key keeps finding its answer after the list took over.
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

/** What became of a submission, as the media page opened on its key reads it. */
export type PendingSaveOutcome =
  | { state: "sending"; mediaType: MediaType }
  | { state: "created"; mediaItemId: string }
  | { state: "failed"; message: string };

const KEY_PREFIX = "pending-";

let entries: readonly PendingSave[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const outcomes = new Map<string, PendingSaveOutcome>();
/** Keys a media page is open on: their failure is said there, not in an alert. */
const watched = new Map<string, number>();

/** Whether a media route id is the key of a submission rather than a media id. */
export function isPendingSaveKey(id: string): boolean {
  return id.startsWith(KEY_PREFIX);
}

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
  const key = `${KEY_PREFIX}${sequence}`;
  outcomes.set(key, { state: "sending", mediaType: save.mediaType });
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
    // No save to open: the page says the generic failure (empty message).
    outcomes.set(key, { state: "failed", message: "" });
    dropPendingSave(key);
    return;
  }
  outcomes.set(key, { state: "created", mediaItemId });
  publish(
    entries.map((entry) =>
      entry.key === key ? { ...entry, mediaItemId } : entry,
    ),
  );
  setTimeout(() => dropPendingSave(key), SETTLED_LIFETIME_MS);
}

/**
 * The submission failed. Returns whether a media page is open on it, in which
 * case that page says the error and the caller must not say it again.
 */
export function failPendingSave(key: string, message: string): boolean {
  outcomes.set(key, { state: "failed", message });
  if (entries.some((entry) => entry.key === key)) {
    publish(entries.filter((entry) => entry.key !== key));
  } else {
    for (const listener of [...listeners]) listener();
  }
  return (watched.get(key) ?? 0) > 0;
}

/** The list now draws the save itself, or the submission never named one. */
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

/** Mark a key as shown by a media page; the returned function lets it go. */
export function watchPendingSave(key: string): () => void {
  watched.set(key, (watched.get(key) ?? 0) + 1);
  return () => {
    const count = (watched.get(key) ?? 1) - 1;
    if (count > 0) watched.set(key, count);
    else watched.delete(key);
  };
}

/**
 * The outcome of the submission behind `key`, or `null` for a key this run of
 * the app never issued (a page restored after a relaunch).
 */
export function usePendingSaveOutcome(key: string): PendingSaveOutcome | null {
  const read = () => outcomes.get(key) ?? null;
  return useSyncExternalStore(subscribe, read, read);
}
