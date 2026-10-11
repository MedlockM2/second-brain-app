import { getRelativeTime } from "@media-summarizer/core/i18n/relativeTime";
import { mediaTypeLabelKey } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type { ListMediaResponse, MediaListItem } from "@media-summarizer/core/types/media";
import type { Folder } from "@media-summarizer/core/types/organization";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { apiRequest } from "../api";
import { MediaCover } from "../components/Covers";
import { FolderPickerList, recentFolders, rememberFolder } from "../components/FolderPicker";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n/I18nProvider";
import { notifyMediaSaved } from "../lib/mediaSaved";
import { useFolders } from "../media/useFolders";
import { mediaPath } from "../routes";

/**
 * The unsorted review, adapted to the desktop (owner's mockup, captures 06 and
 * 07): the mobile actions — Discard, Deepen, File — without the carousel. The
 * queue on the left, the source to decide in the middle (cover, hook, points),
 * the destinations always open on the right. One click files it, or the keys:
 * 1 to 5 for the recent folders, D to discard, O to deepen, ← → to move.
 *
 * Same queue as mobile (`app/media/unsorted-review.tsx`): the default folder,
 * oldest first, one page of 100, frozen when the review opens — a source saved
 * meanwhile waits for the next pass. A discard leaves the queue at once and the
 * DELETE follows; a failure puts the source back where it was.
 */
const QUEUE_LIMIT = 100;

