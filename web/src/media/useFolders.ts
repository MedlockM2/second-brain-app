import type { Folder, FolderListResponse } from "@media-summarizer/core/types/organization";
import { useCallback, useMemo } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { cachedData, storeCached, useCachedResource } from "../lib/resourceCache";

const PATH = "/api/folders";

/**
 * The account's folders, for a screen that names or offers them. One level:
 * only the root folders are offered, Unsorted first, then by name. Read through
 * the reading cache: every screen that names folders shares one list, drawn at
 * once when it was read before.
 */
export function useFolders() {
  const { locale } = useI18n();
  const resource = useCachedResource(PATH, () => apiRequest<FolderListResponse>(PATH));
  const folders = resource.data?.folders ?? null;
  const failed = Boolean(resource.error) && !resource.data;

  const roots = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    return (folders ?? [])
      .filter((folder) => !folder.parent_folder_id)
      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || collator.compare(a.name, b.name));
  }, [folders, locale]);

  const add = useCallback((folder: Folder) => {
    const current = cachedData<FolderListResponse>(PATH);
    if (!current || current.folders.some((known) => known.id === folder.id)) return;
    storeCached(PATH, { ...current, folders: [...current.folders, folder] });
  }, []);

  return { folders, roots, failed, reload: resource.reload, add };
}
