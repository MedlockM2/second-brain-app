import { describeChatRefusal } from "@media-summarizer/core/chat/refusal";
import { formatDate } from "@media-summarizer/core/i18n/runtime";
import type { ChatConversationSummary, ChatMessage, ChatScope, ChatSource } from "@media-summarizer/core/types/chat";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { chatClient } from "../../chat/chatClient";
import { useChat, type ChatState } from "../../chat/useChat";
import { useI18n } from "../../i18n/I18nProvider";
import { mediaPath } from "../../routes";
import { BudgetForecastNotice } from "../BudgetForecastNotice";
import { Dialog } from "../Dialog";
import { Icon } from "../Icon";
import { MarkdownView } from "../MarkdownView";
import { PaneEmpty, type PaneSpec } from "../panes/Panes";

/**
 * The Discussion pane of a media or a folder (owner's mockup, "Média en trois
 * volets" and "Dossier en trois volets"): the conversation in the middle of the
 * page, its composer at the foot, past conversations and a new one in its
 * header. Same rules as the mobile chat (task-500 to task-503, task-519):
 * answers in Markdown, a folder's citations named after the media they cite and
 * opening it, no character limit or counter, one send-or-stop button, and a
 * question asked while the media is being extracted kept until its text is
 * ready. Enter sends; Shift+Enter starts a new line.
 */
