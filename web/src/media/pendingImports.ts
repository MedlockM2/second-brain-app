import { t } from "@media-summarizer/core/i18n/runtime";
import type { MediaListItem, MediaType } from "@media-summarizer/core/types/media";
import { useEffect, useSyncExternalStore } from "react";
import { apiRequest } from "../api";
import { notifyMediaSaved } from "../lib/mediaSaved";
import { onSessionEvent } from "../session/sessionStore";

/**
 * Like mobile's pendingSaves: one import outlives its dialog, can be opened
 * before it has a server id, and remembers a folder picked while it is sending.
 * Only metadata lives here; files and source text stay in the sending promise.
 */
export type PendingImportOutcome =
  | { state: "sending"; kind: "file" | "other" }
  | { state: "created"; mediaItemId: string }
  | { state: "failed"; message: string };

interface ImportMetadata {
  kind: "file" | "other";
  mediaType: MediaType;
  labelKey: string;
  folderId: string | null;
}

interface PendingImport extends ImportMetadata {
  key: string;
  startedAt: string;
  mediaItemId: string | null;
  knownIds: ReadonlySet<string>;
}

interface ImportOperation {
  entry: PendingImport;
  outcome: PendingImportOutcome;
  appliedFolderId: string | null;
  syncing: boolean;
}

interface ImportNotice {
  id: string;
  importKey: string;
  message: string;
}

const KEY_PREFIX = "pending-";
const SETTLED_LIFETIME_MS = 2 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const operations = new Map<string, ImportOperation>();
const knownIds = new Set<string>();
const listeners = new Set<() => void>();
let entries: readonly PendingImport[] = [];
let notices: readonly ImportNotice[] = [];
let owner: string | null = null;

function publish(): void {
  for (const listener of [...listeners]) listener();
}

function current(operation: ImportOperation): boolean {
  return operations.get(operation.entry.key) === operation;
}

function updateEntry(operation: ImportOperation, changes: Partial<PendingImport>): void {
  operation.entry = { ...operation.entry, ...changes };
  entries = entries.map(entry => entry.key === operation.entry.key ? operation.entry : entry);
  publish();
}

function reportFailure(operation: ImportOperation, kind: "save" | "folder", message: string): void {
  const id = `${operation.entry.key}:${kind}`;
  notices = [...notices.filter(notice => notice.id !== id), {
    id, importKey: operation.entry.key, message,
  }];
  publish();
}

function expirePlaceholder(operation: ImportOperation): void {
  setTimeout(() => {
    if (!current(operation) || operation.syncing) return;
    entries = entries.filter(item => item.key !== operation.entry.key);
    publish();
  }, SETTLED_LIFETIME_MS);
}

onSessionEvent(event => {
  const next = event.type === "closed" ? null : event.user.id;
  if (next === owner) return;
  owner = next;
  operations.clear();
  knownIds.clear();
  entries = [];
  notices = [];
  publish();
});

/** Serialize folder changes, always against the real id and the latest choice. */
async function syncFolder(operation: ImportOperation): Promise<void> {
  if (operation.syncing || operation.outcome.state !== "created") return;
  const mediaItemId = operation.outcome.mediaItemId;
  operation.syncing = true;
  try {
    while (current(operation) && operation.entry.folderId !== operation.appliedFolderId) {
      const folderId = operation.entry.folderId;
      try {
        await apiRequest(`/api/media/${encodeURIComponent(mediaItemId)}`, {
          method: "PATCH", body: { folder_id: folderId },
        });
      } catch {
        if (!current(operation)) return;
        // An obsolete destination failing must not discard a newer choice
        // made while that PATCH was in flight.
        if (operation.entry.folderId !== folderId) continue;
        // The save still exists. A failed move must not leave its placeholder
        // in a folder the server never accepted, or be announced as a lost save.
        updateEntry(operation, { folderId: operation.appliedFolderId });
        reportFailure(operation, "folder", t("share.folderFailed"));
        break;
      }
      if (!current(operation)) return;
      operation.appliedFolderId = folderId;
    }
  } finally {
    operation.syncing = false;
    if (current(operation)) {
      // A list may already contain the media while its move is still in flight.
      entries = [...entries];
      publish();
      notifyMediaSaved();
    }
  }
}

