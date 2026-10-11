import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useI18n } from "../../i18n/I18nProvider";
import { useFolders } from "../../media/useFolders";
import { useMediaDetail } from "../../media/useMediaDetail";
import { folderPath } from "../../routes";
import { useAiPane } from "../ai/useAiPane";
import { PaneEmpty, Panes } from "../panes/Panes";
import { useToast } from "../Toast";
import { MediaActions } from "./MediaActions";
import { ReadingBody } from "./ReadingBody";

/**
 * A media as a page of three panes (owner's mockup, captures 08 to 11):
 * Reading on the left, the discussion in the middle — a slot task-480 fills —
 * and the AI pane on the right. It reads its media by id and nothing else from
 * the route, so the Digest renders the same view under its period strip
 * (`band`).
 */
export function MediaView({
  mediaId,
  band,
  onDeleted,
}: {
  mediaId: string;
  band?: ReactNode;
  onDeleted: () => void;
}) {
  const { t, tw } = useI18n();
  const detail = useMediaDetail(mediaId);
  const folders = useFolders();
  const toast = useToast();
  const [renamed, setRenamed] = useState<string | null>(null);

  const item = detail.data?.media_item ?? null;
  const ready = detail.state === "completed";
  const lockedReason = !item || ready ? null : detail.state === "failed" ? "unavailable" : "pending";

  const ai = useAiPane({
    scope: "media",
    scopeId: mediaId,
    showSourceCount: false,
    lockedMessage:
      lockedReason === "unavailable" ? tw("pane.aiUnavailable") : lockedReason === "pending" || !item ? tw("pane.aiLocked") : null,
  });

  if (!item) {
    return (
      <main className="page">
        {detail.state === "error" ? (
          <div className="section-error" role="alert">
            <span className="subtle">{detail.error ?? t("media.loadFailed")}</span>
            <button type="button" className="btn tonal" aria-label={t("media.retryA11y")} onClick={detail.refresh}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <p className="small muted">{t("common.loading")}</p>
        )}
      </main>
    );
  }

  const title = renamed ?? resolveMediaTitle(item);
  const folder =
    folders.roots.find((candidate) => candidate.id === item.folder_id) ??
    folders.roots.find((candidate) => candidate.is_default) ??
    null;
  const location = folder ? (
    <nav className="crumbs" aria-label={t("folderPicker.title")}>
      <Link to={folderPath(folder.id)} title={folder.name}>
        {folder.is_default ? tw("nav.unsortedNoCount") : folder.name}
      </Link>
    </nav>
  ) : null;

  return (
    <>
      <Panes
        band={band}
        wideRight={ai.wide}
        left={{
          title: t("media.tab.reader"),
          icon: "book-outline",
          head: location,
          actions: (
            <MediaActions
              mediaId={mediaId}
              title={title}
              folderId={item.folder_id ?? null}
              roots={folders.roots}
              onFolderCreated={folders.add}
              onMoved={(target) => {
                detail.patch({ folder_id: target.id });
                toast.show(t("media.movedToNamed", { name: target.is_default ? tw("nav.unsortedNoCount") : target.name }));
              }}
              onRenamed={setRenamed}
              onDeleted={onDeleted}
            />
          ),
          body: <ReadingBody item={item} title={title} state={detail.state} error={detail.error} onRefresh={detail.refresh} />,
        }}
        mid={{
          title: tw("pane.discussion"),
          icon: "chatbubbles-outline",
          // The conversation itself is task-480's; until the text is ready, the
          // pane says why there is none.
          body: lockedReason ? (
            <PaneEmpty icon="chatbubbles-outline">
              <p>{tw(lockedReason === "unavailable" ? "pane.discussionUnavailable" : "pane.discussionLocked")}</p>
            </PaneEmpty>
          ) : null,
        }}
        right={ai.spec}
      />
      {toast.node}
    </>
  );
}