export function useChatPane({
  scope,
  scopeId,
  sourceReady,
  lockedMessage,
  scopeLabel,
}: {
  scope: ChatScope;
  scopeId: string;
  /** A media's text is ready; always true for a folder. */
  sourceReady: boolean;
  /** Set when there is nothing to discuss (the import failed): the pane says this instead. */
  lockedMessage?: string | null;
  /** Shown under the pane title: "This folder · N sources". */
  scopeLabel?: ReactNode;
}): PaneSpec {
  const { t, tw } = useI18n();
  const navigate = useNavigate();
  const chat = useChat(scope, scopeId, sourceReady);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const { state } = chat;

  const generating = state.generation !== null;
  const sending = state.phase === "sending";
  const refusal = state.error ? describeChatRefusal(state.error, scope) : null;

  const submit = async () => {
    const question = draft;
    if (!question.trim()) return;
    setDraft("");
    const accepted = await chat.send(question);
    // A refused question goes back to the field, so nothing typed is lost.
    if (!accepted) setDraft((current) => current || question);
  };

  const startNew = () => {
    setHistoryOpen(false);
    chat.newConversation();
  };

  const title = (
    <>
      <span className="ell">{tw("pane.discussion")}</span>
      {scopeLabel && (
        <span className="small muted" style={{ fontWeight: 400 }}>
          {scopeLabel}
        </span>
      )}
    </>
  );

  if (lockedMessage) {
    return {
      title: tw("pane.discussion"),
      icon: "chatbubbles-outline",
      head: title,
      body: (
        <PaneEmpty icon="chatbubbles-outline">
          <p>{lockedMessage}</p>
        </PaneEmpty>
      ),
    };
  }

  return {
    title: tw("pane.discussion"),
    icon: "chatbubbles-outline",
    head: title,
    actions: (
      <>
        <button
          type="button"
          className={`icon-btn${historyOpen ? " on" : ""}`}
          aria-label={t("chat.history.open")}
          title={t("chat.history.open")}
          aria-pressed={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          <Icon name="time-outline" size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("chat.conversation.newConversation")}
          title={t("chat.conversation.newConversation")}
          onClick={startNew}
        >
          <Icon name="create-outline" size={18} />
        </button>
      </>
    ),
    body: historyOpen ? (
      <History
        scope={scope}
        scopeId={scopeId}
        current={state.conversation?.conversation_id ?? null}
        onOpen={(id) => {
          setHistoryOpen(false);
          void chat.select(id);
        }}
        onDelete={chat.remove}
      />
    ) : (
      <Thread
        state={state}
        scope={scope}
        onRetry={(question) => void chat.send(question)}
        onCancelPending={chat.cancelPending}
        retryDisabled={generating || sending}
        onOpenSource={(source) => navigate(mediaPath(source.media_item_id))}
      />
    ),
    foot: historyOpen ? null : (
      <>
        {refusal && (
          <div className="banner-err chat-refusal" role="alert">
            <span className="grow">{refusal.message}</span>
            {refusal.action === "newConversation" && (
              <button type="button" className="btn tonal" onClick={startNew}>
                {t("chat.conversation.newConversation")}
              </button>
            )}
            {refusal.action === "seePlans" && (
              <button type="button" className="btn tonal" onClick={() => navigate("/account/plan")}>
                {t("quota.seePlans")}
              </button>
            )}
            <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={chat.dismissError}>
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {draft.trim() && !generating ? <BudgetForecastNotice request={state.conversation ? { operation: "chat_turn", conversation_id: state.conversation.conversation_id, question: draft } : null} /> : null}
        <Composer
          value={draft}
          onChange={setDraft}
          placeholder={t(scope === "media" ? "chat.dock.askMedia" : "chat.dock.askFolder")}
          generating={generating}
          sending={sending}
          onSend={() => void submit()}
          onStop={() => void chat.stop()}
        />
      </>
    ),
  };
}

function statusLine(message: ChatMessage, t: ReturnType<typeof useI18n>["t"]): string | null {
  if (message.status === "interrupted") {
    switch (message.interruption_cause) {
      case "cancelled":
        return t("chat.thread.interruptedCancelled");
      case "output_limit":
        return t("chat.thread.interruptedOutputLimit");
      default:
        return t("chat.thread.interruptedError");
    }
  }
  if (message.status === "failed") return t("chat.thread.failed");
  return null;
}

function Thread({
  state,
  scope,
  onRetry,
  onCancelPending,
  retryDisabled,
  onOpenSource,
}: {
  state: ChatState;
  scope: ChatScope;
  onRetry: (question: string) => void;
  onCancelPending: () => void;
  retryDisabled: boolean;
  onOpenSource: (source: ChatSource) => void;
}) {
  const { t, tw } = useI18n();
  const end = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => state.conversation?.messages ?? [], [state.conversation]);
  const sources = useMemo(
    () => new Map((state.conversation?.sources ?? []).map((source) => [source.ref, source])),
    [state.conversation],
  );
  const questions = useMemo(
    () => new Map(messages.filter((m) => m.role === "user").map((m) => [m.turn_index, m.text ?? ""])),
    [messages],
  );
  const liveIndex = state.generation?.turn_index ?? null;

  // Follow the conversation down as it grows, like a chat.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, state.streamingText, state.pending]);

  if (messages.length === 0 && !state.pending) {
    return (
      <PaneEmpty icon="chatbubbles-outline">
        <p>{tw(scope === "media" ? "chat.emptyMedia" : "chat.emptyFolder")}</p>
      </PaneEmpty>
    );
  }

  return (
    <div className="thread" aria-live="polite">
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={`${message.turn_id}-q`} className="q" aria-label={t("chat.thread.questionA11y", { text: message.text ?? "" })}>
              {message.text}
            </div>
          );
        }
        const live = liveIndex === message.turn_index;
        const text = live ? state.streamingText : (message.text ?? "");
        const status = live ? null : statusLine(message, t);
        const canRetry =
          !live &&
          (message.status === "failed" || (message.status === "interrupted" && message.interruption_cause === "provider_error"));
        return (
          <div key={`${message.turn_id}-a`} className="a">
            {text && (
              <MarkdownView text={text} live={live} sources={sources} showSources={scope === "folder"} onOpenSource={onOpenSource} />
            )}
            {live && !text && (
              <span className="spin" style={{ display: "inline-flex", color: "var(--text-muted)" }}>
                <Icon name="sync-outline" size={18} />
              </span>
            )}
            {status && (
              <div className={`status small${message.status === "failed" ? " err" : ""}`}>
                <Icon name={message.status === "failed" ? "alert-circle-outline" : "remove-circle-outline"} size={14} />
                {status}
              </div>
            )}
            {canRetry && (
              <button type="button" className="btn tonal" disabled={retryDisabled} onClick={() => onRetry(questions.get(message.turn_index) ?? "")}>
                <Icon name="refresh-outline" size={18} />
                {t("chat.thread.retry")}
              </button>
            )}
          </div>
        );
      })}
      {state.pending && (
        <>
          <div className="q">{state.pending.question}</div>
          <div className="a">
            {state.pending.status === "waiting_for_source" ? (
              <div className="status small">
                {t("chat.thread.waitingForSource")}
                <button type="button" className="btn ghost" onClick={onCancelPending}>
                  {t("common.cancel")}
                </button>
              </div>
            ) : state.pending.status === "sending" ? (
              <div className="status small">{t("chat.thread.sending")}</div>
            ) : (
              <button type="button" className="btn tonal" disabled={retryDisabled} onClick={() => onRetry(state.pending!.question)}>
                <Icon name="refresh-outline" size={18} />
                {t("chat.thread.retrySend")}
              </button>
            )}
          </div>
        </>
      )}
      <div ref={end} />
    </div>
  );
}

