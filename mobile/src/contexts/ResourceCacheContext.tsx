import { AppState } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ResourceCache,
  resourceId,
  type ResourceKey,
  type ResourceSnapshot,
} from "@media-summarizer/core/cache/resourceCache";
import type {
  ListMediaResponse,
  MediaListItem,
} from "@media-summarizer/core/types/media";
import { useAuth } from "./AuthContext";
import { useUserPreferences } from "./UserPreferencesContext";
import { resourceKeys, resourceSession } from "../services/resourceCache";

const Context = createContext<ResourceCache | null>(null);
export function ResourceCacheProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const cache = useMemo(() => {
    const owner = resourceSession();
    return owner.userId === (user?.id ?? null)
      ? owner.cache
      : new ResourceCache();
  }, [user?.id]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") cache.revalidateActive();
    });
    return () => subscription.remove();
  }, [cache]);
  return (
    <Context.Provider key={user?.id ?? "signed-out"} value={cache}>
      {children}
    </Context.Provider>
  );
}
export function useResourceCache(): ResourceCache {
  const cache = useContext(Context);
  if (!cache) throw new Error("ResourceCacheProvider missing");
  return cache;
}
export function useResourceSnapshot<T>(key: ResourceKey) {
  const cache = useResourceCache();
  // Language-sensitive callers build a new key on this subscription's render.
  useUserPreferences();
  const id = resourceId(key);
  const stableKey = useMemo(() => JSON.parse(id) as ResourceKey, [id]);
  const subscribe = useCallback(
    (listener: () => void) => cache.subscribe(stableKey, listener),
    [cache, stableKey],
  );
  const snapshot = useCallback(
    () => cache.snapshot<T>(stableKey),
    [cache, stableKey],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function useResourceState<T>(
  key: ResourceKey,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const cache = useResourceCache();
  const snapshot = useResourceSnapshot<T>(key);
  const [fallback] = useState(() => initial);
  const id = resourceId(key);
  const stableKey = useMemo(() => JSON.parse(id) as ResourceKey, [id]);
  const set = useCallback(
    (next: React.SetStateAction<T>) => {
      const previous = cache.snapshot<T>(stableKey).data ?? fallback;
      cache.set(
        stableKey,
        typeof next === "function" ? (next as (value: T) => T)(previous) : next,
      );
    },
    [cache, stableKey, fallback],
  );
  return [snapshot.data ?? fallback, set];
}
export function useFolderMediaState(
  folderId: string,
): [MediaListItem[], React.Dispatch<React.SetStateAction<MediaListItem[]>>] {
  const cache = useResourceCache();
  const key = useMemo(
    () => resourceKeys.mediaPage({ folderId, limit: 100 }),
    [folderId],
  );
  const snapshot = useResourceSnapshot<ListMediaResponse>(key);
  const [empty] = useState<MediaListItem[]>([]);
  const set = useCallback(
    (next: React.SetStateAction<MediaListItem[]>) => {
      const previous = cache.snapshot<ListMediaResponse>(key).data;
      if (!previous) return;
      const items = typeof next === "function" ? next(previous.items) : next;
      if (items !== previous.items) cache.set(key, { ...previous, items });
    },
    [cache, key],
  );
  return [snapshot.data?.items ?? empty, set];
}

/** Snapshot identity must remain stable until one selected resource changes. */
class ResourceSelection<T> {
  private previous: ResourceSnapshot<T>[] = [];
  constructor(
    private cache: ResourceCache,
    private keys: ResourceKey[],
  ) {}
  subscribe = (listener: () => void) => {
    const releases = this.keys.map((key) =>
      this.cache.subscribe(key, listener),
    );
    return () => releases.forEach((release) => release());
  };
  snapshot = () => {
    const next = this.keys.map((key) => this.cache.snapshot<T>(key));
    if (
      next.length !== this.previous.length ||
      next.some((item, index) => item !== this.previous[index])
    )
      this.previous = next;
    return this.previous;
  };
}
export function useResourceSnapshots<T>(
  keys: ResourceKey[],
): ResourceSnapshot<T>[] {
  const cache = useResourceCache();
  useUserPreferences();
  const id = JSON.stringify(keys);
  const selection = useMemo(
    () => new ResourceSelection<T>(cache, JSON.parse(id) as ResourceKey[]),
    [cache, id],
  );
  return useSyncExternalStore(
    selection.subscribe,
    selection.snapshot,
    selection.snapshot,
  );
}
