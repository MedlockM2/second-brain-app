import {
  DEFAULT_COUNT,
  DEFAULT_DIFFICULTY,
  DEFAULT_LENGTH,
  DIFFICULTIES,
  ITEM_COUNTS,
  MAX_FOCUS_CHARS,
  SUMMARY_LENGTHS,
  formatOptionsOf,
  withoutDefaults,
} from "@media-summarizer/core/artifacts/options";
import {
  loadArtifactSources,
  sourceParameters,
  type ArtifactSource,
} from "@media-summarizer/core/artifacts/sources";
import { formatDuration } from "@media-summarizer/core/i18n/duration";
import {
  LOCALE_ENDONYMS,
  SUPPORTED_LOCALES,
} from "@media-summarizer/core/i18n/locales";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { mediaTypeLabelKey } from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "@media-summarizer/core/media/mediaTitle";
import type {
  ArtifactGenerationParameters,
  ArtifactScope,
  Difficulty,
  ItemCount,
  SummaryLength,
} from "@media-summarizer/core/types/artifacts";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api";
import { useI18n } from "../../i18n/I18nProvider";
import { useSession } from "../../session/SessionProvider";
import { Icon } from "../Icon";
import type { ArtifactFormat } from "./artifactFormats";
import { describeArtifactRefusal } from "@media-summarizer/core/artifacts/refusal";

const COPY: Record<string, { title: TranslationKey; hint: TranslationKey }> = {
  summary_short: {
    title: "artifacts.customize.title.summaryShort",
    hint: "artifacts.customize.promptHint.summaryShort",
  },
  notes: {
    title: "artifacts.customize.title.notes",
    hint: "artifacts.customize.promptHint.notes",
  },
  flashcards: {
    title: "artifacts.customize.title.flashcards",
    hint: "artifacts.customize.promptHint.flashcards",
  },
  quiz: {
    title: "artifacts.customize.title.quiz",
    hint: "artifacts.customize.promptHint.quiz",
  },
};
const LENGTH_LABELS: Record<SummaryLength, TranslationKey> = {
  short: "artifacts.customize.length.short",
  medium: "artifacts.customize.length.medium",
  long: "artifacts.customize.length.long",
};
const COUNT_LABELS: Record<ItemCount, TranslationKey> = {
  fewer: "artifacts.customize.count.fewer",
  standard: "artifacts.customize.count.standard",
  more: "artifacts.customize.count.more",
};
const DIFFICULTY_LABELS: Record<Difficulty, TranslationKey> = {
  easy: "artifacts.customize.difficulty.easy",
  medium: "artifacts.customize.difficulty.medium",
  hard: "artifacts.customize.difficulty.hard",
};