function Composer({
  value,
  onChange,
  placeholder,
  generating,
  sending,
  onSend,
  onStop,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  generating: boolean;
  sending: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const { t } = useI18n();
  const field = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !generating && !sending;

  // Grow with the text, up to the cap set in CSS, then scroll inside.
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="composer">
      <textarea
        ref={field}
        rows={1}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {generating ? (
        <button type="button" className="send stop" aria-label={t("chat.composer.stopA11y")} title={t("chat.composer.stopA11y")} onClick={onStop}>
          <Icon name="stop" size={18} />
        </button>
      ) : (
        <button
          type="button"
          className="send"
          aria-label={t("chat.composer.sendA11y")}
          title={t("chat.composer.sendA11y")}
          disabled={!canSend}
          onClick={onSend}
        >
          <Icon name="arrow-up" size={18} />
        </button>
      )}
    </div>
  );
}

/** Past conversations of the scope, newest activity first, each deletable. */
function History({
  scope,
  scopeId,
  current,
  onOpen,
  onDelete,
}: {
  scope: ChatScope;
  scopeId: string;
  current: string | null;
  onOpen: (conversationId: string) => void;
  onDelete: (conversationId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<ChatConversationSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<ChatConversationSummary | null>(null);

  const load = (after: string | null) => {
    setFailed(false);
    chatClient
      .listConversations(scope, scopeId, after)
      .then((page) => {
        setItems((existing) => (after ? [...(existing ?? []), ...page.conversations] : page.conversations));
        setCursor(page.next_cursor ?? null);
      })
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    void (async () => load(null))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeId]);

  const titleOf = (item: ChatConversationSummary) => item.title?.trim() || t("chat.history.untitled");

  return (
    <>
      <div className="caps" style={{ margin: "4px 0 10px" }}>
        {t("chat.history.title")}
      </div>
      {failed && !items ? (
        <div className="section-error" role="alert">
          <span className="subtle">{t("chat.history.error")}</span>
          <button type="button" className="btn tonal" onClick={() => load(null)}>
            {t("common.retry")}
          </button>
        </div>
      ) : items === null ? (
        <p className="small muted">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="small muted">{t("chat.history.empty")}</p>
      ) : (
        <div className="hist">
          {items.map((item) => (
            <div key={item.conversation_id} className={`hist-row${item.conversation_id === current ? " on" : ""}`}>
              <button type="button" className="grow" onClick={() => onOpen(item.conversation_id)}>
                <span className="t ell">{titleOf(item)}</span>
                <span className="small muted">
                  {formatDate(new Date(item.last_activity_at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t("chat.history.deleteA11y", { title: titleOf(item) })}
                onClick={() => setConfirming(item)}
              >
                <Icon name="trash-outline" size={18} />
              </button>
            </div>
          ))}
          {cursor && (
            <button type="button" className="btn tonal" onClick={() => load(cursor)}>
              {t("chat.history.loadMore")}
            </button>
          )}
        </div>
      )}
      {confirming && (
        <Dialog
          title={t("chat.history.confirmTitle")}
          onClose={() => setConfirming(null)}
          onSubmit={() => {
            const target = confirming;
            setConfirming(null);
            onDelete(target.conversation_id)
              .then(() => setItems((existing) => (existing ?? []).filter((row) => row.conversation_id !== target.conversation_id)))
              .catch(() => setFailed(true));
          }}
          footer={
            <>
              <button type="button" className="btn ghost" onClick={() => setConfirming(null)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn primary">
                {t("common.delete")}
              </button>
            </>
          }
        >
          <p className="small subtle" style={{ margin: 0 }}>
            {t("chat.history.confirmBody", { title: titleOf(confirming) })}
          </p>
        </Dialog>
      )}
    </>
  );
}
