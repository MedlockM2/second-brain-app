import { mergeArtifactIntoHistory } from "@media-summarizer/core/artifacts/history";
import { describeArtifactRefusal } from "@media-summarizer/core/artifacts/refusal";
import { formatDate, tCount } from "@media-summarizer/core/i18n/runtime";
import type {
  ArtifactContentResponse,
  ArtifactCreateResult,
  ArtifactListResponse,
  ArtifactScope,
  ArtifactSummary,
} from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon } from "../Icon";
import { PaneEmpty, type PaneSpec } from "../panes/Panes";
import { ArtifactBody, artifactContentTitle } from "./ArtifactBody";
import { ArtifactGeneratingRow, ArtifactRow } from "./ArtifactRows";
import { ARTIFACT_FORMATS, artifactFormatOf } from "./artifactFormats";

/**
 * The AI pane of a scope, on the model of the mobile AI tab and of NotebookLM's
 * Studio (task-534 on mobile, task-541 here; mockup
 * `mobile-design-mockups/ai_tab_notebooklm/`):
 *
 *     Generate
 *     [Summary]    [Learning notes]     ← four tinted tiles, always active
 *     [Flashcards] [Quiz]
 *     ┌ Generating…  (animated) ┐       ← generations in progress first
 *     Title · Type · date          >    ← then every entry, newest first
 *
 * An artifact opens inside the pane, which widens to read it (`wide`). Shared by
 * the media page, the folder page and the Digest; the caller only says which
 * scope, and whether its text is ready.
 *
 * Same data rules as the mobile `useScopeArtifacts`:
 * - the history is re-read every 3 s while anything in it is queued or
 *   generating;
 * - a click on a tile draws a generating row at once, without waiting for the
 *   POST, and a second click on the same format while that POST is out is
 *   ignored: it would ask the very same thing again;
 * - a generation the scope already holds over the same sources comes back
 *   `reused` and queues nothing: that entry opens, the only useful thing the
 *   click can still do;
 * - a refusal is worded from its code (`describeArtifactRefusal`).
 *
 * The tiles carry no state at all: a generation in progress is a row of the
 * list, so a format can be asked for again whatever its last entry says, and
 * there is no "can this type be generated?" question — asking again over the
 * same sources opens what exists, asking over different ones adds an entry.
 */
const POLL_MS = 3_000;

const isInFlight = (artifact: ArtifactSummary) => artifact.status === "queued" || artifact.status === "generating";

const newestFirst = (a: ArtifactSummary, b: ArtifactSummary) => b.created_at.localeCompare(a.created_at);