/** One form in the AI pane, keeping the chosen values when the API refuses. */
export function CustomizeArtifact({
  scope,
  scopeId,
  format,
  onGenerate,
  onClose,
}: {
  scope: ArtifactScope;
  scopeId: string;
  format: ArtifactFormat;
  onGenerate: (parameters: ArtifactGenerationParameters) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const readingLanguage = user?.reading_language ?? null;
  const [language, setLanguage] = useState(readingLanguage ?? "");
  const [length, setLength] = useState<SummaryLength>(DEFAULT_LENGTH);
  const [count, setCount] = useState<ItemCount>(DEFAULT_COUNT);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [focus, setFocus] = useState("");
  const [sources, setSources] = useState<ArtifactSource[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [sourceError, setSourceError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const busy = useRef(false);
  const sourceList = useRef<HTMLDetailsElement>(null);
  const options = formatOptionsOf(format.type);

  useEffect(() => {
    let cancelled = false;
    loadArtifactSources(scope, scopeId, apiRequest)
      .then((items) => {
        if (cancelled) return;
        setSources(items);
        const ids = new Set(items.map((item) => item.media_item_id));
        setSelected(ids);
        setDraft(ids);
        setSourceError(false);
      })
      .catch(() => {
        if (!cancelled) setSourceError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, scopeId, attempt]);

  const submit = async () => {
    if (busy.current || !sources || !selected.size || sourceError) return;
    busy.current = true;
    setSubmitting(true);
    setRefusal(null);
    const parameters: ArtifactGenerationParameters = {
      focus,
      ...sourceParameters(
        scope,
        sources,
        selected,
        language || null,
        readingLanguage,
      ),
    };
    if (options.includes("length")) parameters.length = length;
    if (options.includes("count")) parameters.count = count;
    if (options.includes("difficulty")) parameters.difficulty = difficulty;
    try {
      await onGenerate(withoutDefaults(parameters));
    } catch (error) {
      setRefusal(describeArtifactRefusal(error, { scope }));
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form
      className={`artifact-customize ${format.tone}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <header className="customize-heading">
        <span className="customize-icon">
          <Icon name={format.icon} size={24} />
        </span>
        <h2 className="headline">{t(COPY[format.type].title)}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("common.close")}
          disabled={submitting}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      {options.includes("length") && (
        <ChoiceGroup
          label={t("artifacts.customize.section.length")}
          choices={SUMMARY_LENGTHS}
          value={length}
          defaultValue={DEFAULT_LENGTH}
          labels={LENGTH_LABELS}
          onChange={setLength}
          disabled={submitting}
        />
      )}
      {options.includes("count") && (
        <ChoiceGroup
          label={t(
            format.type === "quiz"
              ? "artifacts.customize.section.questionCount"
              : "artifacts.customize.section.cardCount",
          )}
          choices={ITEM_COUNTS}
          value={count}
          defaultValue={DEFAULT_COUNT}
          labels={COUNT_LABELS}
          onChange={setCount}
          disabled={submitting}
        />
      )}
      {options.includes("difficulty") && (
        <ChoiceGroup
          label={t("artifacts.customize.section.difficulty")}
          choices={DIFFICULTIES}
          value={difficulty}
          defaultValue={DEFAULT_DIFFICULTY}
          labels={DIFFICULTY_LABELS}
          onChange={setDifficulty}
          disabled={submitting}
        />
      )}
      <section>
        <h3 className="customize-label">{t("artifacts.customize.sources")}</h3>
        {!sources && !sourceError ? (
          <p role="status">{t("common.loading")}</p>
        ) : sourceError ? (
          <div className="section-error" role="alert">
            {t("artifacts.customize.sourcesFailed")}
            <button
              type="button"
              className="btn tonal"
              onClick={() => setAttempt((n) => n + 1)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <details
            ref={sourceList}
            onToggle={(event) => {
              if (event.currentTarget.open) setDraft(new Set(selected));
            }}
          >
            <summary className="customize-source-toggle">
              <Icon name="copy-outline" size={18} />
              {scope === "media" ? 1 : selected.size}
              <span className="grow" />
              <Icon name="chevron-down" size={18} />
            </summary>
            {scope === "folder" && (
              <div className="customize-source-head">
                <span className="small subtle">
                  {t("artifacts.customize.selectedSources", {
                    selected: draft.size,
                    total: sources?.length ?? 0,
                  })}
                </span>
                <button
                  type="button"
                  className="btn tonal"
                  disabled={submitting}
                  onClick={() =>
                    setDraft(
                      new Set(sources?.map((item) => item.media_item_id)),
                    )
                  }
                >
                  {t("artifacts.customize.selectAll")}
                </button>
              </div>
            )}
            <div className="customize-source-list">
              {sources?.map((source) => (
                <label key={source.media_item_id} className="customize-source">
                  <input
                    type="checkbox"
                    checked={draft.has(source.media_item_id)}
                    disabled={scope === "media" || submitting}
                    onChange={() =>
                      setDraft((current) => {
                        const next = new Set(current);
                        if (next.has(source.media_item_id))
                          next.delete(source.media_item_id);
                        else next.add(source.media_item_id);
                        return next;
                      })
                    }
                  />
                  {source.media_image && (
                    <img src={source.media_image} alt="" />
                  )}
                  <span className="grow">
                    <span className="customize-source-title">
                      {resolveMediaTitle(source)}
                    </span>
                    <span className="small subtle">
                      {t(mediaTypeLabelKey(source.media_type))}
                      {source.duration_seconds
                        ? ` · ${formatDuration(source.duration_seconds)}`
                        : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn tonal"
              disabled={!draft.size || submitting}
              onClick={() => {
                setSelected(new Set(draft));
                if (sourceList.current) sourceList.current.open = false;
              }}
            >
              {t("artifacts.customize.confirmSources", { count: draft.size })}
            </button>
          </details>
        )}
      </section>
      <label className="customize-label">
        {t("artifacts.customize.section.prompt")}
        <textarea
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          maxLength={MAX_FOCUS_CHARS}
          placeholder={t(COPY[format.type].hint)}
          disabled={submitting}
          rows={4}
        />
      </label>
      <label className="customize-label">
        {t("artifacts.customize.language")}
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          disabled={submitting}
        >
          {!readingLanguage && (
            <option value="">
              {t("artifacts.customize.defaultOption", {
                label: t("artifacts.customize.language"),
              })}
            </option>
          )}
          {SUPPORTED_LOCALES.map((code) => (
            <option key={code} value={code}>
              {code === readingLanguage
                ? t("artifacts.customize.defaultOption", {
                    label: LOCALE_ENDONYMS[code],
                  })
                : LOCALE_ENDONYMS[code]}
            </option>
          ))}
        </select>
      </label>
      {refusal && (
        <div className="banner-err" role="alert">
          {refusal}
        </div>
      )}
      <button
        type="submit"
        className="btn primary"
        disabled={submitting || !sources || !selected.size || sourceError}
        aria-busy={submitting}
      >
        <Icon name="sparkles-outline" size={18} />
        {t("artifacts.customize.generate")}
      </button>
    </form>
  );
}

function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  defaultValue,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  choices: readonly T[];
  value: T;
  defaultValue: T;
  labels: Record<T, TranslationKey>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="customize-options" disabled={disabled}>
      <legend className="customize-label">{label}</legend>
      <div className="customize-choices">
        {choices.map((choice) => (
          <label
            key={choice}
            className={`customize-choice ${value === choice ? "selected" : ""}`}
          >
            <input
              type="radio"
              name={label}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
            />
            {choice === defaultValue
              ? t("artifacts.customize.defaultOption", {
                  label: t(labels[choice]),
                })
              : t(labels[choice])}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
