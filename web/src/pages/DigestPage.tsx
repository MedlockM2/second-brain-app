import { tCount } from "@media-summarizer/core/i18n/runtime";
import { mediaTypeIconName, mediaTypeLabelKey } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type { DigestPeriod } from "@media-summarizer/core/types/digest";
import { useState } from "react";
import { Link } from "react-router";
import { MediaCover } from "../components/Covers";
import { Icon, type IconName } from "../components/Icon";
import { ICON_PATHS } from "../components/icons.generated";
import { useI18n } from "../i18n/I18nProvider";
import { useDigest, type DigestRow } from "../media/useDigest";

/**
 * The Digest, adapted to the desktop (owner's mockup, capture 04): both periods
 * fit on one screen, so choosing one shows its content. Daily and Weekly are two
 * columns, each with the pile of its first three covers, its count, "Read" and
 * its full table of contents; every line opens the reading at that media.
 */
const PERIODS: readonly DigestPeriod[] = ["daily", "weekly"];

export const digestReadPath = (period: DigestPeriod, index = 0) => `/digest/${period}?i=${index + 1}`;

export function DigestPage() {
  const { t, tw } = useI18n();
  const digest = useDigest(PERIODS);

  if (digest.failed) {
    return (
      <main className="page">
        <div className="section-error" role="alert">
          <span className="subtle">{t("digest.loadFailed")}</span>
          <button type="button" className="btn tonal" onClick={digest.retry}>
            {t("digest.tryAgain")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="dg-wrap">
      <h1 className="visually-hidden">{t("tabs.digest")}</h1>
      <div className="dg">
        {PERIODS.map((period) => {
          const ids = digest.digests[period];
          const label = t(period === "daily" ? "digest.daily" : "digest.weekly");
          return (
            <section key={period} className="dg-col" aria-label={label}>
              <header className="dg-head">
                <Pile rows={(ids ?? []).slice(0, 3).map((id) => digest.rows[id])} />
                <div className="grow">
                  <h2 className="headline">{label}</h2>
                  {ids && (
                    <div className="small muted">
                      {tCount("digest.mediaCount", ids.length)} · {tw(period === "daily" ? "digest.dailySubtitle" : "digest.weeklySubtitle")}
                    </div>
                  )}
                </div>
                {ids && ids.length > 0 && (
                  <Link to={digestReadPath(period)} className="btn primary">
                    <Icon name="book-outline" size={18} />
                    {tw("digest.read")}
                  </Link>
                )}
              </header>
              {ids && ids.length === 0 ? (
                <div className="pane-empty">
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                    {t(period === "daily" ? "digest.emptyDaily" : "digest.emptyWeekly")}
                  </div>
                  <p>{t(period === "daily" ? "digest.emptyDailyHint" : "digest.emptyWeeklyHint")}</p>
                </div>
              ) : (
                <ol className="dg-list">
                  {(ids ?? []).map((id, index) => (
                    <li key={id}>
                      <DigestLine
                        row={digest.rows[id]}
                        index={index}
                        to={digestReadPath(period, index)}
                        a11y={tw("digest.openA11y", { period: label, index: index + 1 })}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

/** The first three covers of a period, stacked like the mobile `DigestCoverStack`. */
function Pile({ rows }: { rows: (DigestRow | undefined)[] }) {
  return (
    <div className="dg-pile" aria-hidden="true">
      {[2, 1, 0].map((depth) => {
        const row = rows[depth];
        if (!row) return null;
        return (
          <div key={depth} className={`dg-card c${depth}`}>
            <CoverOrGlyph row={row} />
          </div>
        );
      })}
    </div>
  );
}

function CoverOrGlyph({ row }: { row: DigestRow }) {
  const [broken, setBroken] = useState(false);
  if (row.media_image && !broken) return <img src={row.media_image} alt="" onError={() => setBroken(true)} />;
  const glyph = mediaTypeIconName(row.media_type);
  return <Icon name={glyph in ICON_PATHS ? (glyph as IconName) : "link-outline"} />;
}

/** One line of a period's table of contents: n°, cover, type, creator, title, start of "L'essentiel". */
function DigestLine({ row, index, to, a11y }: { row: DigestRow | undefined; index: number; to: string; a11y: string }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="dg-row" aria-label={a11y}>
      <span className="dg-n">{index + 1}</span>
      <MediaCover imageUrl={row?.media_image} mediaType={row?.media_type} />
      <span className="grow">
        {row && (
          <>
            <span className="meta">
              <span className="badge">{t(mediaTypeLabelKey(row.media_type))}</span>
              {row.creator_name && <span className="ell">{row.creator_name}</span>}
            </span>
            <span className="t clamp2">{resolveMediaTitle(row)}</span>
            {row.review_blurb?.hook && <span className="small subtle clamp2">{row.review_blurb.hook}</span>}
          </>
        )}
      </span>
    </Link>
  );
}
