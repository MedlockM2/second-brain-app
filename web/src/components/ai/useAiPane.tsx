import { mergeArtifactIntoHistory } from "@media-summarizer/core/artifacts/history";
import { describeArtifactRefusal } from "@media-summarizer/core/artifacts/refusal";
import { formatDate, tCount, type TranslationKey } from "@media-summarizer/core/i18n/runtime";
import type {
  ArtifactContentResponse,
  ArtifactCreateResult,
  ArtifactDetail,
  ArtifactListResponse,
  ArtifactScope,
  ArtifactSummary,
} from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../api";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon, type IconName } from "../Icon";
import { PaneEmpty, type PaneSpec } from "../panes/Panes";
import { ArtifactBody, artifactContentTitle } from "./ArtifactBody";

/**
 * The AI pane of a scope — NotebookLM's "Studio": one large pill per artifact
 * type, then the append-only history; an artifact opens inside the pane, which
 * widens to read it (`wide`). Shared by the media page, the folder page and the
 * Digest; the caller only says which scope, and whether its text is ready.
 *
 * Same data rules as the mobile `ArtifactsPanel` and its screens: the newest
 * entry of a type drives its pill, an in-flight request flips the pill at once,
 * the history is re-read every 3 s while anything in it is queued or generating,
 * and a refusal is worded from its code (`describeArtifactRefusal`).
 *
 * A media holds one entry per type for good, so a type is generated once (again
 * only after a failure). A folder gains a new entry each time its sources
 * change (task-322): given `scopeMediaIds`, the pane reads the source snapshot
 * of the newest entry of each type and offers to generate again only when the
 * folder's sources differ from it — a request over the same set would answer
 * the entry already stored.
 */
export const ARTIFACT_PILLS: readonly { type: ArtifactType; labelKey: TranslationKey; icon: IconName }[] = [
  { type: "summary_short", labelKey: "artifacts.type.summaryShort", icon: "document-text-outline" },
  { type: "summary_detailed", labelKey: "artifacts.type.summaryDetailed", icon: "reader-outline" },
  { type: "notes", labelKey: "artifacts.type.notes", icon: "book-outline" },
  { type: "flashcards", labelKey: "artifacts.type.flashcards", icon: "card-outline" },
  { type: "quiz", labelKey: "artifacts.type.quiz", icon: "help-circle-outline" },
];

const POLL_MS = 3_000;

function pillOf(type: string) {
  // The legacy unscoped "summary" reads as the short summary, as on mobile.
  return ARTIFACT_PILLS.find((pill) => pill.type === (type === "summary" ? "summary_short" : type)) ?? ARTIFACT_PILLS[0];
}

const isInFlight = (artifact: ArtifactSummary) => artifact.status === "queued" || artifact.status === "generating";

