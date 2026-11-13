import { ArtifactActions } from "../components/ai/ArtifactActions";
import type { ArtifactDetail } from "@media-summarizer/core/types/artifacts";
import { mediaStatusMarker } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import { engagementDisplay } from "@media-summarizer/core/engagements/display";
import type { RecentEngagement, RecentEngagementsResponse } from "@media-summarizer/core/types/engagements";
import type { ListMediaResponse, MediaListItem } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api";
import { cachedData, readCached, storeCached } from "../lib/resourceCache";
import { useOpenAdd } from "../components/AddFlow";
import { FolderMosaic, MediaCover } from "../components/Covers";
import { Icon } from "../components/Icon";
import { TileRow } from "../components/TileRow";
import { useI18n } from "../i18n/I18nProvider";
import { useOnMediaSaved } from "../lib/mediaSaved";
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
const RECENT_PATH = `/api/media?limit=${RECENTLY_ADDED_LIMIT}`;
const CONTINUE_PATH = `/api/engagements/recent?limit=${CONTINUE_LEARNING_LIMIT}`;

type Source<T> = { items: T[] | null; failed: boolean };

export function HomePage() {
  const { t, tw } = useI18n();
  const openAdd = useOpenAdd();
  // Drawn at once from what the last visit read, then re-read (task-518).
  const [recent, setRecent] = useState<Source<MediaListItem>>(() => ({
    items: cachedData<ListMediaResponse>(RECENT_PATH)?.items ?? null,
    failed: false,
  }));
  const [continuing, setContinuing] = useState<Source<RecentEngagement>>(() => ({
    items: cachedData<RecentEngagementsResponse>(CONTINUE_PATH)?.items ?? null,
    failed: false,
  }));

  // Bumped when the list read after an import is drawn: the import is the head
  // of "Recently added", so the row goes back to its first tile (`TileRow`).
  // A focus read or the processing schedule leaves the row where the user put it.
  const [recentRestart, setRecentRestart] = useState(0);

  const loadRecent = useCallback((afterSave = false) => {
    readCached(RECENT_PATH, () => apiRequest<ListMediaResponse>(RECENT_PATH))
      .then((response) => {
        setRecent({ items: response.items, failed: false });
        if (afterSave) setRecentRestart((n) => n + 1);
      })
      // A failed re-read keeps what is on screen.
      .catch(() => setRecent((current) => ({ items: current.items, failed: current.items === null })));
  }, []);

  const loadContinuing = useCallback(() => {
    readCached(CONTINUE_PATH, () => apiRequest<RecentEngagementsResponse>(CONTINUE_PATH))
      .then((response) => setContinuing({ items: response.items, failed: false }))
      .catch(() => setContinuing((current) => ({ items: current.items, failed: current.items === null })));
  }, []);

  useEffect(() => {
    loadRecent();
    loadContinuing();
  }, [loadRecent, loadContinuing]);

  const reloadAfterSave = useCallback(() => {
    loadRecent(true);
    loadContinuing();
  }, [loadRecent, loadContinuing]);
  useOnMediaSaved(reloadAfterSave);

  const processing = (recent.items ?? []).some((item) => mediaStatusMarker(item.status) === "processing");
  useProcessingRefresh(processing, loadRecent);
  useProcessingRefresh((continuing.items ?? []).some(entry => entry.state === "pending"), loadContinuing);

  const updateLearning = (id: string, title: string | null) => {
    setContinuing(current => {
      const items = title === null ? (current.items ?? []).filter(entry => entry.id !== id || entry.kind !== "artifact")
        : (current.items ?? []).map(entry => entry.id === id && entry.kind === "artifact" ? { ...entry, title } : entry);
      storeCached(CONTINUE_PATH, { status: "success", items } satisfies RecentEngagementsResponse);
      return { ...current, items };
    });
  };
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
          <Icon name="download" size={24} />
          <h1 className="headline">{t("home.empty")}</h1>
          <p className="subtle">{tw("home.emptyHint")}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => openAdd()}
          >
            <Icon name="add" size={18} />
            {tw("nav.add")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page home">
      <h1 className="display">{t("tabs.home")}</h1>
      {recentItems.length > 0 && (
        <TileRow icon="download" title={t("home.recentlyAdded")} restartKey={recentRestart}>
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
          {continueItems.map(entry => <LearningTile key={`${entry.kind}:${entry.id}`} entry={entry} onChanged={title => updateLearning(entry.id, title)} />)}
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


function LearningTile({ entry, onChanged }: { entry: RecentEngagement; onChanged: (title: string | null) => void }) {
  useI18n();
  const display = engagementDisplay(entry);
  const path = entry.scope === "media" ? mediaPath(entry.scope_id) : folderPath(entry.scope_id);
  const params = new URLSearchParams({ [entry.kind === "artifact" ? "artifactId" : "conversationId"]: entry.id });
  const tile = <Link to={`${path}?${params}`} className={`htile learning-tile f-${display.tone}`} aria-label={display.accessibilityLabel}>
    <div className="learning-cover">
      {entry.scope === "folder" ? <FolderMosaic images={entry.preview_images} /> : <MediaCover imageUrl={entry.image_url} mediaType={entry.media_type} />}
      <span className="learning-labels" aria-hidden="true">
        <span className="learning-badge"><Icon name={display.icon} size={14} /><span className="ell">{display.typeLabel}</span></span>
        {display.stateLabel && <span className={`learning-state ${entry.state === "failed" ? "failed" : ""}`}>{display.stateLabel}</span>}
      </span>
    </div>
    <span className="t clamp2">{display.title}</span>
    <span className="small muted ell">{display.sourceTitle}</span>
  </Link>;
  if (entry.kind !== "artifact" || entry.state === "pending") return tile;
  return <ArtifactActions title={display.title} className="learning-actions"
    onRename={async title => {
      const saved = await apiRequest<ArtifactDetail>(`/api/artifacts/${encodeURIComponent(entry.id)}`, { method: "PATCH", body: { title } });
      onChanged(saved.title || title);
    }}
    onDelete={async () => {
      await apiRequest(`/api/artifacts/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      onChanged(null);
    }}>{tile}</ArtifactActions>;
}
