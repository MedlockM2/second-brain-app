import { tCount } from "@media-summarizer/core/i18n/runtime";
import { getRelativeTime } from "@media-summarizer/core/i18n/relativeTime";
import type { ArtifactSummary } from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon } from "../Icon";
import { artifactFormatOf } from "./artifactFormats";

/**
 * The rows of the AI pane's single list, on the model of the mobile
 * `ArtifactRow` and `ArtifactGeneratingRow` (task-534, task-541).
 */

/**
 * One settled entry: a generated artifact, or a generation that failed.
 *
 * A **ready** entry shows the format's icon in its ink, the title the model
 * wrote, then "Type · N sources · date". The source count is the entry's own
 * snapshot, and only a folder says it — a media item is a single source. A
 * click opens it in the pane.
 *
 * A **failed** entry stays in the list, says so in the error colour, and a
 * click asks for the same generation again: the backend reruns a failed entry
 * over the same sources under the same id (`generation_outcome: "retried"`).
 */
export function ArtifactRow({
  artifact,
  showSourceCount,
  onOpen,
  onRetry,
}: {
  artifact: ArtifactSummary;
  /** Whether the meta line names the number of sources: a folder's entries do. */
  showSourceCount: boolean;
  onOpen: (artifact: ArtifactSummary) => void;
  onRetry: (type: ArtifactType) => void;
}) {
  const { t } = useI18n();
  const format = artifactFormatOf(artifact.artifact_type);
  const typeLabel = format ? t(format.labelKey) : artifact.artifact_type;
  const chevron = (
    <span className="flip-rtl">
      <Icon name="chevron-forward" size={18} />
    </span>
  );

  if (artifact.status === "failed") {
    return (
      <button
        type="button"
        className="art-row err"
        aria-label={t("artifacts.row.a11yRetry", { type: typeLabel })}
        onClick={() => onRetry(artifact.artifact_type)}
      >
        <Icon name="alert-circle-outline" size={24} />
        <span className="grow">
          {/* A failed entry has no title of its own: the model never wrote one. */}
          <span className="t">{typeLabel}</span>
          <span className="m">{t("artifacts.row.failed")}</span>
        </span>
        {chevron}
      </button>
    );
  }

  const title = artifact.title?.trim() || typeLabel;
  const meta = [
    typeLabel,
    showSourceCount ? tCount("artifacts.sourceCount", artifact.source_count) : null,
    getRelativeTime(artifact.created_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      className={`art-row ${format?.tone ?? ""}`}
      aria-label={t("artifacts.history.a11yRow", { type: typeLabel, title })}
      onClick={() => onOpen(artifact)}
    >
      <Icon name={format?.icon ?? "sparkles-outline"} size={24} />
      <span className="grow">
        <span className="t">{title}</span>
        <span className="m ell">{meta}</span>
      </span>
      {chevron}
    </button>
  );
}

/**
 * The row of an artifact being generated, at the top of the list. It says what
 * is happening — "Generating…", then the format, the expected wait and that the
 * page can be left — and it moves, in CSS only (`.gen-row` in `styles.css`): an
 * amber sheen crosses it from right to left every 1.8 s and two sparkles
 * twinkle on the format's icon, half a period apart. Under
 * `prefers-reduced-motion` nothing moves and the sparkles stay drawn.
 *
 * It does not open: there is nothing to read yet. A polite live region, so a
 * screen reader hears that a generation started without moving the focus.
 */
export function ArtifactGeneratingRow({ type }: { type: ArtifactType }) {
  const { t } = useI18n();
  const format = artifactFormatOf(type);
  const label = format ? t(format.labelKey) : type;

  return (
    <div className={`gen-row ${format?.tone ?? ""}`} role="status">
      <span className="gen-ico">
        <Icon name={format?.icon ?? "sparkles-outline"} />
        <span className="gen-spark top">
          <Icon name="sparkles" />
        </span>
        <span className="gen-spark bottom">
          <Icon name="sparkles" />
        </span>
      </span>
      <span className="grow">
        <span className="t">{t("artifacts.status.generating")}</span>
        <span className="m">{t("artifacts.row.generatingMeta", { type: label })}</span>
      </span>
    </div>
  );
}
