import { mediaStatusMarker } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import { tCount } from "@media-summarizer/core/i18n/runtime";
import type { RecentEngagement, RecentEngagementsResponse } from "@media-summarizer/core/types/engagements";
import type { ListMediaResponse, MediaListItem } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api";
import { FolderMosaic, MediaCover } from "../components/Covers";
import { Icon } from "../components/Icon";
import { TileRow } from "../components/TileRow";
import { useI18n } from "../i18n/I18nProvider";
import { useProcessingRefresh } from "../lib/useProcessingRefresh";
import { folderPath, mediaPath } from "../routes";

/**
 * Accueil = the mobile Home (`app/(tabs)/inbox.tsx`), per the owner's mockup:
 * "Recently added" and "Continue learning" as rows of 200 px 16:9 tiles with
 * ‹ ›, folders as mosaics in the second row. No unsorted-review card (the bar's
 * Unsorted · N tab replaces it), no minutes alert, no floating buttons (the
 * bar's Add is the +).
 *
 * Two sources, each failing alone: `GET /api/media` for what just arrived, and
 * `GET /api/engagements/recent` for what to pick back up — already merged,
 * ordered and signed server-side.
 */
const RECENTLY_ADDED_LIMIT = 12;
const CONTINUE_LEARNING_LIMIT = 12;

type Source<T> = { items: T[] | null; failed: boolean };

export function HomePage() {
  const { t, tw } = useI18n();
  const [recent, setRecent] = useState<Source<MediaListItem>>({ items: null, failed: false });
  const [continuing, setContinuing] = useState<Source<RecentEngagement>>({ items: null, failed: false });

  const loadRecent = useCallback(() => {
    apiRequest<ListMediaResponse>(`/api/media?limit=${RECENTLY_ADDED_LIMIT}`)
      .then((response) => setRecent({ items: response.items, failed: false }))
      // A failed re-read keeps what is on screen.
      .catch(() => setRecent((current) => ({ items: current.items, failed: current.items === null })));
  }, []);

  const loadContinuing = useCallback(() => {
    apiRequest<RecentEngagementsResponse>(`/api/engagements/recent?limit=${CONTINUE_LEARNING_LIMIT}`)
      .then((response) => setContinuing({ items: response.items, failed: false }))
      .catch(() => setContinuing((current) => ({ items: current.items, failed: current.items === null })));
  }, []);

  useEffect(() => {
    loadRecent();
    loadContinuing();
  }, [loadRecent, loadContinuing]);

  const processing = (recent.items ?? []).some((item) => mediaStatusMarker(item.status) === "processing");
  useProcessingRefresh(processing, loadRecent);

  const recentItems = recent.items ?? [];
  const continueItems = continuing.items ?? [];
  const settled = (recent.items !== null || recent.failed) && (continuing.items !== null || continuing.failed);

  if (!settled) return <main className="page" aria-busy="true" />;

  if (recent.failed && continuing.failed) {
    return (
      <main className="page">
        <div className="section-error" role="alert">
          <span className="subtle">{t("home.loadFailed")}</span>
          <button
            type="button"
            className="btn tonal"
            onClick={() => {
              loadRecent();
              loadContinuing();
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      </main>
    );
  }

  if (recentItems.length === 0 && continueItems.length === 0) {
    return (
      <main className="page">
        <div className="empty">
          <Icon name="sparkles" size={24} />
          <h1 className="headline">{t("home.empty")}</h1>
          <p className="subtle">{tw("home.emptyHint")}</p>
          <Link to="/add" className="btn primary">
            <Icon name="add" size={18} />
            {tw("nav.add")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page home">
      <h1 className="visually-hidden">{t("tabs.home")}</h1>
      {recentItems.length > 0 && (
        <TileRow icon="sparkles" title={t("home.recentlyAdded")}>
          {recentItems.map((item) => (
            <MediaTile
              key={item.media_item_id}
              id={item.media_item_id}
              title={resolveMediaTitle(item)}
              creator={item.creator_name}
              imageUrl={item.media_image}
              mediaType={item.media_type}
              status={item.status}
            />
          ))}
        </TileRow>
      )}
      {continueItems.length > 0 && (
        <TileRow icon="play-circle-outline" title={t("home.continueLearning")}>
          {continueItems.map((entry) =>
            entry.kind === "folder" ? (
              <Link key={`f:${entry.id}`} to={folderPath(entry.id)} className="htile">
                <FolderMosaic images={entry.preview_images ?? []} />
                <span className="t clamp2">{entry.title?.trim() || t("home.untitledFolder")}</span>
                <span className="small muted ell">
                  {tw("home.folderLabel")} · {tCount("common.itemCount", entry.item_count ?? 0)}
                </span>
              </Link>
            ) : (
              <MediaTile
                key={`m:${entry.id}`}
                id={entry.id}
                title={resolveMediaTitle(entry)}
                creator={entry.creator_name}
                imageUrl={entry.image_url}
                mediaType={entry.media_type}
              />
            ),
          )}
        </TileRow>
      )}
    </main>
  );
}

/**
 * One media tile. The line under the title is the creator — or, while there is
 * one, the state of the import, which matters more for the few seconds it lasts.
 * The engagement row carries no status: an item already read is not an import.
 */
function MediaTile({
  id,
  title,
  creator,
  imageUrl,
  mediaType,
  status,
}: {
  id: string;
  title: string;
  creator?: string | null;
  imageUrl?: string | null;
  mediaType?: string | null;
  status?: string | null;
}) {
  const { t, tw } = useI18n();
  const marker = mediaStatusMarker(status);
  const subtitle =
    marker === "processing"
      ? t("mediaStatus.processingSubtitle")
      : marker === "failed"
        ? tw("home.importFailed")
        : (creator?.trim() ?? "");
  return (
    <Link to={mediaPath(id)} className="htile" title={title}>
      <MediaCover imageUrl={imageUrl} mediaType={mediaType} status={status} />
      <span className="t clamp2">{title}</span>
      <span className="small muted ell">{subtitle}</span>
    </Link>
  );
}
