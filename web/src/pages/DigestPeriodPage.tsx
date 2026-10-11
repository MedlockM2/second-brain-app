import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type { DigestPeriod } from "@media-summarizer/core/types/digest";
import { useCallback, useEffect, useRef } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { MediaCover } from "../components/Covers";
import { Icon } from "../components/Icon";
import { MediaView } from "../components/media/MediaView";
import { useI18n } from "../i18n/I18nProvider";
import { useDigest } from "../media/useDigest";
import { digestReadPath } from "./DigestPage";

/**
 * /digest/:period?i=N — reading a period (capture 05): the media page in three
 * panes (task-477), under a band that replaces the mobile dots with the
 * period's table of contents — clickable, with ‹ ›, the ← → keys and the
 * position "4 / 11". A media deleted from its page leaves the period.
 */
export function DigestPeriodPage() {
  const { period: raw } = useParams();
  const period: DigestPeriod = raw === "weekly" ? "weekly" : "daily";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const digest = useDigest([period]);
  const ids = digest.digests[period];

  const requested = Number.parseInt(params.get("i") ?? "1", 10) - 1;
  const index = ids && ids.length > 0 ? Math.min(Math.max(0, Number.isNaN(requested) ? 0 : requested), ids.length - 1) : 0;

  const go = useCallback(
    (next: number) => {
      if (!ids || next < 0 || next >= ids.length) return;
      navigate(digestReadPath(period, next), { replace: true });
    },
    [ids, navigate, period],
  );

  // ← → move through the period, except while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector(".scrim")) return;
      const rtl = document.documentElement.dir === "rtl";
      if (event.key === "ArrowRight") go(index + (rtl ? -1 : 1));
      else if (event.key === "ArrowLeft") go(index + (rtl ? 1 : -1));
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // Keep the current chip in view as the reading moves.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(".dg-chip.on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index, ids]);

  if (digest.failed) return <Navigate to="/digest" replace />;
  if (!ids) return <main className="page" aria-busy="true" />;
  if (ids.length === 0) return <Navigate to="/digest" replace />;

  const label = t(period === "daily" ? "digest.daily" : "digest.weekly");
  const band = (
    <nav className="dg-band" aria-label={label}>
      <Link to="/digest" className="btn ghost" style={{ minHeight: 32, padding: "0 8px" }}>
        <span className="flip-rtl">
          <Icon name="chevron-back" size={18} />
        </span>
        {t("tabs.digest")}
      </Link>
      <span style={{ fontWeight: 600, fontSize: 14, padding: "0 8px" }}>{label}</span>
      <button type="button" className="icon-btn flip-rtl" aria-label={t("common.back")} disabled={index === 0} onClick={() => go(index - 1)}>
        <Icon name="chevron-back" size={18} />
      </button>
      <div className="dg-strip" ref={strip}>
        {ids.map((id, i) => {
          const row = digest.rows[id];
          return (
            <button
              key={id}
              type="button"
              className={i === index ? "dg-chip on" : "dg-chip"}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
            >
              <span className="dg-n">{i + 1}</span>
              <MediaCover imageUrl={row?.media_image} mediaType={row?.media_type} />
              <span className="ell">{row ? resolveMediaTitle(row) : ""}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="icon-btn flip-rtl"
        aria-label={t("common.continue")}
        disabled={index === ids.length - 1}
        onClick={() => go(index + 1)}
      >
        <Icon name="chevron-forward" size={18} />
      </button>
      <span className="count" style={{ fontWeight: 600, color: "var(--text-main)" }} aria-live="polite">
        {t("digest.position", { current: index + 1, total: ids.length })}
      </span>
    </nav>
  );

  return <MediaView key={ids[index]} mediaId={ids[index]} band={band} onDeleted={() => digest.remove(ids[index])} />;
}
