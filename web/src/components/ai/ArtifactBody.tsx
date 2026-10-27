import {
  artifactContent,
  normalizeArtifactKind,
  pickConceptArray,
  pickFlashcardArray,
  pickGlossaryArray,
  pickQuizQuestions,
  pickQuotes,
  pickString,
  pickStringArray,
  type Flashcard,
  type QuizQuestion,
} from "@media-summarizer/core/artifacts/content";
import {
  artifactTranslator,
  type ArtifactTranslator,
} from "@media-summarizer/core/artifacts/i18n";
import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon } from "../Icon";

/**
 * The body of a generated artifact, one layout per type — the same sections as
 * the mobile artifact screen (`app/artifacts/[artifactId].tsx`), laid out for
 * the widened AI pane. `payload` is the envelope `GET /api/artifacts/:id/content`
 * returns; anything the model wrote that does not fit is dropped, not shown raw.
 */
export function ArtifactBody({
  type,
  payload,
  language,
  onFinish,
}: {
  type: string;
  payload: unknown;
  language: string | null;
  onFinish: () => void;
}) {
  const content = artifactContent(payload);
  const labels = artifactTranslator(language);
  switch (normalizeArtifactKind(type)) {
    case "summary_short":
    case "summary":
      return <SummaryShort content={content} labels={labels} />;
    case "notes":
      return <Notes content={content} labels={labels} />;
    case "flashcards":
      return <Flashcards cards={pickFlashcardArray(content)} labels={labels} />;
    default:
      return (
        <Quiz
          questions={pickQuizQuestions(content)}
          labels={labels}
          onFinish={onFinish}
        />
      );
  }
}

