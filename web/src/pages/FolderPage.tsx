import { tCount } from "@media-summarizer/core/i18n/runtime";
import { mediaStatusMarker } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type { MediaListItem } from "@media-summarizer/core/types/media";
import type { Folder } from "@media-summarizer/core/types/organization";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AddSourceDialog } from "../components/AddSourceDialog";
import { useAiPane } from "../components/ai/useAiPane";
import { useChatPane } from "../components/chat/useChatPane";
import { MediaCover, TypeBadge } from "../components/Covers";
import { FolderActions } from "../components/FolderActions";
import { Icon } from "../components/Icon";
import { MediaActions } from "../components/media/MediaActions";
import { PaneEmpty, Panes } from "../components/panes/Panes";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n/I18nProvider";
import { useFolders } from "../media/useFolders";
import { usePagedMedia } from "../media/usePagedMedia";
import { useOnMediaSaved } from "../lib/mediaSaved";
import { useProcessingRefresh } from "../lib/useProcessingRefresh";
import { mediaPath } from "../routes";

/**
 * /folders/:folderId — a folder in three panes (owner's mockup, captures 12 to
 * 14), on the media page's layout: its Sources on the left, the discussion over
 * "this folder · N sources" in the middle (task-480), the AI pane
 * generating over the whole folder on the right.
 *
 * Folders have one level: no subfolder section, no folder created in a folder,
 * and the folder's `…` is Rename and Delete only. Unsorted has no `…`: the API
 * refuses to rename or delete the default folder.
 */
const SOURCES_LIMIT = 100;

export function FolderPage() {
  const { folderId = "" } = useParams();
  return <FolderView key={folderId} folderId={folderId} />;
}

function FolderView({ folderId }: { folderId: string }) {
  const { t, tw } = useI18n();
  const navigate = useNavigate();
  const folders = useFolders();
  const toast = useToast();
  const [renamed, setRenamed] = useState<Folder | null>(null);
  const sourceList = usePagedMedia(SOURCES_LIMIT, folderId);
  const { items: sources, failed: sourcesFailed, reload: loadSources } = sourceList;
  const [adding, setAdding] = useState<"file" | "audio" | null>(null);

  useOnMediaSaved(loadSources);
  useProcessingRefresh(
    (sources ?? []).some((item) => mediaStatusMarker(item.status) === "processing"),
    sourceList.refresh,
  );

  const ai = useAiPane({ scope: "folder", scopeId: folderId, showSourceCount: true });

  const found = folders.folders?.find((candidate) => candidate.id === folderId) ?? null;
  const folder = renamed ?? found;
  const count = sourceList.total ?? folder?.media_count ?? 0;
  const chat = useChatPane({
    scope: "folder",
    scopeId: folderId,
    sourceReady: true,
    scopeLabel: `${tw("pane.scopeFolder")} · ${tCount("artifacts.sourceCount", count)}`,
  });

  if (!folder) {
    return (
      <main className="page">
        {folders.failed || (folders.folders && !found) ? (
          <div className="section-error" role="alert">
            <span className="subtle">{t("folder.loadFailed")}</span>
            <button type="button" className="btn tonal" aria-label={t("folder.retryA11y")} onClick={folders.reload}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <p className="small muted">{t("common.loading")}</p>
        )}
      </main>
    );
  }

  const name = folder.is_default ? tw("nav.unsortedNoCount") : folder.name;
  const drop = (mediaId: string) =>
    sourceList.patch(mediaId, null);

  const sourcesBody = (
    <>
      <h1 className="headline" style={{ fontSize: 24, overflowWrap: "anywhere" }}>
        {name}
      </h1>
      <div className="small muted" style={{ marginBottom: 14 }}>
        {tCount("artifacts.sourceCount", count)}
      </div>
      <div className="folder-source-actions">
        <button type="button" className="icon-btn" aria-label={t("recording.entry")} title={t("recording.entry")} onClick={() => setAdding("audio")}><Icon name="mic-outline" /></button>
        <button type="button" className="btn primary grow" onClick={() => setAdding("file")}>
          <Icon name="add" size={18} />
          {tw("folder.addSources")}
        </button>
      </div>
      {sources === null && sourcesFailed ? (
        <div className="section-error" role="alert">
          <span className="subtle">{t("folder.loadFailed")}</span>
          <button type="button" className="btn tonal" onClick={loadSources}>
            {t("common.retry")}
          </button>
        </div>
      ) : sources && sources.length === 0 ? (
        <PaneEmpty icon="folder-outline">
          <div style={{ fontWeight: 600 }}>{t("folder.empty")}</div>
          <p>{t("folder.emptyHint")}</p>
        </PaneEmpty>
      ) : (
        (sources ?? []).map((item) => (
          <SourceRow
            key={item.media_item_id}
            item={item}
            actions={
              <MediaActions
                mediaId={item.media_item_id}
                title={resolveMediaTitle(item)}
                folderId={item.folder_id ?? folderId}
                roots={folders.roots}
                onFolderCreated={folders.add}
                onMoved={(target) => {
                  drop(item.media_item_id);
                  toast.show(t("media.movedToNamed", { name: target.is_default ? tw("nav.unsortedNoCount") : target.name }));
                }}
                onRenamed={(title) => sourceList.patch(item.media_item_id, { title })}
                onDeleted={() => drop(item.media_item_id)}
              />
            }
          />
        ))
      )}
      {sources && sourcesFailed && (
        <div className="section-error" role="alert">
          <span className="subtle">{t("folder.loadFailed")}</span>
          <button type="button" className="btn tonal" disabled={sourceList.loadingMore}
            onClick={sourceList.cursor ? sourceList.loadMore : loadSources}>
            {t("common.retry")}
          </button>
        </div>
      )}
      {sourceList.cursor && (
        <div className="list-end">
          <button type="button" className="btn tonal" disabled={sourceList.loadingMore} onClick={sourceList.loadMore}>
            {sourceList.loadingMore ? t("common.loading") : tw("library.loadMore")}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      <Panes
        wideRight={ai.wide}
        left={{
          title: t("folder.tab.sources"),
          icon: "layers-outline",
          head: (
            <nav className="crumbs" aria-label={tw("nav.library")}>
              <Link to="/library">{tw("nav.library")}</Link>
            </nav>
          ),
          actions: folder.is_default ? null : (
            <FolderActions
              folder={folder}
              onRenamed={setRenamed}
              onDeleted={() => navigate("/library", { replace: true })}
            />
          ),
          body: sourcesBody,
        }}
        mid={chat}
        right={ai.spec}
      />
      {adding && (
        <AddSourceDialog
          folder={{ id: folder.id, name }}
          initialRecording={adding === "audio"}
          onClose={() => setAdding(null)}
          onAdded={() => {
            toast.show(tw("add.added"));
            loadSources();
          }}
        />
      )}
      {toast.node}
    </>
  );
}

/** A source of the folder: cover, title, type and creator (or its import state), and its `…`. */
function SourceRow({ item, actions }: { item: MediaListItem; actions: ReactNode }) {
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
    <div className="src-row">
      <Link to={mediaPath(item.media_item_id)} title={title}>
        <MediaCover imageUrl={item.media_image} mediaType={item.media_type} status={item.status} />
        <span className="grow">
          <span className="t clamp2">{title}</span>
          <span className="meta">
            {marker === "failed" ? (
              <span className="badge err">{t("mediaStatus.failedBadge")}</span>
            ) : (
              <TypeBadge type={item.media_type} />
            )}
            <span className="ell">{subtitle}</span>
          </span>
        </span>
      </Link>
      {actions}
    </div>
  );
}
