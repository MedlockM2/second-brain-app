import type { ListMediaResponse, MediaListItem } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";

interface MediaPage {
  items: MediaListItem[];
  total: number;
  cursor: string | null;
}

const uniqueItems = (items: MediaListItem[]) =>
  [...new Map(items.map((item) => [item.media_item_id, item])).values()];

/** Cursor pagination with atomic refreshes. Key the owning view by folderId. */
export function usePagedMedia(pageSize: number, folderId?: string) {
  const [page, setPage] = useState<MediaPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const current = useRef<MediaPage | null>(null);
  const epoch = useRef(0);
  const busy = useRef(false);
  const loadedPages = useRef(1);

  const commit = useCallback((next: MediaPage) => {
    current.current = next;
    setPage(next);
  }, []);

  const readPage = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams({ limit: String(pageSize) });
    if (folderId) params.set("folder_id", folderId);
    if (cursor) params.set("cursor", cursor);
    return apiRequest<ListMediaResponse>(`/api/media?${params}`);
  }, [pageSize, folderId]);

  // A refresh re-reads the loaded range, then publishes one consistent snapshot.
  // A failed refresh keeps every previously visible row and its next cursor.
  const reload = useCallback(async () => {
    const version = ++epoch.current;
    busy.current = true;
    try {
      const items: MediaListItem[] = [];
      let cursor: string | null = null;
      let total = 0;
      let pages = 0;
      const target = loadedPages.current;
      do {
        const response = await readPage(cursor);
        if (version !== epoch.current) return;
        items.push(...response.items);
        total = response.total;
        cursor = response.has_more ? (response.next_cursor ?? null) : null;
        pages += 1;
      } while (cursor && pages < target);
      loadedPages.current = pages;
      commit({ items: uniqueItems(items), total, cursor });
      setFailed(false);
    } catch {
      if (version === epoch.current) setFailed(true);
    } finally {
      if (version === epoch.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [readPage, commit]);

  const loadMore = useCallback(async () => {
    const previous = current.current;
    if (!previous?.cursor || busy.current) return;
    const version = epoch.current;
    busy.current = true;
    setLoadingMore(true);
    try {
      const response = await readPage(previous.cursor);
      if (version !== epoch.current) return;
      loadedPages.current += 1;
      commit({
        items: uniqueItems([...previous.items, ...response.items]),
        total: response.total,
        cursor: response.has_more ? (response.next_cursor ?? null) : null,
      });
      setFailed(false);
    } catch {
      if (version === epoch.current) setFailed(true);
    } finally {
      if (version === epoch.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [readPage, commit]);

  const refresh = useCallback(() => {
    if (!busy.current) void reload();
  }, [reload]);

  const patch = useCallback((id: string, changes: Partial<MediaListItem> | null) => {
    // A read started before the confirmed mutation cannot undo it later.
    epoch.current += 1;
    busy.current = false;
    setLoadingMore(false);
    const previous = current.current;
    if (!previous) return;
    const exists = previous.items.some((item) => item.media_item_id === id);
    commit({
      ...previous,
      items: changes
        ? previous.items.map((item) => item.media_item_id === id ? { ...item, ...changes } : item)
        : previous.items.filter((item) => item.media_item_id !== id),
      total: changes || !exists ? previous.total : Math.max(0, previous.total - 1),
    });
  }, [commit]);

  useEffect(() => {
    current.current = null;
    loadedPages.current = 1;
    // reload publishes state only after the awaited API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return () => { epoch.current += 1; busy.current = false; };
  }, [reload]);

  return { items: page?.items ?? null, total: page?.total ?? null, cursor: page?.cursor ?? null,
    failed, loadingMore, reload, refresh, loadMore, patch };
}
