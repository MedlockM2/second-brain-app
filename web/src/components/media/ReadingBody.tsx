import { formatDuration } from "@media-summarizer/core/i18n/duration";
import { LOCALE_ENDONYMS, isSupportedLocale } from "@media-summarizer/core/i18n/locales";
import { formatDate, tCount } from "@media-summarizer/core/i18n/runtime";
import { mediaTypeIconName } from "@media-summarizer/core/media/mediaDisplay";
import { resolveSourcePreviewState } from "@media-summarizer/core/media/sourcePreview";
import { languageTag, resolveSourceLink, splitTranscriptParagraphs } from "@media-summarizer/core/media/transcript";
import type { MediaItemContract, SourcePlatform } from "@media-summarizer/core/types/media";
import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { MediaDetailState } from "../../media/useMediaDetail";
import { useTranscript } from "../../media/useTranscript";
import { Icon, type IconName } from "../Icon";
import { ICON_PATHS } from "../icons.generated";

/** A language by its own name ("English"), or its tag when the app does not ship it. */
function describeLanguage(code: string | null | undefined): string | null {
  const primary = code?.trim().split(/[-_]/)[0]?.toLowerCase();
  if (!primary) return null;
  return isSupportedLocale(primary) ? LOCALE_ENDONYMS[primary] : primary.toUpperCase();
}

/** What the job is doing, worded after the platform (the mobile `getProcessingMessage`). */
function processingKey(platform?: SourcePlatform | string) {
  switch (platform) {
    case "spotify":
    case "apple_podcasts":
    case "deezer":
    case "rss":
    case "podcast_index":
      return "media.processing.audio" as const;
    case "youtube":
      return "media.processing.video" as const;
    case "instagram":
    case "tiktok":
    case "x":
      return "media.processing.extracting" as const;
    default:
      return "media.processing.generating" as const;
  }
}

/**
 * The reading pane of a media: the cover band (creator and title on glass), the
 * line of facts (source, date, length, language, paragraphs), then "L'essentiel"
 * and the full text — or, while the media is not readable yet, where it stands.
 */