/** Start exactly one submission; closing or replacing the dialog cannot replay it. */
export function startPendingImport(metadata: ImportMetadata, send: () => Promise<string>): string {
  const key = `${KEY_PREFIX}${crypto.randomUUID()}`;
  const entry: PendingImport = {
    ...metadata, key, startedAt: new Date().toISOString(), mediaItemId: null,
    knownIds: new Set(knownIds),
  };
  const operation: ImportOperation = {
    entry, outcome: { state: "sending", kind: metadata.kind },
    appliedFolderId: metadata.folderId, syncing: false,
  };
  operations.set(key, operation);
  entries = [entry, ...entries];
  publish();

  void (async () => {
    try {
      const mediaItemId = await send();
      if (!current(operation)) return;
      if (!mediaItemId || isPendingImportKey(mediaItemId)) throw new Error(t("share.saveContentFailed"));
      operation.outcome = { state: "created", mediaItemId };
      updateEntry(operation, { mediaItemId });
      await syncFolder(operation);
      // Bound a successful placeholder when its save is outside a list's loaded
      // range. The outcome remains available to an already-open page.
      expirePlaceholder(operation);
    } catch (error) {
      if (!current(operation)) return;
      const message = error instanceof Error ? error.message : t("share.saveContentFailed");
      operation.outcome = { state: "failed", message };
      entries = entries.filter(item => item.key !== key);
      reportFailure(operation, "save", message);
    }
  })();
  return key;
}

/** Remember the destination now; its PATCH waits for the submission's real id. */
export function filePendingImport(key: string, folderId: string): void {
  const operation = operations.get(key);
  if (!operation || operation.outcome.state === "failed") throw new Error(t("share.saveContentFailed"));
  // A fast save may already have handed its tile over before the folder was
  // chosen. Keep its destination visible while that later move is applied.
  if (!entries.some(entry => entry.key === key)) entries = [operation.entry, ...entries];
  updateEntry(operation, { folderId });
  void syncFolder(operation);
  if (operation.outcome.state === "created") expirePlaceholder(operation);
}

export function isPendingImportKey(id: string): boolean {
  return id.startsWith(KEY_PREFIX);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The outcome behind key, or null after a reload or a change of account. */
export function usePendingImportOutcome(key: string): PendingImportOutcome | null {
  const read = () => operations.get(key)?.outcome ?? null;
  return useSyncExternalStore(subscribe, read, read);
}

export function useImportNotices(): readonly ImportNotice[] {
  return useSyncExternalStore(subscribe, () => notices);
}

export function dismissImportNotice(id: string): void {
  notices = notices.filter(notice => notice.id !== id);
  publish();
}

/** Merge the server's page with provisional saves, using the same handoff as mobile. */
export function useMediaWithPendingImports(
  listed: MediaListItem[] | null,
  folder?: { id: string; isDefault: boolean },
): MediaListItem[] {
  const pending = useSyncExternalStore(subscribe, () => entries);
  useEffect(() => {
    if (!listed) return;
    listed.forEach(item => knownIds.add(item.media_item_id));
    const resolved = new Map(listed.map(item => [item.media_item_id, item]));
    const next = entries.filter(entry => {
      const item = entry.mediaItemId ? resolved.get(entry.mediaItemId) : null;
      const operation = operations.get(entry.key);
      return !item || operation?.syncing || (entry.folderId !== null && item.folder_id !== entry.folderId);
    });
    if (next.length !== entries.length) {
      entries = next;
      publish();
    }
  }, [listed, pending]);

  const items = listed ?? [];
  const waiting = pending.filter(entry => !folder || entry.folderId === folder.id || (entry.folderId === null && folder.isDefault));
  const resolvedIds = new Set(waiting.flatMap(entry => entry.mediaItemId ? [entry.mediaItemId] : []));
  const listedById = new Map(items.map(item => [item.media_item_id, item]));
  const visible = waiting.filter(entry => {
    const item = entry.mediaItemId ? listedById.get(entry.mediaItemId) : null;
    // Home can already hold the real row in its old folder while a move is in
    // flight. That row and its provisional tile must never appear together.
    return !item;
  });

  // A refresh can see the server row before the POST answers. Reserve at most
  // one new row per unanswered import so it never appears beside its stand-in.
  const heldBack = new Set<string>();
  const newestFirst = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const entry of [...visible].reverse()) {
    if (entry.mediaItemId) continue;
    const candidate = newestFirst.find(item => !entry.knownIds.has(item.media_item_id)
      && !resolvedIds.has(item.media_item_id) && !heldBack.has(item.media_item_id)
      && Date.parse(item.created_at) >= Date.parse(entry.startedAt) - CLOCK_SKEW_MS);
    if (candidate) heldBack.add(candidate.media_item_id);
  }
  const provisional: MediaListItem[] = visible.map(entry => ({
    media_item_id: entry.key, title_label_key: entry.labelKey, media_type: entry.mediaType,
    folder_id: entry.folderId, status: "pending", created_at: entry.startedAt, updated_at: entry.startedAt,
  }));
  return [...provisional, ...items.filter(item => !heldBack.has(item.media_item_id))];
}
