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
  type FlashcardAction,
  type FlashcardSession,
  flashcardSessionReducer,
  isFlashcardRoundOver,
  startFlashcardSession,
} from "@media-summarizer/core/artifacts/flashcardSession";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import { msg } from "../../lib/i18n";
import { icon, type IconName } from "../../lib/icons";
import { el, note } from "./dom";

/**
 * One notebook entry, drawn in the panel the way the app draws it (the web
 * `ArtifactBody`): a summary and learning notes to read, flashcards to revise
 * one at a time (direction B of `mobile-design-mockups/flashcards_ux`), a quiz
 * question by question. The readers are the shared ones of `core/artifacts`.
 */
export interface ArtifactFormat { type: ArtifactType; label: string; icon: IconName; tone: string }

/** The four formats of the notebook, in the order of the app's grid. */
export const FORMATS: readonly ArtifactFormat[] = [
  { type: "summary_short", label: "typeSummary", icon: "document-text-outline", tone: "f-summary" },
  { type: "notes", label: "typeNotes", icon: "book-outline", tone: "f-notes" },
  { type: "flashcards", label: "typeFlashcards", icon: "copy-outline", tone: "f-flashcards" },
  { type: "quiz", label: "typeQuiz", icon: "help-circle-outline", tone: "f-quiz" },
];

/** A format by type; the old unscoped `summary` reads as a summary. */
export function formatOf(type: ArtifactType): ArtifactFormat {
  return FORMATS.find((format) => format.type === (type === "summary" ? "summary_short" : type)) ?? FORMATS[0];
}

/** The model-written title of an entry's content, if it wrote one. */
export function contentTitle(payload: unknown): string | null {
  return pickString(artifactContent(payload), ["title"]);
}

export function drawArtifactBody(type: ArtifactType, payload: unknown, onFinish: () => void): HTMLElement {
  const content = artifactContent(payload);
  switch (normalizeArtifactKind(type)) {
    case "summary_short":
    case "summary":
      return summary(content);
    case "notes":
      return notes(content);
    case "flashcards":
      return flashcards(pickFlashcardArray(content));
    default:
      return quiz(pickQuizQuestions(content), onFinish);
  }
}

const section = (title: string | null, ...children: Node[]) =>
  el("section", { className: "art-sec" }, title ? el("h3", { text: title }) : null, ...children);
const bullets = (items: string[]) => el("ul", { className: "bullets" }, ...items.map((item) => el("li", { text: item })));

function summary(content: Record<string, unknown>): HTMLElement {
  const keyPoints = pickStringArray(content, ["key_points"]);
  const takeaway = pickString(content, ["takeaway"]);
  return el("div", {},
    keyPoints && section(msg("sectionKeyPoints"), bullets(keyPoints)),
    takeaway && section(msg("sectionTakeaway"), el("div", { className: "callout", text: takeaway })));
}

function notes(content: Record<string, unknown>): HTMLElement {
  const context = pickString(content, ["context"]);
  const objectives = pickStringArray(content, ["objectives"]);
  const concepts = pickConceptArray(content);
  const keyPoints = pickStringArray(content, ["key_points"]);
  const quotes = pickQuotes(content, ["notable_quotes"]);
  const actionItems = pickStringArray(content, ["action_items"]);
  const glossary = pickGlossaryArray(content);
  return el("div", {},
    context && section(null, el("p", { text: context })),
    objectives && section(msg("sectionObjectives"), bullets(objectives)),
    concepts && section(msg("sectionConcepts"), ...concepts.map((concept) => {
      const core = concept.importance?.toLowerCase() === "core";
      return el("div", { className: "art-card" },
        el("div", { className: "term" }, concept.term,
          concept.importance ? el("span", { className: core ? "importance core" : "importance", text: msg(core ? "importanceCore" : "importanceSupporting").toUpperCase() }) : null),
        el("div", { text: concept.explanation }));
    })),
    keyPoints && section(msg("sectionKeyPoints"), bullets(keyPoints)),
    quotes && section(msg("sectionQuotes"), ...quotes.map((quote) =>
      el("blockquote", { className: "quote" }, quote.text, quote.sourceRef ? el("span", { className: "muted", text: ` — ${quote.sourceRef}` }) : null))),
    actionItems && section(msg("sectionActionItems"), bullets(actionItems)),
    glossary && section(msg("sectionGlossary"), el("dl", { className: "glossary" },
      ...glossary.flatMap((entry) => [el("dt", { text: entry.term }), el("dd", { text: entry.definition })]))));
}

const progress = (label: string, ratio: number, extra: Node | null = null) => el("div", { className: "prog" },
  el("div", { className: "prog-row" }, el("span", { text: label }), extra),
  el("div", { className: "track", attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(ratio * 100)) } },
    el("i", { attrs: { style: `width:${Math.round(ratio * 100)}%` } })));

const position = (key: string, index: number, total: number) =>
  msg(key).replace("{index}", String(index)).replace("{total}", String(total));

