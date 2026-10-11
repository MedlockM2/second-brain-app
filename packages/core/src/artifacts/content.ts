/**
 * The structured payload of an artifact, read defensively.
 *
 * The backend writes each artifact as a JSON envelope whose `content` is shaped
 * per type, with a model-written `title` on every shape (task-270):
 *
 * - summary_short:    { title, key_points: string[], takeaway }
 * - summary_detailed: { title, context, main_topics, key_points,
 *                       notable_quotes: [{text, source_ref}], conclusion }
 * - notes:            { objectives, concepts: [{term, explanation, importance}],
 *                       key_points, action_items, glossary: [{term, definition}] }
 * - flashcards:       { cards: [{question, answer}], card_count }
 * - quiz:             { questions: [{question, options: [{label, text}],
 *                       correct_answer, explanation}], question_count }
 *
 * Model output is not trusted to match: every reader below drops what does not
 * fit instead of throwing. The same readers as `mobile/app/artifacts/[artifactId].tsx`,
 * shared with the web app from here; the mobile screen keeps its copies until a
 * mobile change points them here.
 */

export type ArtifactKind =
  | "summary_short"
  | "summary_detailed"
  | "summary"
  | "notes"
  | "flashcards"
  | "quiz";

export function normalizeArtifactKind(raw: string): ArtifactKind {
  const lower = (raw ?? "").toLowerCase();
  if (lower === "summary_short") return "summary_short";
  if (lower === "summary_detailed") return "summary_detailed";
  if (lower === "summary") return "summary";
  if (lower === "notes") return "notes";
  if (lower === "flashcards") return "flashcards";
  return "quiz";
}

/** The `content` object of an artifact's envelope, or `{}`. */
export function artifactContent(payload: unknown): Record<string, unknown> {
  const content = (payload as { content?: unknown } | null)?.content;
  return content && typeof content === "object" && !Array.isArray(content)
    ? (content as Record<string, unknown>)
    : {};
}

export function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

export function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] | null {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) {
      const strs = v
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((s) => s.length > 0);
      if (strs.length > 0) return strs;
    }
  }
  return null;
}

export interface ArtifactQuote {
  text: string;
  sourceRef?: string;
}

export function pickQuotes(obj: Record<string, unknown>, keys: string[]): ArtifactQuote[] | null {
  for (const key of keys) {
    const value = obj[key];
    if (!Array.isArray(value)) continue;
    const quotes: ArtifactQuote[] = [];
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const text = typeof record.text === "string" ? record.text.trim() : "";
        if (!text) continue;
        const sourceRef =
          typeof record.source_ref === "string" ? record.source_ref.trim() || undefined : undefined;
        quotes.push({ text, sourceRef });
      }
    }
    if (quotes.length > 0) return quotes;
  }
  return null;
}

export interface Concept {
  term: string;
  explanation: string;
  importance?: string;
}

export function pickConceptArray(obj: Record<string, unknown>): Concept[] | null {
  const v = obj["concepts"];
  if (!Array.isArray(v)) return null;
  const out: Concept[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const term = r["term"];
      const explanation = r["explanation"];
      const importance = r["importance"];
      if (typeof term === "string" && typeof explanation === "string") {
        out.push({
          term: term.trim(),
          explanation: explanation.trim(),
          importance: typeof importance === "string" ? importance.trim() : undefined,
        });
      }
    }
  }
  return out.length > 0 ? out : null;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export function pickGlossaryArray(obj: Record<string, unknown>): GlossaryEntry[] | null {
  const v = obj["glossary"];
  if (!Array.isArray(v)) return null;
  const out: GlossaryEntry[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const term = r["term"];
      const definition = r["definition"];
      if (typeof term === "string" && typeof definition === "string") {
        out.push({ term: term.trim(), definition: definition.trim() });
      }
    }
  }
  return out.length > 0 ? out : null;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export function pickFlashcardArray(obj: Record<string, unknown>): Flashcard[] | null {
  const v = obj["cards"];
  if (!Array.isArray(v)) return null;
  const out: Flashcard[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const question = r["question"];
    const answer = r["answer"];
    if (typeof question === "string" && typeof answer === "string") {
      out.push({ question: question.trim(), answer: answer.trim() });
    }
  }
  return out.length > 0 ? out : null;
}

export interface QuizQuestion {
  question: string;
  options: { label: string; text: string }[];
  /** Upper-cased option label. */
  correct_answer: string;
  explanation: string;
}

export function pickQuizQuestions(obj: Record<string, unknown>): QuizQuestion[] | null {
  const v = obj["questions"];
  if (!Array.isArray(v)) return null;
  const out: QuizQuestion[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const question = r["question"];
    const optionsRaw = r["options"];
    const correct = r["correct_answer"];
    const explanation = r["explanation"];
    if (
      typeof question !== "string" ||
      !Array.isArray(optionsRaw) ||
      typeof correct !== "string" ||
      typeof explanation !== "string"
    ) {
      continue;
    }
    const options: { label: string; text: string }[] = [];
    for (const opt of optionsRaw) {
      if (!opt || typeof opt !== "object") continue;
      const or = opt as Record<string, unknown>;
      const label = or["label"];
      const text = or["text"];
      if (typeof label === "string" && typeof text === "string") {
        options.push({ label: label.trim(), text: text.trim() });
      }
    }
    if (options.length === 0) continue;
    out.push({
      question: question.trim(),
      options,
      correct_answer: correct.trim().toUpperCase(),
      explanation: explanation.trim(),
    });
  }
  return out.length > 0 ? out : null;
}