export function useAiPane({
  scope,
  scopeId,
  lockedMessage,
  showSourceCount,
  scopeMediaIds,
}: {
  scope: ArtifactScope;
  scopeId: string;
  /** Set while the scope's text is not ready: the pane says this instead. */
  lockedMessage?: string | null;
  /** A folder's history names how many sources each entry read. */
  showSourceCount: boolean;
  /** A folder's current sources; absent for a media. */
  scopeMediaIds?: readonly string[];
}): { spec: PaneSpec; wide: boolean } {
  const { t, tw } = useI18n();
  const [history, setHistory] = useState<ArtifactSummary[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [requests, setRequests] = useState<readonly ArtifactType[]>([]);
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

  const inFlight = (history ?? []).some(isInFlight);
  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => void loadHistory(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [inFlight, loadHistory]);

  const generate = useCallback(
    async (type: ArtifactType) => {
      setRefusal(null);
      setRequests((current) => (current.includes(type) ? current : [...current, type]));
      try {
        const created = await apiRequest<ArtifactCreateResult>("/api/artifacts", {
          method: "POST",
          body: { scope, scope_id: scopeId, artifact_type: type },
        });
        setHistory((current) => mergeArtifactIntoHistory(current ?? [], created));
        return created;
      } catch (error) {
        setRefusal(describeArtifactRefusal(error, { scope }));
        return null;
      } finally {
        setRequests((current) => current.filter((pending) => pending !== type));
      }
    },
    [scope, scopeId],
  );

  // The newest entry per type, in the order the API returns (newest first).
  const latestByType = useMemo(() => {
    const latest = new Map<string, ArtifactSummary>();
    for (const artifact of history ?? []) {
      const type = pillOf(artifact.artifact_type).type;
      if (!latest.has(type)) latest.set(type, artifact);
    }
    return latest;
  }, [history]);

  const open = (history ?? []).find((artifact) => artifact.artifact_id === openId) ?? null;

  // The source snapshot of each newest entry, read once: an entry is immutable.
  const [snapshots, setSnapshots] = useState<Record<string, readonly string[] | null>>({});
  const reading = useRef(new Set<string>());
  useEffect(() => {
    if (!scopeMediaIds) return;
    const missing = [...latestByType.values()].filter(
      (artifact) => !(artifact.artifact_id in snapshots) && !reading.current.has(artifact.artifact_id),
    );
    for (const artifact of missing) {
      reading.current.add(artifact.artifact_id);
      apiRequest<ArtifactDetail>(`/api/artifacts/${encodeURIComponent(artifact.artifact_id)}`)
        .then((detail) => detail.sources.map((source) => source.media_item_id))
        // Unknown counts as different: offering a generation is the harmless side.
        .catch(() => null)
        .then((sources) => {
          reading.current.delete(artifact.artifact_id);
          setSnapshots((current) => ({ ...current, [artifact.artifact_id]: sources }));
        });
    }
  }, [latestByType, snapshots, scopeMediaIds]);

  const sourcesChanged = (latest: ArtifactSummary) => {
    if (!scopeMediaIds) return false;
    const snapshot = snapshots[latest.artifact_id];
    if (!snapshot) return true;
    const current = new Set(scopeMediaIds);
    return snapshot.length !== current.size || snapshot.some((id) => !current.has(id));
  };
  const generationAvailable = (latest: ArtifactSummary | undefined) =>
    !latest || latest.status === "failed" || sourcesChanged(latest);
  const staleTypes = [...latestByType.values()].filter(
    (latest) => latest.status === "ready" && scopeMediaIds && snapshots[latest.artifact_id] && sourcesChanged(latest),
  );

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
    const pill = pillOf(open.artifact_type);
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
            <span className="small muted ell">/ {t(pill.labelKey)}</span>
          </span>
        ),
        body: (
          <OpenArtifact
            key={open.artifact_id}
            artifact={open}
            showSourceCount={showSourceCount}
            onRegenerate={async () => {
              const created = await generate(pill.type);
              if (created) setOpenId(created.artifact_id);
            }}
          />
        ),
      },
    };
  }

  const pillState = (type: ArtifactType) => {
    if (requests.includes(type)) return "queued";
    return latestByType.get(type)?.status ?? "idle";
  };

  const body = (
    <>
      <div className="caps" style={{ margin: "4px 0 10px" }}>
        {t("artifacts.panel.generateHeading")}
        {scope === "folder" && ` · ${tw("ai.wholeFolder")}`}
      </div>
      <div className="pills">
        {ARTIFACT_PILLS.map((pill) => {
          const latest = latestByType.get(pill.type);
          const state = pillState(pill.type);
          const busy = state === "queued" || state === "generating";
          const canGenerate = !busy && generationAvailable(latest);
          const canOpen = !busy && state === "ready";
          // A ready entry opens; generating again over changed sources is the +.
          const onClick = () => {
            if (canOpen && latest) setOpenId(latest.artifact_id);
            else if (canGenerate) void generate(pill.type);
          };
          const label = t(pill.labelKey);
          const generateA11y = t("artifacts.a11yGenerate", { label });
          return (
            <div key={pill.type} className="pill">
              <button
                type="button"
                className="pill-main"
                disabled={!canGenerate && !canOpen}
                aria-label={canOpen ? label : generateA11y}
                onClick={onClick}
              >
                <Icon name={pill.icon} size={18} />
                <span className="grow">
                  <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>{label}</span>
                  <PillStatus state={state} />
                </span>
                {canGenerate && !canOpen && <Icon name="add" size={18} />}
              </button>
              {canGenerate && canOpen && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 32, height: 32 }}
                  aria-label={generateA11y}
                  title={generateA11y}
                  onClick={() => void generate(pill.type)}
                >
                  <Icon name="add" size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {staleTypes.length > 0 && (
        <div className="banner" style={{ marginTop: 10 }}>
          <Icon name="layers-outline" size={18} />
          <span>{tw("ai.sourcesChanged")}</span>
        </div>
      )}
      {refusal && (
        <div className="banner-err" role="alert" style={{ marginTop: 10 }}>
          <Icon name="information-circle-outline" size={18} />
          <span>{refusal}</span>
        </div>
      )}
      <div className="caps" style={{ margin: "22px 0 6px" }}>
        {tw("pane.history")}
      </div>
      {history === null && historyFailed ? (
        <div className="section-error">
          <span className="subtle small">{t("folder.artifactsLoadFailed")}</span>
          <button type="button" className="btn tonal" aria-label={t("artifacts.panel.retryA11y")} onClick={() => void loadHistory()}>
            {t("common.retry")}
          </button>
        </div>
      ) : history === null ? null : history.length === 0 ? (
        <p className="small muted">{t("artifacts.panel.empty")}</p>
      ) : (
        history.map((artifact) => (
          <HistoryRow
            key={artifact.artifact_id}
            artifact={artifact}
            showSourceCount={showSourceCount}
            onOpen={() => setOpenId(artifact.artifact_id)}
          />
        ))
      )}
    </>
  );

  return { wide: false, spec: { title: t("media.tab.ai"), icon: "sparkles-outline", body } };
}

function PillStatus({ state }: { state: string }) {
  const { t } = useI18n();
  if (state === "ready")
    return (
      <span className="small st">
        <Icon name="checkmark-circle" size={14} /> {t("artifacts.status.generated")}
      </span>
    );
  if (state === "generating")
    return (
      <span className="small st">
        <span className="spin" style={{ display: "inline-flex" }}>
          <Icon name="sync-outline" size={14} />
        </span>{" "}
        {t("artifacts.status.generating")}
      </span>
    );
  if (state === "queued")
    return (
      <span className="small st">
        <Icon name="time-outline" size={14} /> {t("artifacts.status.queued")}
      </span>
    );
  if (state === "failed")
    return (
      <span className="small st err">
        <Icon name="alert-circle-outline" size={14} /> {t("artifacts.status.failed")}
      </span>
    );
  return null;
}

function whenLabel(artifact: ArtifactSummary): string {
  const at = new Date(artifact.completed_at ?? artifact.created_at);
  return Number.isNaN(at.getTime())
    ? ""
    : formatDate(at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function HistoryRow({
  artifact,
  showSourceCount,
  onOpen,
}: {
  artifact: ArtifactSummary;
  showSourceCount: boolean;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const pill = pillOf(artifact.artifact_type);
  const title = artifact.title?.trim() || t(pill.labelKey);
  const parts = [
    showSourceCount ? tCount("artifacts.sourceCount", artifact.source_count) : null,
    isInFlight(artifact)
      ? t(artifact.status === "queued" ? "artifacts.status.queued" : "artifacts.status.generating")
      : artifact.status === "failed"
        ? t("artifacts.status.failed")
        : whenLabel(artifact),
  ].filter(Boolean);
  return (
    <button
      type="button"
      className="hist"
      aria-label={t("artifacts.history.a11yRow", { type: t(pill.labelKey), title })}
      onClick={onOpen}
    >
      <span className="hist-ico">
        <Icon name={pill.icon} size={18} />
      </span>
      <span className="grow">
        <span className="ell" style={{ display: "block", fontSize: 14, fontWeight: 500 }}>
          {title}
        </span>
        <span className="small muted">{parts.join(" · ")}</span>
      </span>
      <span className="flip-rtl">
        <Icon name="chevron-forward" size={18} />
      </span>
    </button>
  );
}

/**
 * One artifact, read in the widened pane. Its content is fetched once it is
 * ready; until then the entry is pending (the history poll moves it on), and a
 * failed one offers a new generation instead of a refresh that would never end.
 */
function OpenArtifact({
  artifact,
  showSourceCount,
  onRegenerate,
}: {
  artifact: ArtifactSummary;
  showSourceCount: boolean;
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

  const pill = pillOf(artifact.artifact_type);
  const caption = [
    t(pill.labelKey),
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

  const title = artifactContentTitle(content.content) ?? artifact.title?.trim() ?? t(pill.labelKey);
  return (
    <article>
      <div className="caps">{caption}</div>
      <h2 className="headline" style={{ fontSize: 24, margin: "4px 0 16px" }}>
        {title}
      </h2>
      <ArtifactBody type={content.artifact_type} payload={content.content} />
    </article>
  );
}