function flashcards(cards: Flashcard[] | null): HTMLElement {
  const root = el("div", { className: "flash" });
  if (!cards) return el("div", {}, note(msg("noFlashcards")));
  let session: FlashcardSession = startFlashcardSession(cards.length);
  const act = (action: FlashcardAction) => { session = flashcardSessionReducer(session, action); draw(); };

  function draw(): void {
    if (isFlashcardRoundOver(session)) {
      const total = session.order.length;
      const known = session.known.length;
      const again = session.again.length;
      const buttons: HTMLElement[] = [];
      if (again > 0) {
        const review = el("button", { className: "btn primary", attrs: { type: "button" } }, icon("refresh-outline", 17), msg("flashReviewMissed"));
        review.onclick = () => act({ type: "reviewMissed" });
        buttons.push(review);
      }
      const restart = el("button", { className: again > 0 ? "btn" : "btn primary", attrs: { type: "button" }, text: msg("flashRestart") });
      restart.onclick = () => act({ type: "restart", cardCount: cards!.length });
      buttons.push(restart);
      root.replaceChildren(el("div", { className: "done" },
        el("div", { className: "score" }, el("b", { text: String(known) }), el("span", { text: msg("flashScoreTotal").replace("{total}", String(total)) })),
        el("h3", { text: msg("flashDoneTitle") }),
        el("p", { className: "muted", text: msg(again > 0 ? "flashDoneSome" : "flashDoneAll") }),
        ...buttons));
      return;
    }
    const card = cards![session.order[session.position]];
    const tally = el("span", { className: "tally" },
      el("span", { className: "ok" }, icon("checkmark", 12), String(session.known.length)),
      el("span", { className: "again" }, icon("refresh-outline", 12), String(session.again.length)));
    const face = session.revealed
      ? el("div", { className: "card back" }, el("div", { className: "q-small", text: card.question }), el("i", { className: "rule" }),
        el("div", { className: "kq", text: msg("artifactAnswer") }), el("div", { className: "ca", text: card.answer }))
      : el("div", { className: "card" }, el("div", { className: "kq", text: msg("artifactQuestion") }), el("div", { className: "cq", text: card.question }));
    let actions: HTMLElement;
    if (session.revealed) {
      const again = el("button", { className: "btn again", attrs: { type: "button" } }, icon("refresh-outline", 16), msg("flashAgain"));
      const known = el("button", { className: "btn known", attrs: { type: "button" } }, icon("checkmark", 16), msg("flashKnown"));
      again.onclick = () => act({ type: "rate", rating: "again" });
      known.onclick = () => act({ type: "rate", rating: "known" });
      actions = el("div", { className: "pair" }, again, known);
    } else {
      actions = el("button", { className: "btn primary", attrs: { type: "button" } }, icon("eye-outline", 17), msg("flashReveal"));
      actions.onclick = () => act({ type: "reveal" });
    }
    root.replaceChildren(
      progress(position("cardPosition", session.position + 1, session.order.length), session.position / session.order.length, tally),
      el("div", { className: "deck" }, el("span", { className: "edge e2" }), el("span", { className: "edge e1" }), face),
      actions);
    (actions instanceof HTMLButtonElement ? actions : actions.lastElementChild as HTMLElement)?.focus({ preventScroll: true });
  }
  draw();
  return root;
}

/** One question at a time; the last "Done" hands the reader back to the notebook, as in the app. */
function quiz(questions: QuizQuestion[] | null, onFinish: () => void): HTMLElement {
  const root = el("div", { className: "quiz" });
  if (!questions) return el("div", {}, note(msg("noQuestions")));
  let index = 0;
  let picked: string | null = null;

  function draw(): void {
    const question = questions![index];
    const last = index === questions!.length - 1;
    const options = question.options.map((option) => {
      const correct = option.label.toUpperCase() === question.correct_answer;
      const state = picked !== null && correct ? "right" : picked !== null && picked === option.label ? "wrong" : "";
      const button = el("button", { className: `opt ${state}`.trim(), attrs: { type: "button", "aria-pressed": String(picked === option.label) } },
        el("b", { text: option.label }), el("span", { className: "grow", text: option.text }),
        state === "right" ? icon("checkmark-circle", 18) : state === "wrong" ? icon("close-circle", 18) : null);
      button.disabled = picked !== null;
      button.onclick = () => { picked = option.label; draw(); };
      return button;
    });
    const nodes: Node[] = [
      progress(position("questionPosition", index + 1, questions!.length), (index + 1) / questions!.length),
      el("p", { className: "qq", text: question.question }),
      el("div", { className: "opts" }, ...options),
    ];
    if (picked !== null) {
      nodes.push(el("div", { className: "callout" }, el("div", { className: "lab", text: msg("artifactExplanation") }), question.explanation));
      const next = el("button", { className: "btn primary", attrs: { type: "button" } }, msg(last ? "done" : "continue"), last ? null : icon("arrow-forward", 17, "flip-rtl"));
      next.onclick = () => {
        if (last) return onFinish();
        index += 1;
        picked = null;
        draw();
      };
      nodes.push(next);
    }
    root.replaceChildren(...nodes);
  }
  draw();
  return root;
}
