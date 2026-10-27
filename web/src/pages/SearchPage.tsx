import { tCount } from "@media-summarizer/core/i18n/runtime";
import { getRelativeTime } from "@media-summarizer/core/i18n/relativeTime";
import { focusHighlightSegments, parseHighlightSnippet } from "@media-summarizer/core/media/highlightSnippet";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import { searchPassageFromSnippet } from "@media-summarizer/core/media/searchPassage";
import type { SearchHit, SearchTranscriptsResponse } from "@media-summarizer/core/types/search";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { apiRequest } from "../api";
import { MediaCover, TypeBadge } from "../components/Covers";
import { BackToTop } from "../components/BackToTop";
import { Icon } from "../components/Icon";
import { MediaActions } from "../components/media/MediaActions";
import { useI18n } from "../i18n/I18nProvider";
import { useFolders } from "../media/useFolders";
import { folderPath, mediaPath } from "../routes";
import type { MediaPageState } from "./MediaPage";

/**
 * /search?q= — full-text search from the bar (owner's mockup, capture 03): the
 * folders whose name matches, then the sources whose text matches, each with
 * its `<mark>`ed excerpt, on `GET /api/search/transcripts` — the endpoint the
 * mobile Library searches with. A result opens its media page, a folder its
 * folder page. Pages of 20 media, "Show more" while the API says another page
 * exists (`has_more`, task-523), and a way back to the top.
 */
const PER_PAGE = 20;

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

export function SearchPage() {
  const { t, tw } = useI18n();
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  return query ? <Results key={query} query={query} /> : (
    <main className="page">
      <h1 className="display">{t("tabs.search")}</h1>
      <p className="subtle">{tw("nav.searchPlaceholder")}</p>
    </main>
  );
}

function Results({ query }: { query: string }) {
  const { t, tw } = useI18n();
  const folders = useFolders();
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [found, setFound] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const search = new URLSearchParams({ q: query, per_page: String(PER_PAGE) });
    apiRequest<SearchTranscriptsResponse>(`/api/search/transcripts?${search.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setHits(response.hits);
        setFound(response.found);
        setHasMore(response.has_more);
        setPage(1);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [query, attempt]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const search = new URLSearchParams({ q: query, per_page: String(PER_PAGE), page: String(page + 1) });
      const response = await apiRequest<SearchTranscriptsResponse>(`/api/search/transcripts?${search.toString()}`);
      // A media already shown is not shown twice, whatever the page boundaries.
      setHits((current) => {
        const seen = new Set((current ?? []).map((hit) => hit.media_item_id));
        return [...(current ?? []), ...response.hits.filter((hit) => !seen.has(hit.media_item_id))];
      });
      setHasMore(response.has_more);
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  // Folder names match locally, accents and case aside; one level, so roots only.
  const matchingFolders = useMemo(() => {
    const needle = fold(query);
    return folders.roots.filter((folder) => !folder.is_default && fold(folder.name).includes(needle));
  }, [folders.roots, query]);

  const drop = (mediaId: string) => setHits((current) => (current ?? []).filter((hit) => hit.media_item_id !== mediaId));

  return (
    <main className="page">
      <Link to="/library" className="btn ghost" style={{ marginBottom: 4 }}>
        <span className="flip-rtl">
          <Icon name="chevron-back" size={18} />
        </span>
        {tw("nav.library")}
      </Link>
      <h1 className="display">{tw("search.title", { query })}</h1>
      {hits && (
        <div className="small muted" style={{ margin: "4px 0 20px" }}>
          {tw("search.summary", { count: tCount("search.resultCount", found) })}
        </div>
      )}

      {matchingFolders.length > 0 && (
        <>
          <h2 className="headline" style={{ marginBottom: 12 }}>
            {t("search.folders")}
          </h2>
          <div className="fgrid" style={{ marginBottom: 28 }}>
            {matchingFolders.map((folder) => (
              <Link key={folder.id} to={folderPath(folder.id)} className="ftile" title={folder.name}>
                <span className="ficon">
                  <Icon name="folder" size={24} />
                </span>
                <span className="fname clamp2">{folder.name}</span>
                <span className="fhint">{tCount("common.itemCount", folder.media_count)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {failed && !hits ? (
        <div className="section-error" role="alert">
          <span className="subtle">{t("search.failed")}</span>
          <button type="button" className="btn tonal" aria-label={t("search.retrySearchA11y")} onClick={() => setAttempt((n) => n + 1)}>
            {t("common.retry")}
          </button>
        </div>
      ) : hits && hits.length === 0 ? (
        <div className="empty">
          <p className="headline">{t("search.noResultsTitle")}</p>
          <p className="subtle">{t("search.noMatches", { query })}</p>
        </div>
      ) : hits ? (
        <>
          <h2 className="headline" style={{ marginBottom: 8 }}>
            {tw("search.inTextHeading")}
          </h2>
          <div className="mgrid one">
            {hits.map((hit) => (
              <div key={hit.media_item_id} className="mcard-row">
                <HitCard hit={hit} />
                {hit.in_library && (
                  <MediaActions
                    mediaId={hit.media_item_id}
                    title={resolveMediaTitle(hit)}
                    folderId={hit.folder_id}
                    roots={folders.roots}
                    onFolderCreated={folders.add}
                    onMoved={() => undefined}
                    onRenamed={(title) =>
                      setHits((current) => (current ?? []).map((row) => (row.media_item_id === hit.media_item_id ? { ...row, title } : row)))
                    }
                    onDeleted={() => drop(hit.media_item_id)}
                  />
                )}
              </div>
            ))}
          </div>
          {hasMore ? (
            <div className="list-end">
              <button type="button" className="btn tonal" disabled={loadingMore} onClick={() => void more()}>
                {tw("library.loadMore")}
              </button>
            </div>
          ) : (
            <div className="list-end small muted">{t("search.endOfResults")}</div>
          )}
        </>
      ) : null}
      <BackToTop />
    </main>
  );
}

/** A hit read as its library row, with the matched excerpt under it. */
function HitCard({ hit }: { hit: SearchHit }) {
  const title = resolveMediaTitle(hit);
  const snippet = hit.highlights[0]?.snippet;
  const segments = snippet ? focusHighlightSegments(parseHighlightSnippet(snippet), { leadChars: 60, maxChars: 280 }) : [];
  const body = (
    <>
      <MediaCover imageUrl={hit.media_image} mediaType={hit.media_type} />
      <div className="grow">
        <div className="meta">
          <TypeBadge type={hit.media_type} />
          <span>{getRelativeTime(hit.created_at)}</span>
        </div>
        <div className="t clamp2">{title}</div>
        {hit.creator_name && <div className="small muted ell">{hit.creator_name}</div>}
        {segments.length > 0 && (
          <div className="snippet clamp2">
            {segments.map((segment, i) => (segment.highlighted ? <mark key={i}>{segment.text}</mark> : <span key={i}>{segment.text}</span>))}
          </div>
        )}
      </div>
    </>
  );
  // The page opens on the passage the excerpt quotes; a hit on the title alone
  // has none and opens at the top.
  const passage = searchPassageFromSnippet(snippet);
  const state: MediaPageState | undefined = passage ? { passage } : undefined;
  // A hit the index kept after its media was deleted opens nothing.
  return hit.in_library ? (
    <Link to={mediaPath(hit.media_item_id)} state={state} className="mcard" title={title}>
      {body}
    </Link>
  ) : (
    <div className="mcard orphan">{body}</div>
  );
}