export function UnsortedPage() {
  const { t, tw } = useI18n();
  const navigate = useNavigate();
  const folders = useFolders();
  const toast = useToast();
  const [queue, setQueue] = useState<MediaListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);

  // The default folder is named by its id, never by its name (task-297). Keyed
  // on the id alone, so the queue is read once and stays frozen.
  const unsortedId = folders.folders?.find((folder) => folder.is_default)?.id ?? null;

  useEffect(() => {
    if (!unsortedId) return;
    const params = new URLSearchParams({ folder_id: unsortedId, limit: String(QUEUE_LIMIT), sort: "asc" });
    apiRequest<ListMediaResponse>(`/api/media?${params.toString()}`)
      .then((response) => {
        setQueue(response.items.filter((item) => !item.folder_id || item.folder_id === unsortedId));
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [unsortedId, round]);

  const current = queue && queue.length > 0 ? queue[Math.min(index, queue.length - 1)] : null;

  /** Take the current source out of the queue, keeping the cursor on the next one. */
  const leave = useCallback((mediaId: string) => {
    setQueue((items) => (items ?? []).filter((item) => item.media_item_id !== mediaId));
    notifyMediaSaved();
  }, []);

  const discard = useCallback(() => {
    if (!current || !queue) return;
    const at = queue.indexOf(current);
    leave(current.media_item_id);
    apiRequest(`/api/media/${encodeURIComponent(current.media_item_id)}`, { method: "DELETE" }).catch(() => {
      setQueue((items) => {
        const next = [...(items ?? [])];
        next.splice(Math.min(at, next.length), 0, current);
        return next;
      });
      toast.show(t("unsortedReview.discardFailed"));
    });
  }, [current, queue, leave, toast, t]);

  const deepen = useCallback(() => {
    if (current) navigate(mediaPath(current.media_item_id));
  }, [current, navigate]);

  const file = useCallback(
    async (folder: Folder) => {
      if (!current) return;
      await apiRequest(`/api/media/${encodeURIComponent(current.media_item_id)}`, {
        method: "PATCH",
        body: { folder_id: folder.id },
      });
      leave(current.media_item_id);
      toast.show(tw("add.filed", { name: folder.name }));
    },
    [current, leave, toast, tw],
  );

  const move = useCallback(
    (step: number) => setIndex((i) => Math.max(0, Math.min(i + step, (queue?.length ?? 1) - 1))),
    [queue],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector(".scrim")) return;
      const rtl = document.documentElement.dir === "rtl";
      const key = event.key.toLowerCase();
      if (key === "d") discard();
      else if (key === "o") deepen();
      else if (event.key === "ArrowRight") move(rtl ? -1 : 1);
      else if (event.key === "ArrowLeft") move(rtl ? 1 : -1);
      else if (/^[1-5]$/.test(key)) {
        const folder = recentFolders(folders.roots)[Number(key) - 1];
        if (!folder) return;
        rememberFolder(folder.id);
        void file(folder).catch(() => toast.show(t("folderPicker.saveFailed")));
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [discard, deepen, move, file, folders.roots, toast, t]);

  if (failed && !queue) {
    return (
      <main className="page">
        <div className="section-error" role="alert">
          <span className="subtle">{t("unsortedReview.loadFailed")}</span>
          <button type="button" className="btn tonal" onClick={() => setRound((n) => n + 1)}>
            {t("common.retry")}
          </button>
        </div>
      </main>
    );
  }
  if (!queue) return <main className="page" aria-busy="true" />;

  if (!current) {
    return (
      <main className="page">
        <div className="empty" role="status">
          <Icon name="checkmark-circle" size={24} />
          <h1 className="headline">{t("unsortedReview.doneTitle")}</h1>
          <p className="subtle">{t("unsortedReview.doneBody")}</p>
          <Link to="/" className="btn primary">
            {tw("review.backHome")}
          </Link>
        </div>
        {toast.node}
      </main>
    );
  }

  const position = queue.indexOf(current) + 1;
  const blurb = current.review_blurb;

  return (
    <main className="review">
      <section className="pane" aria-label={t("unsortedReview.title")}>
        <header className="pane-head">
          <h1 className="pane-title grow" style={{ fontSize: 15 }}>
            {t("unsortedReview.title")}
          </h1>
          <span className="count" style={{ paddingInlineEnd: 12 }} aria-label={t("unsortedReview.positionA11y", { current: position, total: queue.length })}>
            {t("unsortedReview.position", { current: position, total: queue.length })}
          </span>
        </header>
        <div className="pane-body">
          {queue.map((item, i) => (
            <button
              key={item.media_item_id}
              type="button"
              className={item === current ? "queue-row sel" : "queue-row"}
              aria-current={item === current ? "true" : undefined}
              onClick={() => setIndex(i)}
            >
              <MediaCover imageUrl={item.media_image} mediaType={item.media_type} status={item.status} />
              <span className="grow">
                <span className="clamp2" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                  {resolveMediaTitle(item)}
                </span>
                <span className="small muted">{getRelativeTime(item.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="review-center">
        <article className="triage" aria-live="polite">
          <div className="triage-head">
            <MediaCover imageUrl={current.media_image} mediaType={current.media_type} status={current.status} />
            <div className="grow">
              <div className="row small muted">
                <span className="badge">{t(mediaTypeLabelKey(current.media_type))}</span>
                <span>{getRelativeTime(current.created_at)}</span>
              </div>
              <h2 className="headline" style={{ fontSize: 24, margin: "6px 0 4px" }}>
                {resolveMediaTitle(current)}
              </h2>
              {current.creator_name && <div className="subtle">{current.creator_name}</div>}
            </div>
          </div>
          <div className="blurb">
            {blurb?.hook ? (
              <>
                <p>{blurb.hook}</p>
                {blurb.points.length > 0 && (
                  <ul className="bullets">
                    {blurb.points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <span className="subtle">{t("unsortedReview.noBlurb")}</span>
            )}
          </div>
          <div className="triage-actions">
            <button type="button" className="btn tonal" aria-label={t("unsortedReview.discardA11y", { title: resolveMediaTitle(current) })} onClick={discard}>
              <Icon name="trash-outline" size={18} />
              {t("unsortedReview.discard")}
              <kbd className="kbd">D</kbd>
            </button>
            <button type="button" className="btn tonal" aria-label={t("unsortedReview.deepenA11y", { title: resolveMediaTitle(current) })} onClick={deepen}>
              <Icon name="book-outline" size={18} />
              {t("unsortedReview.deepen")}
              <kbd className="kbd">O</kbd>
            </button>
            <span className="grow" />
            <span className="small muted">{tw("review.fileHint")}</span>
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
            <button type="button" className="icon-btn flip-rtl" aria-label={t("common.back")} disabled={position === 1} onClick={() => move(-1)}>
              <Icon name="chevron-back" size={18} />
            </button>
            <span className="small muted">{tw("review.navHint")}</span>
            <button type="button" className="icon-btn flip-rtl" aria-label={t("common.continue")} disabled={position === queue.length} onClick={() => move(1)}>
              <Icon name="chevron-forward" size={18} />
            </button>
          </div>
        </article>
      </div>

      <section className="pane" aria-label={tw("review.fileTitle")}>
        <header className="pane-head">
          <div className="pane-title grow" style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-start" }}>
            <Icon name="folder-outline" size={18} />
            {tw("review.fileTitle")}
          </div>
        </header>
        <div className="pane-body">
          <FolderPickerList
            key={current.media_item_id}
            roots={folders.roots}
            showUnsorted={false}
            numbered
            onPick={file}
            onCreated={folders.add}
          />
        </div>
      </section>
      {toast.node}
    </main>
  );
}
