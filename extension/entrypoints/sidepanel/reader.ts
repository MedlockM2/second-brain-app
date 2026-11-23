import { hasStructuredMarkdown } from "@media-summarizer/core/chat/markdown";
import { splitArticleText, splitTranscriptParagraphs } from "@media-summarizer/core/media/transcript";
import type { ChatConversationDetail, ChatMessage } from "@media-summarizer/core/types/chat";
import { TERMINAL_TURN_STATUSES } from "@media-summarizer/core/types/chat";
import type { MediaItemContract, RawContentResponse } from "@media-summarizer/core/types/media";
import { conversation, latestConversationId, openConversation, rawContent, sendTurn } from "../../lib/api";
import { failureMessage, saveFailure } from "../../lib/errors";
import { msg } from "../../lib/i18n";
import { icon } from "../../lib/icons";
import { mediaStage } from "../../lib/media";
import { el, note, type Scope, sleep } from "./dom";
import { drawMarkdown } from "./markdown";

/**
 * The Lecture tab, as in the app: the essential, the full text — folded, since
 * the page is on screen next to it — and the conversation with the media. The
 * composer sits at the foot of the panel while this tab is shown.
 *
 * Answers are followed by reading the conversation every 2 s, the web app's own
 * fallback without a stream URL: the stream door has its own host, which the
 * extension would have to be granted too.
 */
const CHAT_POLL_MS = 2000;
const TRANSLATION_POLL_MS = 5000;
const POLL_LIMIT = 200;
const TRANSLATION_LIMIT = 24;
/** A question asked while the source is extracted is retried this often once it reads as ready. */
const SOURCE_RETRY_MS = 3000;
const SOURCE_RETRY_LIMIT = 20;

export interface ReaderView {
  element: HTMLElement;
  composer: HTMLFormElement;
  update(media: MediaItemContract): void;
}