/** The model-written title of an artifact's content, if it wrote one. */
export function artifactContentTitle(payload: unknown): string | null {
  return pickString(artifactContent(payload), ["title"]);
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="art-section">
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="bullets">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function SummaryShort({
  content,
  labels,
}: {
  content: Record<string, unknown>;
  labels: ArtifactTranslator;
}) {
  const keyPoints = pickStringArray(content, ["key_points"]);
  const takeaway = pickString(content, ["takeaway"]);
  return (
    <>
      {keyPoints && (
        <Section title={labels.t("artifact.section.keyPoints")}>
          <Bullets items={keyPoints} />
        </Section>
      )}
      {takeaway && (
        <Section title={labels.t("artifact.section.takeaway")}>
          <div className="callout" style={{ marginBottom: 0 }}>
            <p style={{ marginTop: 0 }}>{takeaway}</p>
          </div>
        </Section>
      )}
    </>
  );
}

function Notes({
  content,
  labels,
}: {
  content: Record<string, unknown>;
  labels: ArtifactTranslator;
}) {
  // An introduction (who, what, why): it reads first, under the title, with no
  // section title of its own.
  const context = pickString(content, ["context"]);
  const objectives = pickStringArray(content, ["objectives"]);
  const concepts = pickConceptArray(content);
  const keyPoints = pickStringArray(content, ["key_points"]);
  // Verbatim, so each carries the corpus tag it came from, shown after it.
  const quotes = pickQuotes(content, ["notable_quotes"]);
  const actionItems = pickStringArray(content, ["action_items"]);
  const glossary = pickGlossaryArray(content);
  return (
    <>
      {context && (
        <Section>
          <p>{context}</p>
        </Section>
      )}
      {objectives && (
        <Section title={labels.t("artifact.section.objectives")}>
          <Bullets items={objectives} />
        </Section>
      )}
      {concepts && (
        <Section title={labels.t("artifact.section.concepts")}>
          {concepts.map((concept, i) => (
            <div key={i} className="art-card">
              <div className="q" style={{ marginTop: 0 }}>
                {concept.term}
                {concept.importance && (
                  <span
                    className={
                      concept.importance.toLowerCase() === "core"
                        ? "importance core"
                        : "importance"
                    }
                  >
                    {labels
                      .t(
                        concept.importance.toLowerCase() === "core"
                          ? "artifact.importance.core"
                          : "artifact.importance.supporting",
                      )
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div>{concept.explanation}</div>
            </div>
          ))}
        </Section>
      )}
      {keyPoints && (
        <Section title={labels.t("artifact.section.keyPoints")}>
          <Bullets items={keyPoints} />
        </Section>
      )}
      {quotes && (
        <Section title={labels.t("artifact.section.quotes")}>
          {quotes.map((quote, i) => (
            <blockquote key={i} className="quote">
              {quote.text}
              {quote.sourceRef && (
                <span className="small muted"> — {quote.sourceRef}</span>
              )}
            </blockquote>
          ))}
        </Section>
      )}
      {actionItems && (
        <Section title={labels.t("artifact.section.actionItems")}>
          <ul
            className="bullets"
            style={{ listStyle: "none", paddingInlineStart: 0 }}
          >
            {actionItems.map((item, i) => (
              <li key={i} className="row" style={{ alignItems: "flex-start" }}>
                <Icon name="checkmark-circle" size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {glossary && (
        <Section title={labels.t("artifact.section.glossary")}>
          <dl style={{ margin: 0 }}>
            {glossary.map((entry, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <dt style={{ fontWeight: 600 }}>{entry.term}</dt>
                <dd style={{ margin: 0 }} className="subtle">
                  {entry.definition}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </>
  );
}

function Flashcards({
  cards,
  labels,
}: {
  cards: Flashcard[] | null;
  labels: ArtifactTranslator;
}) {
  const { t } = useI18n();
  if (!cards) return <p className="subtle">{t("artifact.noFlashcards")}</p>;
  return (
    <Section title={labels.tCount("artifact.cardCount", cards.length)}>
      {cards.map((card, i) => (
        <FlashcardCard key={i} card={card} labels={labels} />
      ))}
    </Section>
  );
}

function FlashcardCard({
  card,
  labels,
}: {
  card: Flashcard;
  labels: ArtifactTranslator;
}) {
  const { t, tw } = useI18n();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="art-card">
      <div className="caps">{labels.t("artifact.question")}</div>
      <div className="q">{card.question}</div>
      {revealed ? (
        <>
          <div className="caps" style={{ marginTop: 12 }}>
            {labels.t("artifact.answer")}
          </div>
          <div>{card.answer}</div>
          <button
            type="button"
            className="chip-btn"
            style={{ marginTop: 12 }}
            onClick={() => setRevealed(false)}
          >
            <Icon name="eye-off-outline" size={14} />
            {t("artifact.hideAnswer")}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="chip-btn"
          onClick={() => setRevealed(true)}
        >
          <Icon name="eye-outline" size={14} />
          {tw("artifact.showAnswer")}
        </button>
      )}
    </div>
  );
}

/**
 * One question at a time. The quiz records nothing on completion, so the last
 * "Done" closes it and hands the reader back to the history (the mobile does the
 * same since 8c3bdfee): no terminal state that reads like a button.
 */
function Quiz({
  questions,
  labels,
  onFinish,
}: {
  questions: QuizQuestion[] | null;
  labels: ArtifactTranslator;
  onFinish: () => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  if (!questions) return <p className="subtle">{t("artifact.noQuestions")}</p>;

  const question = questions[index];
  const last = index === questions.length - 1;
  const answered = picked !== null;
  const next = () => {
    if (last) {
      onFinish();
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  return (
    <div>
      <div className="small muted">
        {labels.t("artifact.questionPosition", {
          index: index + 1,
          total: questions.length,
        })}
      </div>
      <div
        className="quiz-progress"
        role="progressbar"
        aria-label={t("artifact.quizProgress")}
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-valuenow={index + 1}
      >
        <i style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="art-card">
        <div className="q" style={{ marginTop: 0 }}>
          {question.question}
        </div>
        {question.options.map((option) => {
          const correct =
            option.label.toUpperCase() === question.correct_answer;
          const state =
            answered && correct
              ? "right"
              : answered && picked === option.label
                ? "wrong"
                : "";
          return (
            <button
              key={option.label}
              type="button"
              className={`option ${state}`}
              disabled={answered}
              aria-pressed={picked === option.label}
              onClick={() => setPicked(option.label)}
            >
              <span className="lbl">{option.label}</span>
              <span className="grow">{option.text}</span>
              {state === "right" && <Icon name="checkmark-circle" size={18} />}
              {state === "wrong" && <Icon name="close-circle" size={18} />}
            </button>
          );
        })}
        {answered && (
          <div style={{ marginTop: 8 }}>
            <div className="caps">{labels.t("artifact.explanation")}</div>
            <p style={{ margin: "4px 0 0" }}>{question.explanation}</p>
          </div>
        )}
      </div>
      {answered && (
        <button type="button" className="btn primary" onClick={next}>
          {last ? t("common.done") : t("common.continue")}
          {!last && (
            <span className="flip-rtl">
              <Icon name="arrow-forward" size={18} />
            </span>
          )}
        </button>
      )}
    </div>
  );
}
