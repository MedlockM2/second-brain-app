import { ResourceCache, type ResourceKey, type ResourceSnapshot } from "@media-summarizer/core/cache/resourceCache";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { onSessionEvent } from "../session/sessionStore";

/**
 * The reading cache of the web app (task-525 after the mobile task-506, 507,
 * 510, 518): the shared `ResourceCache` of `packages/core`, one per signed-in
 * account, so a screen opened again draws what it read last time at once and
 * re-reads it behind (stale-while-revalidate) — the Home sections, the folders,
 * a media, the Digest, the unsorted queue.
 *
 * Kept simple on purpose: a key is the GET path it caches, and any write the
 * app makes through `apiRequest` marks every entry stale, so the next read of a
 * screen still on display revalidates it (`invalidateResources`). Signing out
 * or switching accounts drops the cache whole: no data crosses accounts.
 */
let owner: string | null = null;
let cache = new ResourceCache();
const swapListeners = new Set<() => void>();

onSessionEvent((event) => {
  const next = event.type === "closed" ? null : event.user.id;
  if (next === owner) return;
  cache.dispose();
  cache = new ResourceCache();
  owner = next;
  swapListeners.forEach((listener) => listener());
});

const keyOf = (path: string): ResourceKey => ["GET", path];

/** Read through the cache: concurrent reads of one path share their request. */
export function readCached<T>(path: string, load: () => Promise<T>): Promise<T> {
  return cache.fetch(keyOf(path), load);
}

/** What the cache holds for a path, possibly stale; `undefined` when nothing. */
export function cachedData<T>(path: string): T | undefined {
  return cache.snapshot<T>(keyOf(path)).data;
}

/** Store what a screen read on its own (a poll, a merged page) for its next opening. */
export function storeCached<T>(path: string, data: T): void {
  cache.set(keyOf(path), data);
}

/** A write happened: every entry is stale, and the ones on screen are re-read. */
export function invalidateResources(): void {
  cache.invalidate(() => true);
}

const EMPTY: ResourceSnapshot<never> = { data: undefined, error: null, stale: true };

/**
 * A GET resource for a screen: what the cache has now (drawn at once), then the
 * fresh answer. `path` null reads nothing. `reload` re-reads on demand.
 */
export function useCachedResource<T>(path: string | null, load: () => Promise<T>) {
  const subscribe = useCallback(
    (listener: () => void) => {
      swapListeners.add(listener);
      const unsubscribe = path ? cache.subscribe(keyOf(path), listener) : () => {};
      return () => {
        swapListeners.delete(listener);
        unsubscribe();
      };
    },
    [path],
  );
  const snapshot = useSyncExternalStore(subscribe, () => (path ? cache.snapshot<T>(keyOf(path)) : EMPTY));

  const reload = useCallback(() => {
    if (path) void readCached(path, load).catch(() => {});
    // `load` is the screen's way of reading `path`: the path is the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => reload(), [reload]);

  return { data: snapshot.data, error: snapshot.error, stale: snapshot.stale, reload };
}
