import { useSyncExternalStore } from "react";

/**
 * Imports whose file is still on its way to S3, as the media page reads them
 * (task-603, the web side of the mobile `pendingSaves`).
 *
 * A file goes through a signed PUT before the API creates its media
 * (`addFile`), so for the length of that PUT there is no id to open. The add
 * dialog offers to open the page anyway: `/media/<key>` waits here for the
 * import's outcome and takes the real id — possibly an existing media's, for a
 * file already imported — the moment the API names it.
 *
 * Module scope: the dialog that runs the upload is gone by the time the page
 * reads the outcome.
 */

export type PendingImportOutcome =
  | { state: "sending" }
  | { state: "created"; mediaItemId: string }
  | { state: "failed"; message: string };

const KEY_PREFIX = "pending-";

let sequence = 0;
const outcomes = new Map<string, PendingImportOutcome>();
const listeners = new Set<() => void>();

function publish(key: string, outcome: PendingImportOutcome): void {
  outcomes.set(key, outcome);
  for (const listener of [...listeners]) listener();
}

/** Whether a media route id is the key of an import rather than a media id. */
export function isPendingImportKey(id: string): boolean {
  return id.startsWith(KEY_PREFIX);
}

export function beginPendingImport(): string {
  sequence += 1;
  const key = `${KEY_PREFIX}${sequence}`;
  publish(key, { state: "sending" });
  return key;
}

export function resolvePendingImport(key: string, mediaItemId: string): void {
  publish(key, { state: "created", mediaItemId });
}

export function failPendingImport(key: string, message: string): void {
  publish(key, { state: "failed", message });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The outcome behind `key`, or `null` for a key this tab never issued (a reload). */
export function usePendingImportOutcome(key: string): PendingImportOutcome | null {
  const read = () => outcomes.get(key) ?? null;
  return useSyncExternalStore(subscribe, read, read);
}
