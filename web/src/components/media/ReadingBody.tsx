import { hasStructuredMarkdown } from "@media-summarizer/core/chat/markdown";
import { LOCALE_ENDONYMS, isSupportedLocale } from "@media-summarizer/core/i18n/locales";
import { mediaProcessingLabelKey, mediaTypeIconName } from "@media-summarizer/core/media/mediaDisplay";
import { resolveSourcePreviewState } from "@media-summarizer/core/media/sourcePreview";
import { languageTag, resolveSourceLink, splitArticleText, splitTranscriptParagraphs } from "@media-summarizer/core/media/transcript";
import {
  formatSectionClock,
  parseTranscriptSections,
  type TranscriptSection,
} from "@media-summarizer/core/media/transcriptSections";
import type { MediaItemContract } from "@media-summarizer/core/types/media";
import { useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { MediaDetailState } from "../../media/useMediaDetail";
import { useSearchPassage } from "../../media/useSearchPassage";
import { useTranscript } from "../../media/useTranscript";
import { Icon, type IconName } from "../Icon";
import { ICON_PATHS } from "../icons.generated";
import { MarkdownView } from "../MarkdownView";

/** A language by its own name ("English"), or its tag when the app does not ship it. */
function describeLanguage(code: string | null | undefined): string | null {
  const primary = code?.trim().split(/[-_]/)[0]?.toLowerCase();
  if (!primary) return null;
  return isSupportedLocale(primary) ? LOCALE_ENDONYMS[primary] : primary.toUpperCase();
}

/**
 * The reading pane of a media: the cover band (creator and title on glass), then
 * "L'essentiel" and the full text — or, while the media is not readable yet, where it stands.
 *
 * Opened from a search result, the full text opens on the passage the result
 * quoted (`passage`, see `useSearchPassage`).
 */
export function ReadingBody({
  item,
  title,
  state,
  error,
  onRefresh,
  passage,
}: {
  item: MediaItemContract;
  title: string;
  state: MediaDetailState;
  error: string | null;
  onRefresh: () => void;
  /** The excerpt of the search result the page was opened from (`searchPassageFromSnippet`). */
  passage: string | null;
}) {
  const { t, tw } = useI18n();
  const ready = state === "completed";
  const transcript = useTranscript(item.media_item_id, ready);
  const { translation, original } = transcript;

  const translated = transcript.state.status === "ready" && translation?.is_translated === true;
  const sourceLanguage = translation?.translated_from ?? translation?.detected_language ?? item.transcript?.language ?? null;
  const targetLanguage = translation?.target_language ?? null;
  const showingOriginal = translated && original.shown;

  // The body on screen, as `TranscriptText` picks it.
  const shownText = !ready
    ? null
    : showingOriginal && original.content
      ? original.content
      : "content" in transcript.state
        ? transcript.state.content
        : null;
  const reader = useRef<HTMLElement>(null);
  useSearchPassage(reader, passage, shownText);

  const link = resolveSourceLink(item.original_url);

  return (
    <>
      <Hero item={item} title={title} link={link} />

      {state === "processing" && (
        <div className="state-card" role="status">
          <span className="spin" style={{ display: "inline-flex" }}>
            <Icon name="sync-outline" />
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{t(mediaProcessingLabelKey(item.media_type))}</div>
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
          <section ref={reader} className="reader" aria-label={t("transcript.heading")}>
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
            <TranscriptText
              state={transcript.state}
              originalText={showingOriginal ? original.content : null}
              onRetry={transcript.retry}
              sourceUrl={link?.url ?? null}
            />
          </section>
        </>
      )}
    </>
  );
}

/**
 * The cover with its band. The title opens the original when the media has one
 * a browser can open (task-512), and says so with its icon; no false link
 * otherwise. The band lets more of the image through than it used to.
 */
function Hero({ item, title, link }: { item: MediaItemContract; title: string; link: { url: string; host: string } | null }) {
  const { t } = useI18n();
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
        {link ? (
          <h1 className="headline">
            <a
              className="hero-link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.host}
              aria-label={`${title}. ${t("media.openSourceA11y", { host: link.host })}`}
            >
              <span className="clamp2">{title}</span>
              <Icon name="open-outline" size={18} />
            </a>
          </h1>
        ) : (
          <h1 className="headline clamp2">{title}</h1>
        )}
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
  sourceUrl,
}: {
  state: ReturnType<typeof useTranscript>["state"];
  originalText: string | null;
  onRetry: () => void;
  sourceUrl: string | null;
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
  const content = originalText ?? state.content;
  const sections = parseTranscriptSections(content);
  return (
    <>
      {notice && (
        <p className="small subtle" role="status">
          {notice}
        </p>
      )}
      {sections ? <SectionedText sections={sections} sourceUrl={sourceUrl} /> : <TextBody content={content} sourceUrl={sourceUrl} />}
    </>
  );
}

/** Prose keeps its numbered paragraphs and speakers; a structured extraction
 * (tables, headings, lists) is drawn by the shared Markdown reader (task-513).
 * A web article's standfirst opens it one size up, and an article whose page
 * reserves the rest ends on a notice saying so (`splitArticleText`). */
function TextBody({ content, sourceUrl }: { content: string; sourceUrl: string | null }) {
  const article = splitArticleText(content);
  const structured = hasStructuredMarkdown(article.body);
  const paragraphs = structured ? [] : splitTranscriptParagraphs(article.body);
  return (
    <>
      {article.lead && <p className="lead">{article.lead}</p>}
      {structured && <MarkdownView text={article.body} transcript />}
      {paragraphs.map((paragraph, i) => (
        <p key={i}>
          <span className="pn">§{i + 1}</span>
          {paragraph.speaker && <span className="speaker">{paragraph.speaker}: </span>}
          {paragraph.text}
        </p>
      ))}
      {article.incomplete && <IncompleteNotice sourceUrl={sourceUrl} />}
    </>
  );
}

/** The end of an article whose page reserves the rest to its subscribers. */
function IncompleteNotice({ sourceUrl }: { sourceUrl: string | null }) {
  const { t } = useI18n();
  return (
    <aside className="incomplete">
      <Icon name="lock-closed-outline" size={18} />
      <div>
        <div className="incomplete-title">{t("transcript.incomplete.title")}</div>
        <p>{t("transcript.incomplete.body")}</p>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="open-outline" size={14} />
            {t("transcript.incomplete.open")}
          </a>
        )}
      </div>
    </aside>
  );
}