export function useAiPane({
  scope,
  scopeId,
  lockedMessage,
  showSourceCount,
}: {
  scope: ArtifactScope;
  scopeId: string;
  /** Set while the scope's text is not ready: the pane says this instead. */
  lockedMessage?: string | null;
  /** A folder's entries name how many sources each one read. */
  showSourceCount: boolean;
}): { spec: PaneSpec; wide: boolean } {
  const { t } = useI18n();
  const [history, setHistory] = useState<ArtifactSummary[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [requests, setRequests] = useState<readonly ArtifactType[]>([]);
  // The same set, readable synchronously: the guard against a second click must
  // see a click that landed before the re-render.
  const requestsRef = useRef(new Set<ArtifactType>());
  const [refusal, setRefusal] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const locked = Boolean(lockedMessage);

  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ scope, scope_id: scopeId });
      const response = await apiRequest<ArtifactListResponse>(`/api/artifacts?${params.toString()}`);
      setHistory(response.artifacts);
      setHistoryFailed(false);
    } catch {
      setHistoryFailed(true);
    }
  }, [scope, scopeId]);

  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    void (async () => {
      if (!cancelled) await loadHistory();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHistory, locked]);

  const polling = (history ?? []).some(isInFlight);
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => void loadHistory(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, loadHistory]);

  const generate = useCallback(
    async (type: ArtifactType): Promise<ArtifactCreateResult | null> => {
      if (requestsRef.current.has(type)) return null;
      setRefusal(null);
      // Before the POST, with nothing awaited in between: this is the update
      // that draws the generating row, on the click itself.
      requestsRef.current.add(type);
      setRequests([...requestsRef.current]);
      try {
        const created = await apiRequest<ArtifactCreateResult>("/api/artifacts", {
          method: "POST",
          body: { scope, scope_id: scopeId, artifact_type: type },
        });
        setHistory((current) => mergeArtifactIntoHistory(current ?? [], created));
        if (created.generation_outcome === "reused") setOpenId(created.artifact_id);
        return created;
      } catch (error) {
        setRefusal(describeArtifactRefusal(error, { scope }));
        return null;
      } finally {
        // Both paths: the merged entry carries a real status from here, and a
        // refusal must take the generating row away.
        requestsRef.current.delete(type);
        setRequests([...requestsRef.current]);
      }
    },
    [scope, scopeId],
  );

  const open = (history ?? []).find((artifact) => artifact.artifact_id === openId) ?? null;

  if (locked) {
    return {
      wide: false,
      spec: {
        title: t("media.tab.ai"),
        icon: "sparkles-outline",
        body: (
          <PaneEmpty icon="sparkles-outline">
            <p>{lockedMessage}</p>
          </PaneEmpty>
        ),
      },
    };
  }

  if (open) {
    const format = artifactFormatOf(open.artifact_type);
    return {
      wide: true,
      spec: {
        title: t("media.tab.ai"),
        icon: "sparkles-outline",
        head: (
          <span className="row" style={{ gap: 4 }}>
            <button type="button" className="btn ghost" style={{ minHeight: 32, padding: "0 8px" }} onClick={() => setOpenId(null)}>
              <span className="flip-rtl">
                <Icon name="chevron-back" size={18} />
              </span>
              {t("media.tab.ai")}
            </button>
            <span className="small muted ell">/ {format ? t(format.labelKey) : open.artifact_type}</span>
          </span>
        ),
        body: (
          <OpenArtifact
            key={open.artifact_id}
            artifact={open}
            showSourceCount={showSourceCount}
            onClose={() => setOpenId(null)}
            onRegenerate={async () => {
              const created = await generate(open.artifact_type);
              if (created) setOpenId(created.artifact_id);
            }}
          />
        ),
      },
    };
  }

  // Sorted here rather than trusted: an entry folded in by the POST, or a failed
  // one rerun under its own id, keeps the place it had in the list.
  const entries = history ?? [];
  const inFlight = entries.filter(isInFlight).sort(newestFirst);
  const settled = entries.filter((artifact) => !isInFlight(artifact)).sort(newestFirst);
  // A request whose format already has an entry in flight needs no row of its
  // own: it will answer that very entry (`collapsed`). This also keeps a row from
  // showing twice between the POST answering and the request leaving `requests`.
  const pending = requests.filter((type) => !inFlight.some((artifact) => artifact.artifact_type === type));

  const body = (
    <>
      <h2 className="gen-h">{t("artifacts.panel.generateHeading")}</h2>
      <div className="tiles">
        {ARTIFACT_FORMATS.map((format) => {
          const label = t(format.labelKey);
          return (
            <button
              key={format.type}
              type="button"
              className={`tile ${format.tone}`}
              aria-label={t("artifacts.a11yGenerate", { label })}
              onClick={() => void generate(format.type)}
            >
              <Icon name={format.icon} />
              <span className="grow">{label}</span>
            </button>
          );
        })}
      </div>
      {refusal && (
        <div className="banner-err" role="alert" style={{ marginBottom: 12 }}>
          <Icon name="information-circle-outline" size={18} />
          <span>{refusal}</span>
        </div>
      )}
      {(pending.length > 0 || inFlight.length > 0) && (
        <div className="gen-list">
          {pending.map((type) => (
            <ArtifactGeneratingRow key={`pending-${type}`} type={type} />
          ))}
          {inFlight.map((artifact) => (
            <ArtifactGeneratingRow key={artifact.artifact_id} type={artifact.artifact_type} />
          ))}
        </div>
      )}
      {history === null && historyFailed ? (
        <div className="section-error">
          <span className="subtle small">{t("folder.artifactsLoadFailed")}</span>
          <button type="button" className="btn tonal" aria-label={t("artifacts.panel.retryA11y")} onClick={() => void loadHistory()}>
            {t("common.retry")}
          </button>
        </div>
      ) : history === null ? (
        <p className="small muted">{t("common.loading")}</p>
      ) : entries.length === 0 && pending.length === 0 ? (
        <p className="small muted">{t("artifacts.panel.empty")}</p>
      ) : (
        <div className="art-list">
          {settled.map((artifact) => (
            <ArtifactRow
              key={artifact.artifact_id}
              artifact={artifact}
              showSourceCount={showSourceCount}
              onOpen={(entry) => setOpenId(entry.artifact_id)}
              onRetry={(type) => void generate(type)}
            />
          ))}
        </div>
      )}
    </>
  );

  return { wide: false, spec: { title: t("media.tab.ai"), icon: "sparkles-outline", body } };
}

