import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Icon } from "../components/Icon";
import { MediaView } from "../components/media/MediaView";
import { useI18n } from "../i18n/I18nProvider";
import { isPendingImportKey, usePendingImportOutcome } from "../media/pendingImports";

/** What a search result hands the page it opens: the excerpt it quoted (`SearchPage`). */
export type MediaPageState = { passage: string };

function passageOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("passage" in state)) return null;
  return typeof state.passage === "string" ? state.passage : null;
}

/**
 * /media/:mediaId — a media of the library, in its three panes. Opened from the
 * add dialog while a file is still uploading (task-603), the id is the import's
 * key: the page waits for the upload, then takes the real id in place.
 */
export function MediaPage() {
  const { mediaId = "" } = useParams();
  const navigate = useNavigate();
  const passage = passageOf(useLocation().state);
  if (isPendingImportKey(mediaId)) return <PendingImportView key={mediaId} importKey={mediaId} />;
  // Keyed by id: another media is another page, with none of this one's state.
  return <MediaView key={mediaId} mediaId={mediaId} passage={passage} onDeleted={() => navigate("/library", { replace: true })} />;
}

/**
 * A file on its way to S3: no media yet, so nothing to file, discuss, share or
 * delete, and no request to the API with a key that is not an id.
 */
function PendingImportView({ importKey }: { importKey: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const outcome = usePendingImportOutcome(importKey);
  const createdId = outcome?.state === "created" ? outcome.mediaItemId : null;

  useEffect(() => {
    if (createdId) navigate(`/media/${encodeURIComponent(createdId)}`, { replace: true });
  }, [createdId, navigate]);

  const failure =
    outcome === null ? t("media.sending.lost")
      : outcome.state === "failed" ? outcome.message || t("media.failedFallback")
        : null;

  return (
    <main className="page">
      {failure ? (
        <div className="state-card" role="alert">
          <Icon name="alert-circle-outline" />
          <div className="grow">
            <p>{failure}</p>
            <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => navigate("/library", { replace: true })}>
              {t("common.back")}
            </button>
          </div>
        </div>
      ) : (
        <div className="state-card" role="status">
          <span className="spin" style={{ display: "inline-flex" }}>
            <Icon name="sync-outline" />
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{t("media.sending.file")}</div>
            <p className="small subtle">{t("media.sending.hint")}</p>
          </div>
        </div>
      )}
    </main>
  );
}