const PROVIDER_NAMES: Record<string, string> = {
  vimeo: "Vimeo",
  youtube: "YouTube",
  dailymotion: "Dailymotion",
  wistia: "Wistia",
  loom: "Loom",
};

/**
 * A web page read with the videos it embeds (`parseTranscriptSections`), the
 * web side of the mobile `SectionedTranscript`: chips naming what the page holds
 * and jumping to it, then each part under its own heading -- the page's text,
 * then each video with its thumbnail, title and length.
 */
function SectionedText({ sections, sourceUrl }: { sections: TranscriptSection[]; sourceUrl: string | null }) {
  const { t } = useI18n();
  const nodes = useRef<(HTMLElement | null)[]>([]);
  return (
    <>
      <div className="section-chips">
        {sections.map((section, i) => {
          const label =
            section.kind === "page"
              ? t("transcript.section.pageChip")
              : [t("transcript.section.videoChip", { index: section.index }), formatSectionClock(section.durationSeconds)]
                  .filter(Boolean)
                  .join(" · ");
          return (
            <button
              key={i}
              type="button"
              className="chip-btn"
              aria-label={t("transcript.section.jumpA11y", { label })}
              onClick={() => nodes.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Icon name={section.kind === "page" ? "document-text-outline" : "play"} size={14} />
              {label}
            </button>
          );
        })}
      </div>
      {sections.map((section, i) => {
        const meta =
          section.kind === "video"
            ? [formatSectionClock(section.durationSeconds), section.provider ? PROVIDER_NAMES[section.provider] : null]
                .filter(Boolean)
                .join(" · ")
            : "";
        return (
          <section
            key={i}
            className="text-section"
            ref={(node) => {
              nodes.current[i] = node;
            }}
          >
            <h3 className="text-section-kicker">
              <Icon name={section.kind === "page" ? "document-text-outline" : "play"} size={14} />
              {section.kind === "page"
                ? t("transcript.section.page")
                : t("transcript.section.video", { index: section.index, count: section.count })}
              <span className="rule" aria-hidden="true" />
            </h3>
            {section.kind === "video" && (
              <div className="text-section-video">
                <span className="thumb" aria-hidden="true">
                  {section.thumbnailUrl && <img src={section.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <span className="play">
                    <Icon name="play" size={14} />
                  </span>
                </span>
                <span className="text-section-video-text">
                  {section.title && <span className="title">{section.title}</span>}
                  {meta && <span className="meta">{meta}</span>}
                </span>
              </div>
            )}
            <TextBody content={section.body} sourceUrl={sourceUrl} />
          </section>
        );
      })}
    </>
  );
}