export function ReadingBody({
  item,
  title,
  state,
  error,
  onRefresh,
}: {
  item: MediaItemContract;
  title: string;
  state: MediaDetailState;
  error: string | null;
  onRefresh: () => void;
}) {
  const { t, tw } = useI18n();
  const ready = state === "completed";
  const transcript = useTranscript(item.media_item_id, ready);
  const { translation, original } = transcript;

  const translated = transcript.state.status === "ready" && translation?.is_translated === true;
  const sourceLanguage = translation?.translated_from ?? translation?.detected_language ?? item.transcript?.language ?? null;
  const targetLanguage = translation?.target_language ?? null;
  const showingOriginal = translated && original.shown;

  const link = resolveSourceLink(item.original_url);
  const created = new Date(item.created_at);
  const languages =
    translated && targetLanguage && sourceLanguage
      ? `${describeLanguage(sourceLanguage)} → ${describeLanguage(targetLanguage)}`
      : describeLanguage(sourceLanguage);
  const facts = [
    Number.isNaN(created.getTime()) ? null : formatDate(created, { day: "numeric", month: "short", year: "numeric" }),
    item.transcript?.duration_seconds ? formatDuration(item.transcript.duration_seconds) : null,
    languages,
  ].filter(Boolean);

  return (
    <>
      <Hero item={item} title={title} />
      <div className="meta-line">
        {link && (
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <Icon name="open-outline" size={14} />
            {link.host}
          </a>
        )}
        {facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
        {item.transcript?.segments_count ? (
          <span style={{ flexBasis: "100%" }}>{tCount("transcript.paragraphCount", item.transcript.segments_count)}</span>
        ) : null}
      </div>

      {state === "processing" && (
        <div className="state-card" role="status">
          <span className="spin" style={{ display: "inline-flex" }}>
            <Icon name="sync-outline" />
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{t(processingKey(item.source_platform))}</div>
            <p className="small subtle">{t("media.processingHint")}</p>
          </div>
        </div>
      )}
      {state === "timeout" && (
        <div className="state-card" role="status">
          <Icon name="time-outline" />
          <div>
            <div style={{ fontWeight: 600 }}>{t("media.timeoutTitle")}</div>
            <p className="small subtle">{tw("media.timeoutHint")}</p>
            <button type="button" className="btn tonal" style={{ marginTop: 12 }} aria-label={t("media.refreshA11y")} onClick={onRefresh}>
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}
      {state === "failed" && (
        <div className="state-card" role="alert">
          <Icon name="alert-circle-outline" />
          <div>
            <div style={{ fontWeight: 600 }}>{t("media.failedTitle")}</div>
            <p className="small subtle">{error ?? t("media.failedFallback")}</p>
          </div>
        </div>
      )}

      {ready && (
        <>
          <Essentials item={item} />
          <section className="reader" aria-label={t("transcript.heading")}>
            <div className="reader-head">
              <h2 className="headline grow">{t("transcript.heading")}</h2>
              {translated && (
                <OriginalToggle
                  showingOriginal={showingOriginal}
                  language={showingOriginal ? targetLanguage : sourceLanguage}
                  busy={original.loading}
                  onToggle={() => void transcript.toggleOriginal()}
                />
              )}
            </div>
            {original.failed && (
              <div className="banner-err" role="alert" style={{ marginBottom: 12 }}>
                {t("transcript.originalLoadFailed")}
              </div>
            )}
            <TranscriptText state={transcript.state} originalText={showingOriginal ? original.content : null} onRetry={transcript.retry} />
          </section>
        </>
      )}
    </>
  );
}

function Hero({ item, title }: { item: MediaItemContract; title: string }) {
  const [broken, setBroken] = useState(false);
  const glyph = mediaTypeIconName(item.media_type);
  return (
    <div className="hero">
      {item.media_image && !broken ? (
        <img src={item.media_image} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="hero-glyph">
          <Icon name={glyph in ICON_PATHS ? (glyph as IconName) : "link-outline"} />
        </span>
      )}
      <div className="veil">
        {item.creator_name && <div className="small subtle ell">{item.creator_name}</div>}
        <h1 className="headline clamp2">{title}</h1>
      </div>
    </div>
  );
}

/** "L'essentiel": the hook and points of the review blurb, or where it stands. */
function Essentials({ item }: { item: MediaItemContract }) {
  const { t } = useI18n();
  const preview = resolveSourcePreviewState(item);
  return (
    <aside className="callout" aria-label={t("preview.essentials")}>
      <div className="caps">{t("preview.essentials")}</div>
      {preview.status === "ready" ? (
        <>
          <p>{preview.hook}</p>
          {preview.points.length > 0 && (
            <ul className="bullets">
              {preview.points.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="small subtle">{t(preview.status === "pending" ? "preview.pending" : "preview.unavailable")}</p>
      )}
    </aside>
  );
}

function OriginalToggle({
  showingOriginal,
  language,
  busy,
  onToggle,
}: {
  showingOriginal: boolean;
  language: string | null;
  busy: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const code = languageTag(language);
  const name = describeLanguage(language);
  if (!code || !name) return null;
  return (
    <button
      type="button"
      className="chip-btn"
      disabled={busy}
      aria-label={t(showingOriginal ? "transcript.viewTranslationA11y" : "transcript.viewOriginalA11y", { language: name })}
      onClick={onToggle}
    >
      <Icon name="language-outline" size={14} />
      {t(showingOriginal ? "transcript.viewTranslation" : "transcript.viewOriginal", { language: code })}
    </button>
  );
}

function TranscriptText({
  state,
  originalText,
  onRetry,
}: {
  state: ReturnType<typeof useTranscript>["state"];
  originalText: string | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (state.status === "loading") return <p className="small muted">{t("transcript.loading")}</p>;
  if (state.status === "not_available") return <p className="small muted">{t("transcript.notAvailable")}</p>;
  if (state.status === "error") {
    return (
      <div className="section-error" role="alert">
        <span className="subtle">{state.message}</span>
        <button type="button" className="btn tonal" aria-label={t("transcript.retryA11y")} onClick={onRetry}>
          {t("common.retry")}
        </button>
      </div>
    );
  }
  const notice =
    state.status === "translation_pending"
      ? t("transcript.translating")
      : state.status === "translation_stalled"
        ? t("transcript.translationStalled")
        : state.status === "translation_failed"
          ? t("transcript.translationFailed")
          : null;
  const paragraphs = splitTranscriptParagraphs(originalText ?? state.content);
  return (
    <>
      {notice && (
        <p className="small subtle" role="status">
          {notice}
        </p>
      )}
      {paragraphs.map((paragraph, i) => (
        <p key={i}>
          <span className="pn">§{i + 1}</span>
          {paragraph.speaker && <span className="speaker">{paragraph.speaker}: </span>}
          {paragraph.text}
        </p>
      ))}
    </>
  );
}
