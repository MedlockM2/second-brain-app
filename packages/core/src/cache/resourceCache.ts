/** Account-neutral memory cache. Apps own identity, transport and React bindings. */
export type ResourceKey = readonly (string | number | null)[];
export interface ResourceSnapshot<T> {
  data: T | undefined;
  error: unknown;
  stale: boolean;
}
interface Entry {
  key: ResourceKey;
  snapshot: ResourceSnapshot<unknown>;
  listeners: Set<() => void>;
  revision: number;
  bytes: number;
  used: number;
  pending?: Promise<unknown>;
  loader?: () => Promise<unknown>;
}
const EMPTY: ResourceSnapshot<never> = {
  data: undefined,
  error: null,
  stale: true,
};
export class ResourceSupersededError extends Error {
  constructor() {
    super("Resource request superseded");
  }
}
export const resourceId = (key: ResourceKey): string => JSON.stringify(key);
export const isResourceGone = (error: unknown): boolean =>
  [403, 404].includes((error as { status?: number } | null)?.status ?? 0);
export const isResourceSuperseded = (error: unknown): boolean =>
  error instanceof ResourceSupersededError;

export class ResourceCache {
  private entries = new Map<string, Entry>();
  private disposed = false;
  constructor(
    private readonly limits = {
      entries: 100,
      bytes: 8 * 1024 * 1024,
      bodyBytes: 2 * 1024 * 1024,
    },
  ) {}

  private entry(key: ResourceKey): Entry {
    const id = resourceId(key);
    let entry = this.entries.get(id);
    if (!entry) {
      entry = {
        key,
        snapshot: EMPTY,
        listeners: new Set(),
        revision: 0,
        bytes: 0,
        used: Date.now(),
      };
      this.entries.set(id, entry);
    }
    return entry;
  }
  snapshot<T>(key: ResourceKey): ResourceSnapshot<T> {
    if (this.disposed) return EMPTY;
    const entry = this.entries.get(resourceId(key));
    if (entry) entry.used = Date.now();
    return (entry?.snapshot ?? EMPTY) as ResourceSnapshot<T>;
  }
  subscribe(key: ResourceKey, listener: () => void): () => void {
    if (this.disposed) return () => {};
    const entry = this.entry(key);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      this.prune();
    };
  }
  private publish(entry: Entry, snapshot: ResourceSnapshot<unknown>): void {
    entry.snapshot = snapshot;
    entry.bytes =
      snapshot.data === undefined
        ? 0
        : JSON.stringify(snapshot.data).length * 2;
    entry.used = Date.now();
    entry.listeners.forEach((listener) => listener());
    this.prune();
  }
  private prune(): void {
    const inactive = [...this.entries.entries()]
      .filter(([, entry]) => entry.listeners.size === 0 && !entry.pending)
      .sort(([, a], [, b]) => b.used - a.used);
    let count = 0;
    let bytes = 0;
    for (const [id, entry] of inactive) {
      if (
        !entry.bytes ||
        entry.bytes > this.limits.bodyBytes ||
        count + 1 > this.limits.entries ||
        bytes + entry.bytes > this.limits.bytes
      ) {
        this.entries.delete(id);
      } else {
        count += 1;
        bytes += entry.bytes;
      }
    }
  }
  async fetch<T>(
    key: ResourceKey,
    loader: () => Promise<T>,
    revalidate?: () => Promise<T>,
  ): Promise<T> {
    if (this.disposed) throw new ResourceSupersededError();
    const entry = this.entry(key);
    entry.loader = revalidate ?? loader;
    if (entry.pending) return entry.pending as Promise<T>;
    const revision = entry.revision;
    // Defer transport so the pending promise exists even for synchronous failures.
    const pending = Promise.resolve()
      .then(loader)
      .then((data) => {
        if (
          this.disposed ||
          revision !== entry.revision ||
          this.entries.get(resourceId(key)) !== entry
        ) {
          throw new ResourceSupersededError();
        }
        this.publish(entry, { data, error: null, stale: false });
        return data;
      })
      .catch((error: unknown) => {
        if (this.disposed || revision !== entry.revision)
          throw new ResourceSupersededError();
        if (!isResourceSuperseded(error)) {
          this.publish(entry, {
            data: isResourceGone(error) ? undefined : entry.snapshot.data,
            error,
            stale: true,
          });
        }
        throw error;
      })
      .finally(() => {
        if (entry.pending === pending) entry.pending = undefined;
        this.prune();
      });
    entry.pending = pending;
    return pending;
  }
  set<T>(key: ResourceKey, data: T): void {
    if (this.disposed) return;
    const entry = this.entry(key);
    if (
      Object.is(entry.snapshot.data, data) ||
      JSON.stringify(entry.snapshot.data) === JSON.stringify(data)
    )
      return;
    entry.revision += 1;
    entry.pending = undefined;
    this.publish(entry, { data, error: null, stale: true });
  }
  update(
    predicate: (key: ResourceKey) => boolean,
    transform: (data: unknown, key: ResourceKey) => unknown,
  ): void {
    for (const entry of [...this.entries.values()]) {
      if (!predicate(entry.key) || entry.snapshot.data === undefined) continue;
      const data = transform(entry.snapshot.data, entry.key);
      this.set(entry.key, data);
    }
  }
  invalidate(predicate: (key: ResourceKey) => boolean): void {
    for (const entry of [...this.entries.values()]) {
      if (!predicate(entry.key)) continue;
      entry.revision += 1;
      entry.pending = undefined;
      this.publish(entry, { ...entry.snapshot, stale: true });
      if (entry.listeners.size && entry.loader) {
        const loader = entry.loader;
        const revision = entry.revision;
        queueMicrotask(() => {
          if (
            !this.disposed &&
            entry.listeners.size &&
            entry.revision === revision &&
            entry.loader === loader
          )
            void this.fetch(entry.key, loader).catch(() => {});
        });
      }
    }
  }
  remove(predicate: (key: ResourceKey) => boolean): void {
    for (const entry of [...this.entries.values()]) {
      if (!predicate(entry.key)) continue;
      entry.revision += 1;
      entry.pending = undefined;
      entry.loader = undefined;
      this.publish(entry, EMPTY);
    }
  }
  revalidateActive(): void {
    for (const entry of this.entries.values()) {
      if (entry.listeners.size && entry.loader)
        void this.fetch(entry.key, entry.loader).catch(() => {});
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      entry.revision += 1;
      entry.snapshot = EMPTY;
      entry.listeners.forEach((listener) => listener());
    }
    this.entries.clear();
  }
}