function whenLabel(artifact: ArtifactSummary): string {
  const at = new Date(artifact.completed_at ?? artifact.created_at);
  return Number.isNaN(at.getTime())
    ? ""
    : formatDate(at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * One artifact, read in the widened pane. Its content is fetched once it is
 * ready. An entry opened before that — a `reused` answer can name a generation
 * still running — is pending until the history poll moves it on, and one that
 * fails offers a new generation instead of a refresh that would never end.
 */
function OpenArtifact({
  artifact,
  showSourceCount,
  onClose,
  onRegenerate,
}: {
  artifact: ArtifactSummary;
  showSourceCount: boolean;
  /** Back to the list: a finished quiz hands the reader back to it. */
  onClose: () => void;
  onRegenerate: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [content, setContent] = useState<ArtifactContentResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const ready = artifact.status === "ready";

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    apiRequest<ArtifactContentResponse>(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}/content`)
      .then((response) => {
        if (!cancelled) {
          setContent(response);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [artifact.artifact_id, ready, attempt]);

  const format = artifactFormatOf(artifact.artifact_type);
  const typeLabel = format ? t(format.labelKey) : artifact.artifact_type;
  const caption = [
    typeLabel,
    whenLabel(artifact),
    showSourceCount ? tCount("artifacts.sourceCount", artifact.source_count) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (artifact.status === "failed") {
    return (
      <div className="state-card" role="alert">
        <Icon name="alert-circle-outline" />
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{t("artifact.generationFailedTitle")}</div>
          <p className="small subtle">{t("artifact.generationFailedBody")}</p>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 12 }}
            disabled={regenerating}
            aria-label={t("artifact.regenerateA11y")}
            onClick={async () => {
              setRegenerating(true);
              await onRegenerate();
              setRegenerating(false);
            }}
          >
            {regenerating ? t("artifact.regenerating") : t("artifact.regenerate")}
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="state-card">
        <span className="spin" style={{ display: "inline-flex" }}>
          <Icon name="sync-outline" />
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>{t("artifact.notReady")}</div>
          <p className="small subtle">{t("artifact.pendingBody")}</p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="section-error" role="alert">
        <span className="subtle">{t("artifact.loadFailed")}</span>
        <button type="button" className="btn tonal" aria-label={t("artifact.retryA11y")} onClick={() => setAttempt((n) => n + 1)}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (!content) return <p className="small muted">{t("common.loading")}</p>;

  const title = artifactContentTitle(content.content) ?? (artifact.title?.trim() || typeLabel);
  return (
    <article>
      <div className="caps">{caption}</div>
      <h2 className="headline" style={{ fontSize: 24, margin: "4px 0 16px" }}>
        {title}
      </h2>
      <ArtifactBody type={content.artifact_type} payload={content.content} onFinish={onClose} />
    </article>
  );
}
