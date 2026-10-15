import { formatNumber, tCount } from "@media-summarizer/core/i18n/runtime";
import { getRelativeTime } from "@media-summarizer/core/i18n/relativeTime";
import { mediaStatusMarker } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type { ListMediaResponse, MediaListItem } from "@media-summarizer/core/types/media";
import type { Folder, FolderListResponse } from "@media-summarizer/core/types/organization";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api";
import { MediaCover, TypeBadge } from "../components/Covers";
import { Icon } from "../components/Icon";
import { NewFolderDialog } from "../components/NewFolderDialog";
import { useI18n } from "../i18n/I18nProvider";
import { useOnMediaSaved } from "../lib/mediaSaved";
import { useProcessingRefresh } from "../lib/useProcessingRefresh";
import { folderPath, mediaPath } from "../routes";
import { BackToTop } from "../components/BackToTop";

/**
 * Bibliothèque = the mobile Library (`app/(tabs)/search.tsx`), per the owner's
 * mockup: a foldable "Folders" section with its + (a folder at the root, never
 * inside another), the folder grid with Unsorted first and tinted apart, then
 * "All media" on two columns. No search field: the bar's is the one.
 *
 * `GET /api/folders` and `GET /api/media` are read apart and fail apart. The
 * media list is paged by the API's cursor, newest first as the API sorts it.
 */
const PAGE_SIZE = 40;

