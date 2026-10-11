import type { Folder, FolderListResponse } from "@media-summarizer/core/types/organization";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import { useI18n } from "../i18n/I18nProvider";

/**
 * The account's folders, for a screen that names or offers them. One level:
 * only the root folders are offered, Unsorted first, then by name.
 */
export function useFolders() {
  const { locale } = useI18n();
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    apiRequest<FolderListResponse>("/api/folders")
      .then((response) => {
        setFolders(response.folders);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => reload(), [reload]);

  const roots = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    return (folders ?? [])
      .filter((folder) => !folder.parent_folder_id)
      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || collator.compare(a.name, b.name));
  }, [folders, locale]);

  const add = useCallback((folder: Folder) => setFolders((current) => [...(current ?? []), folder]), []);

  return { folders, roots, failed, reload, add };
}