export function mountReader(scope: Scope, mediaItemId: string, onUnlinked: (error: unknown) => boolean): ReaderView {
  let media: MediaItemContract | null = null;

  // --- The essential ---------------------------------------------------------------------
  const essential = el("section", { className: "ess", attrs: { "aria-live": "polite" } });
  function drawEssential(): void {
    const label = el("div", { className: "lab", text: msg("essentials") });
    const blurb = media?.review_blurb;
    if (blurb && media?.review_blurb_status === "ready") {
      essential.className = "ess";
      essential.replaceChildren(label, el("p", { className: "hook", text: blurb.hook }),
        el("ul", {}, ...blurb.points.map((point) => el("li", { text: point }))));
      return;
    }
    const failed = media?.review_blurb_status === "failed" || (media !== null && mediaStage(media.status) === "failed");
    essential.className = failed ? "ess" : "ess pending";
    essential.replaceChildren(label, note(msg(failed ? "previewUnavailable" : "previewPending")),
      ...(failed ? [] : [el("i", { className: "sk" }), el("i", { className: "sk" }), el("i", { className: "sk short" })]));
  }

  // --- The full text, folded ---------------------------------------------------------------
  const fold = el("button", { className: "fold", attrs: { type: "button", "aria-expanded": "false" } });
  const foldMeta = el("span", { className: "fold-m" });
  fold.append(icon("document-text-outline", 18), el("span", { className: "fold-t", text: msg("fullText") }), foldMeta, icon("chevron-down", 16, "chev"));
  const text = el("div", { className: "text", attrs: { id: `text-${mediaItemId}` } });
  text.hidden = true;
  fold.setAttribute("aria-controls", text.id);
  let loaded: { translated: RawContentResponse | null; original: RawContentResponse | null; showingOriginal: boolean } | null = null;

  function drawFold(): void {
    const ready = media !== null && mediaStage(media.status) === "ready";
    fold.disabled = !ready;
    fold.classList.toggle("off", !ready);
    foldMeta.textContent = ready ? "" : msg("fullTextPreparing");
  }

  fold.onclick = async () => {
    const open = text.hidden;
    text.hidden = !open;
    fold.setAttribute("aria-expanded", String(open));
    fold.classList.toggle("on", open);
    if (open && !loaded) await loadText();
  };

  async function loadText(original = false): Promise<void> {
    text.replaceChildren(note(msg("loading")));
    for (let read = 0; read < TRANSLATION_LIMIT && scope.alive; read += 1) {
      try {
        const response = await rawContent(mediaItemId, original);
        if (!scope.alive) return;
        loaded ??= { translated: null, original: null, showingOriginal: false };
        if (original) loaded.original = response;
        else loaded.translated = response;
        loaded.showingOriginal = original;
        drawText();
        if (original || response.translation?.translation_pending !== true) return;
      } catch (error) {
        if (onUnlinked(error) || !scope.alive) return;
        if (read === 0) {
          text.replaceChildren(note(msg("fullTextFailed"), true));
          return;
        }
      }
      await sleep(TRANSLATION_POLL_MS);
    }
  }

  function drawText(): void {
    if (!loaded) return;
    const response = loaded.showingOriginal ? loaded.original : loaded.translated;
    if (!response) return;
    const nodes: Node[] = [];
    const translation = loaded.translated?.translation;
    if (translation?.is_translated) {
      const from = (translation.translated_from ?? translation.detected_language ?? "").toUpperCase();
      const to = (translation.target_language ?? "").toUpperCase();
      const toggle = el("button", { className: "chip small-chip", attrs: { type: "button" } }, icon("language-outline", 14),
        msg(loaded.showingOriginal ? "viewTranslation" : "viewOriginal").replace("{language}", loaded.showingOriginal ? to : from));
      toggle.onclick = () => {
        if (!loaded) return;
        if (loaded.showingOriginal) { loaded.showingOriginal = false; drawText(); }
        else if (loaded.original) { loaded.showingOriginal = true; drawText(); }
        else void loadText(true);
      };
      nodes.push(el("div", { className: "text-tools" }, toggle));
    }
    if (!loaded.showingOriginal && translation?.translation_pending) nodes.push(note(msg("translating")));
    if (!loaded.showingOriginal && translation?.translation_status === "failed") nodes.push(note(msg("translationFailed")));

    const content = (response.content ?? "").trim();
    if (!content) {
      text.replaceChildren(...nodes, note(msg("fullTextEmpty")));
      return;
    }
    const article = splitArticleText(content);
    if (article.lead) nodes.push(el("p", { className: "lead", text: article.lead }));
    if (hasStructuredMarkdown(article.body)) {
      const body = el("div", { className: "md" });
      drawMarkdown(body, article.body, { transcript: true });
      nodes.push(body);
    } else {
      splitTranscriptParagraphs(article.body).forEach((paragraph, index) => {
        nodes.push(el("p", {}, el("span", { className: "pn", text: `§${index + 1}` }),
          paragraph.speaker ? el("b", { text: `${paragraph.speaker}: ` }) : null, paragraph.text));
      });
    }
    if (article.incomplete) {
      nodes.push(el("aside", { className: "incomplete" }, icon("lock-closed-outline", 18),
        el("div", {}, el("div", { className: "incomplete-t", text: msg("incompleteTitle") }), el("p", { text: msg("incompleteBody") }))));
    }
    text.replaceChildren(...nodes);
  }

  // --- The conversation ----------------------------------------------------------------------
  const newConversation = el("button", { className: "link", attrs: { type: "button" } }, icon("create-outline", 15), msg("chatNew"));
  const thread = el("ol", { className: "thread", attrs: { "aria-live": "polite" } });
  const chatStatus = el("p", { className: "status", attrs: { role: "status" } });
  const chat = el("section", { className: "chat" },
    el("div", { className: "sec-head" }, el("h2", { text: msg("panelChat") }), newConversation), thread, chatStatus);

  const question = el("textarea", { attrs: { rows: "1", placeholder: msg("chatAsk"), "aria-label": msg("chatAsk") } });
  const send = el("button", { className: "send", attrs: { type: "submit", "aria-label": msg("chatSend"), title: msg("chatSend") } }, icon("arrow-up", 18));
  // Where chat apps put their tools, as in the app: the globe of the web citations, a toggle.
  const webSearch = el("button", { className: "web-search", attrs: { type: "button", "aria-pressed": "false",
    "aria-label": msg("chatWebSearch"), title: msg("chatWebSearchHint") } }, icon("globe-outline", 18));
  const composer = el("form", { className: "composer" }, webSearch, question, send);

  let chatGeneration = 0;
  let conversationId: string | null = null;
  let messages: ChatMessage[] = [];
  let pendingQuestion: string | null = null;
  // A question asked before the source is extracted, as in the app: kept in the thread, sent once it is ready.
  let heldQuestion: { text: string; web: boolean } | null = null;
  let waitTimer: ReturnType<typeof setTimeout> | null = null;
  let sourceRetries = 0;
  let webSearching = false;
  let sending = false;
  let forceWebSearch = false;
  const chatAlive = (run: number) => scope.alive && run === chatGeneration;

  function settled(detail: ChatConversationDetail): boolean {
    const last = detail.messages[detail.messages.length - 1];
    return !detail.active_generation && (!last || last.role === "assistant") &&
      (!last?.status || TERMINAL_TURN_STATUSES.includes(last.status));
  }

  function take(detail: ChatConversationDetail): void {
    messages = detail.messages;
    webSearching = detail.active_generation?.web_searching === true;
    drawThread();
  }

  async function loadConversation(run: number): Promise<void> {
    try {
      const id = await latestConversationId(mediaItemId);
      if (!id || !chatAlive(run)) return;
      conversationId = id;
      const detail = await conversation(id);
      if (!chatAlive(run)) return;
      take(detail);
      if (!settled(detail)) void follow(run);
    } catch (error) {
      onUnlinked(error);
    }
  }

  async function follow(run: number): Promise<void> {
    for (let attempt = 0; attempt < POLL_LIMIT && chatAlive(run) && conversationId; attempt += 1) {
      await sleep(CHAT_POLL_MS);
      if (!chatAlive(run) || !conversationId) return;
      try {
        const detail = await conversation(conversationId);
        if (!chatAlive(run)) return;
        pendingQuestion = null;
        take(detail);
        if (settled(detail)) return;
      } catch (error) {
        if (onUnlinked(error)) return;
      }
    }
  }

  function drawThread(): void {
    const items: HTMLElement[] = messages.map((message) => message.role === "user"
      ? el("li", { className: "q", text: message.text ?? "" })
      : assistantTurn(message));
    if (pendingQuestion) items.push(el("li", { className: "q", text: pendingQuestion }));
    const last = messages[messages.length - 1];
    const waiting = pendingQuestion !== null ||
      (last !== undefined && (last.role === "user" || (last.status !== undefined && last.status !== null && !TERMINAL_TURN_STATUSES.includes(last.status))));
    if (waiting && !(last?.role === "assistant" && last.text)) {
      items.push(el("li", { className: "typing" }, el("span"), el("span"), el("span"), msg(webSearching ? "chatSearchingWeb" : "chatWriting")));
    }
    if (heldQuestion) {
      const cancel = el("button", { className: "link", attrs: { type: "button" }, text: msg("cancel") });
      cancel.onclick = cancelWaiting;
      items.push(el("li", { className: "q", text: heldQuestion.text }),
        el("li", { className: "typing" }, el("span"), el("span"), el("span"), msg("chatWaitingForSource"), cancel));
    }
    // The invitation, once there is something to ask about.
    if (items.length === 0 && media !== null && mediaStage(media.status) === "ready") items.push(el("li", { className: "note", text: msg("chatEmpty") }));
    thread.replaceChildren(...items);
    newConversation.hidden = conversationId === null || messages.length === 0;
  }

  function assistantTurn(message: ChatMessage): HTMLElement {
    const item = el("li", { className: "ans" });
    const live = !message.status || !TERMINAL_TURN_STATUSES.includes(message.status);
    const webSources = new Map((message.web_sources ?? []).map((source) => [source.ref, source.url]));
    if (message.text) drawMarkdown(item, message.text, { live, webSources });
    if (message.status === "failed") item.append(note(msg("chatFailed"), true));
    if (message.status === "interrupted") {
      const cause = message.interruption_cause === "cancelled" ? "chatInterruptedCancelled"
        : message.interruption_cause === "output_limit" ? "chatInterruptedOutputLimit" : "chatInterruptedError";
      item.append(note(msg(cause)));
    }
    return item;
  }

  const sourceReady = () => media !== null && mediaStage(media.status) === "ready";

  function drawComposer(): void {
    // Open while the source is extracted too: a question asked then waits for it in the thread.
    const open = media !== null && mediaStage(media.status) !== "failed";
    question.disabled = !open;
    send.disabled = !open || sending || heldQuestion !== null;
    webSearch.disabled = !open;
    webSearch.classList.toggle("on", forceWebSearch);
    webSearch.setAttribute("aria-pressed", String(forceWebSearch));
    composer.classList.toggle("off", !open);
  }

  function hold(text: string, web: boolean): void {
    heldQuestion = { text, web };
    drawThread();
    drawComposer();
    // Ready on the panel's last read but not yet on the server's: try again shortly.
    if (sourceReady() && !waitTimer && sourceRetries < SOURCE_RETRY_LIMIT) {
      sourceRetries += 1;
      waitTimer = setTimeout(() => {
        waitTimer = null;
        if (scope.alive) release();
      }, SOURCE_RETRY_MS);
    }
  }

  /** Sends the held question once the source is ready, or hands it back if the source failed. */
  function release(): void {
    if (!heldQuestion || sending || !media) return;
    const stage = mediaStage(media.status);
    if (stage === "processing") return;
    const held = heldQuestion;
    heldQuestion = null;
    if (stage === "ready") {
      void submit(held.text, held.web);
      return;
    }
    question.value = held.text;
    fit();
    drawThread();
    drawComposer();
  }

  function cancelWaiting(): void {
    if (!heldQuestion) return;
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    // The draft goes back to the field, to edit or ask again.
    question.value = heldQuestion.text;
    forceWebSearch = heldQuestion.web;
    heldQuestion = null;
    fit();
    drawThread();
    drawComposer();
    question.focus();
  }

  function fit(): void {
    question.style.height = "auto";
    question.style.height = `${Math.min(question.scrollHeight, 160)}px`;
  }

  function ask(): void {
    const text = question.value.trim();
    if (!text || sending || heldQuestion) return;
    // The globe holds for one question, as in the app.
    const web = forceWebSearch;
    forceWebSearch = false;
    question.value = "";
    fit();
    chatStatus.className = "status";
    chatStatus.textContent = "";
    sourceRetries = 0;
    if (sourceReady()) void submit(text, web);
    else hold(text, web);
  }

  async function submit(text: string, web: boolean): Promise<void> {
    const run = chatGeneration;
    sending = true;
    pendingQuestion = text;
    drawThread();
    drawComposer();
    try {
      if (!conversationId) conversationId = (await openConversation(mediaItemId)).conversation_id;
      if (!chatAlive(run)) return;
      await sendTurn(conversationId, text, crypto.randomUUID(), web);
      if (chatAlive(run)) void follow(run);
    } catch (error) {
      if (onUnlinked(error) || !chatAlive(run)) return;
      pendingQuestion = null;
      if (saveFailure(error).code === "scope_preparing") {
        hold(text, web);
        return;
      }
      // The draft is kept: the question goes back to the field.
      question.value = text;
      forceWebSearch = web;
      fit();
      drawThread();
      chatStatus.className = "status error";
      chatStatus.textContent = failureMessage(saveFailure(error), "chatRefusalGeneric");
    } finally {
      sending = false;
      drawComposer();
    }
  }

  composer.onsubmit = (event) => {
    event.preventDefault();
    ask();
  };
  webSearch.onclick = () => {
    forceWebSearch = !forceWebSearch;
    drawComposer();
    question.focus();
  };
  question.oninput = fit;
  question.onkeydown = (event) => {
    // Enter sends, Shift+Enter breaks the line; never in the middle of an IME composition.
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      ask();
    }
  };
  newConversation.onclick = () => {
    chatGeneration += 1;
    conversationId = null;
    messages = [];
    pendingQuestion = null;
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    heldQuestion = null;
    webSearching = false;
    forceWebSearch = false;
    chatStatus.className = "status";
    drawThread();
    drawComposer();
    question.focus();
  };

  drawEssential();
  drawFold();
  drawThread();
  drawComposer();
  void loadConversation(chatGeneration);

  return {
    element: el("div", { className: "reader" }, essential, el("div", { className: "fold-wrap" }, fold, text), chat),
    composer,
    update(next) {
      media = next;
      drawEssential();
      drawFold();
      drawComposer();
      drawThread();
      release();
    },
  };
}