export function LibraryPage() {
  const { t, tw, locale } = useI18n();
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [foldersFailed, setFoldersFailed] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [creating, setCreating] = useState(false);

  const [media, setMedia] = useState<MediaListItem[] | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFolders = useCallback(() => {
    apiRequest<FolderListResponse>("/api/folders")
      .then((response) => {
        setFolders(response.folders);
        setFoldersFailed(false);
      })
      .catch(() => setFoldersFailed(true));
  }, []);

  /** The first page — a re-read replaces what is on screen with the newest page. */
  const loadMedia = useCallback(() => {
    apiRequest<ListMediaResponse>(`/api/media?limit=${PAGE_SIZE}`)
      .then((response) => {
        setMedia(response.items);
        setTotal(response.total);
        setCursor(response.has_more ? (response.next_cursor ?? null) : null);
        setMediaFailed(false);
      })
      .catch(() => setMediaFailed(true));
  }, []);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await apiRequest<ListMediaResponse>(
        `/api/media?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
      );
      setMedia((current) => [...(current ?? []), ...response.items]);
      setCursor(response.has_more ? (response.next_cursor ?? null) : null);
    } catch {
      setMediaFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFolders();
    loadMedia();
  }, [loadFolders, loadMedia]);

  const reloadAll = useCallback(() => {
    loadFolders();
    loadMedia();
  }, [loadFolders, loadMedia]);
  useOnMediaSaved(reloadAll);

  // Only while the first page is all there is: re-reading it would drop the
  // pages loaded after it.
  const processing =
    cursor === null && (media ?? []).some((item) => mediaStatusMarker(item.status) === "processing");
  useProcessingRefresh(processing, loadMedia);

  // One level: the folders at the root, Unsorted first, then by name.
  const roots = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    return (folders ?? [])
      .filter((folder) => !folder.parent_folder_id)
      .sort(
        (a, b) =>
          (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || collator.compare(a.name, b.name),
      );
  }, [folders, locale]);

  return (
    <main className="page">
      <h1 className="visually-hidden">{tw("nav.library")}</h1>

      <div className="lib-head">
        <button
          type="button"
          className="fold-toggle"
          aria-expanded={foldersOpen}
          title={t("search.foldersToggleHint")}
          onClick={() => setFoldersOpen((open) => !open)}
        >
          <h2 className="headline">{t("search.folders")}</h2>
          <span className={foldersOpen ? "" : "flip-rtl"}>
            <Icon name={foldersOpen ? "chevron-down" : "chevron-forward"} size={18} />
          </span>
        </button>
        {folders && <span className="count">{tw("library.folderTotal", { count: formatNumber(roots.length) })}</span>}
        <span className="grow" />
        <button
          type="button"
          className="icon-btn plus"
          aria-label={t("search.newFolder.a11y")}
          title={t("search.newFolder.a11y")}
          onClick={() => setCreating(true)}
        >
          <Icon name="add" size={24} />
        </button>
      </div>

      {foldersOpen &&
        (foldersFailed && !folders ? (
          <div className="section-error" role="alert">
            <span className="subtle">{t("search.foldersLoadFailed")}</span>
            <button type="button" className="btn tonal" onClick={loadFolders}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <div className="fgrid">
            {roots.map((folder) => (
              <Link key={folder.id} to={folderPath(folder.id)} className="ftile" title={folder.name}>
                <span className={folder.is_default ? "ficon def" : "ficon"}>
                  <Icon name={folder.is_default ? "file-tray-outline" : "folder"} size={24} />
                </span>
                <span className="fname clamp2">
                  {folder.is_default ? t("folderPicker.unsorted") : folder.name}
                </span>
                <span className="fhint">{tCount("common.itemCount", folder.media_count)}</span>
              </Link>
            ))}
          </div>
        ))}

      <div className="lib-head" style={{ marginTop: 32 }}>
        <h2 className="headline grow">{t("search.allMedia")}</h2>
        {media && <span className="count">{tCount("common.itemCount", total)}</span>}
      </div>

      {mediaFailed && !media ? (
        <div className="section-error" role="alert">
          <span className="subtle">{t("search.libraryLoadFailed")}</span>
          <button type="button" className="btn tonal" onClick={loadMedia}>
            {t("common.retry")}
          </button>
        </div>
      ) : media && media.length === 0 ? (
        <div className="empty">
          <p className="headline">{t("search.emptyLibrary")}</p>
          <p className="subtle">{tw("home.emptyHint")}</p>
        </div>
      ) : (
        <>
          <div className="mgrid">
            {(media ?? []).map((item) => (
              <MediaCard key={item.media_item_id} item={item} />
            ))}
          </div>
          {media &&
            (cursor ? (
              <div className="list-end">
                <button type="button" className="btn tonal" disabled={loadingMore} onClick={loadMore}>
                  {tw("library.loadMore")}
                </button>
              </div>
            ) : (
              <div className="list-end small muted">{tw("library.end")}</div>
            ))}
        </>
      )}

      {creating && (
        <NewFolderDialog
          onClose={() => setCreating(false)}
          onCreated={(folder) => {
            setFolders((current) => [...(current ?? []), folder]);
            setFoldersOpen(true);
            setCreating(false);
          }}
        />
      )}
      <BackToTop />
    </main>
  );
}

/** MediaListCard: the 16:9 cover, type and age, the two-line title, the creator. */
function MediaCard({ item }: { item: MediaListItem }) {
  const { t, tw } = useI18n();
  const marker = mediaStatusMarker(item.status);
  const title = resolveMediaTitle(item);
  const subtitle =
    marker === "processing"
      ? t("mediaStatus.processingSubtitle")
      : marker === "failed"
        ? tw("home.importFailed")
        : (item.creator_name?.trim() ?? "");
  return (
    <Link to={mediaPath(item.media_item_id)} className="mcard" title={title}>
      <MediaCover imageUrl={item.media_image} mediaType={item.media_type} status={item.status} />
      <div className="grow">
        <div className="meta">
          {marker === "failed" ? (
            <span className="badge err">{t("mediaStatus.failedBadge")}</span>
          ) : (
            <TypeBadge type={item.media_type} />
          )}
          <span>{getRelativeTime(item.created_at)}</span>
        </div>
        <div className="t clamp2">{title}</div>
        <div className="small muted ell">{subtitle}</div>
      </div>
    </Link>
  );
}
