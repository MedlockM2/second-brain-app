import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatGeneration,
  ChatScope,
  ChatStreamEvent,
} from "@media-summarizer/core/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatClient, type ChatStreamOpening } from "./chatClient";

/**
 * The conversation of one scope — a media or a folder — in its Discussion pane:
 * the web counterpart of the mobile `ChatSessionContext` (task-467, task-497,
 * task-519), for the one scope a page shows.
 *
 * A question is accepted by the API, then its answer is followed on the stream:
 * fragments append to the live text, a `reconnect` or a dropped connection
 * resumes from the last sequence held (`after_seq`), a `409` adopts the
 * generation that is live, and anything else falls back on re-reading the
 * conversation, every 2 s while the stream is unavailable. Leaving the page or
 * switching conversations only disconnects; only `stop` asks the server to stop.
 *
 * A lost turn comes back failed (`generation_lost`, `dispatch_failed`, task-470)
 * and is asked again as a new question. A question asked while the media is
 * still being extracted waits here for its text (`sourceReady`), then leaves.
 */
export type ChatPhase = "idle" | "sending" | "streaming" | "polling";

export interface PendingQuestion {
  question: string;
  clientRequestId: string;
  createdAt: string;
  status: "waiting_for_source" | "sending" | "failed";
}

export interface ChatState {
  /** The scope this state belongs to, `scope:scopeId`. */
  key: string;
  conversation: ChatConversationDetail | null;
  pending: PendingQuestion | null;
  generation: ChatGeneration | null;
  streamingText: string;
  lastSeq: number;
  phase: ChatPhase;
  error: unknown;
}

const POLL_MS = 2_000;
const STREAM_RETRY_MS = 10_000;
const MIN_RECONNECT_MS = 1_000;

const EMPTY: ChatState = {
  key: "",
  conversation: null,
  pending: null,
  generation: null,
  streamingText: "",
  lastSeq: -1,
  phase: "idle",
  error: null,
};

const codeOf = (error: unknown) => (error as { code?: string } | null)?.code;

export function useChat(scope: ChatScope, scopeId: string, sourceReady: boolean) {
  const key = `${scope}:${scopeId}`;
  const [state, setState] = useState<ChatState>(EMPTY);
  const stateRef = useRef<ChatState>(EMPTY);
  /** Bumped whenever the shown conversation changes: older operations then drop their result. */
  const epochRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastStreamRef = useRef(0);
  const sendingRef = useRef(false);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  const followRef = useRef<() => Promise<void>>(async () => {});

  const update = useCallback((patch: Partial<ChatState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState(stateRef.current);
  }, []);

  /** A transport disconnect, never a server-side stop. */
  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  const reset = useCallback(() => {
    epochRef.current += 1;
    sendingRef.current = false;
    lastStreamRef.current = 0;
    disconnect();
    stateRef.current = { ...EMPTY, key: stateRef.current.key };
    setState(stateRef.current);
    return epochRef.current;
  }, [disconnect]);

  const schedulePoll = useCallback(() => {
    const epoch = epochRef.current;
    if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    pollRef.current = window.setTimeout(() => {
      pollRef.current = null;
      if (epochRef.current === epoch) void syncRef.current();
    }, POLL_MS);
  }, []);

  /** Reconcile with the durable conversation, then follow what is live. */
  const sync = useCallback(async () => {
    const current = stateRef.current;
    const conversationId = current.conversation?.conversation_id;
    if (!conversationId || current.pending) return;
    const epoch = epochRef.current;
    let detail: ChatConversationDetail;
    try {
      detail = await chatClient.getConversation(conversationId);
    } catch (error) {
      if (epochRef.current !== epoch) return;
      update({ error });
      schedulePoll();
      return;
    }
    if (epochRef.current !== epoch) return;
    const latest = stateRef.current;
    const active = detail.active_generation ?? null;
    if (!active) {
      disconnect();
      update({ conversation: detail, generation: null, streamingText: "", lastSeq: -1, phase: "idle", error: null });
      return;
    }
    // Fragments may have come in while the read was pending: keep them.
    const same = latest.generation?.attempt_id === active.attempt_id && latest.generation?.turn_id === active.turn_id;
    if (!same) disconnect();
    update({
      conversation: detail,
      generation: { turn_id: active.turn_id, turn_index: active.turn_index, attempt_id: active.attempt_id },
      streamingText: same ? latest.streamingText : "",
      lastSeq: same ? latest.lastSeq : -1,
      error: null,
    });
    void followRef.current();
  }, [disconnect, schedulePoll, update]);

  const applyEvent = useCallback(
    (event: ChatStreamEvent) => {
      const current = stateRef.current;
      if (event.type !== "fragment" || event.data.seq <= current.lastSeq) return;
      update({ streamingText: current.streamingText + event.data.text, lastSeq: event.data.seq, phase: "streaming" });
    },
    [update],
  );

  const follow = useCallback(async () => {
    const current = stateRef.current;
    const conversationId = current.conversation?.conversation_id;
    const generation = current.generation;
    if (!conversationId || !generation || abortRef.current) return;
    const epoch = epochRef.current;
    const owns = () =>
      epochRef.current === epoch &&
      stateRef.current.generation?.attempt_id === generation.attempt_id &&
      stateRef.current.generation?.turn_id === generation.turn_id;

    const now = Date.now();
    const wait = current.phase === "polling" ? STREAM_RETRY_MS : MIN_RECONNECT_MS;
    if (!chatClient.streamingAvailable() || now - lastStreamRef.current < wait) {
      update({ phase: "polling" });
      schedulePoll();
      return;
    }
    lastStreamRef.current = now;
    const controller = new AbortController();
    abortRef.current = controller;
    update({ phase: "streaming" });

    let last: ChatStreamEvent | null = null;
    let opening: ChatStreamOpening;
    try {
      opening = await chatClient.followStream(
        conversationId,
        { generation, afterSeq: current.lastSeq },
        (event) => {
          if (controller.signal.aborted || abortRef.current !== controller || !owns()) return;
          if (event.type === "end" || event.type === "reconnect") last = event;
          applyEvent(event);
        },
        controller.signal,
      );
    } catch (error) {
      opening = { kind: "unavailable", error };
    }
    if (abortRef.current === controller) abortRef.current = null;
    if (controller.signal.aborted || !owns()) return;

    const ended = last as ChatStreamEvent | null;
    if (opening.kind === "stale") {
      update({ generation: opening.live, streamingText: "", lastSeq: -1 });
      lastStreamRef.current = 0;
      void syncRef.current();
    } else if (opening.kind === "unavailable") {
      update({ phase: "polling" });
      schedulePoll();
    } else if (ended?.type === "reconnect") {
      lastStreamRef.current = 0;
      void followRef.current();
    } else {
      // An end, nothing live, or a dropped connection: the durable state decides.
      void syncRef.current();
    }
  }, [applyEvent, schedulePoll, update]);

  useEffect(() => {
    syncRef.current = sync;
    followRef.current = follow;
  }, [sync, follow]);

  /** Show a past conversation, resuming its answer if one is being written. */
  const select = useCallback(
    async (conversationId: string) => {
      const epoch = reset();
      update({ phase: "sending" });
      try {
        const detail = await chatClient.getConversation(conversationId);
        if (epochRef.current !== epoch) return false;
        const active = detail.active_generation ?? null;
        update({
          conversation: detail,
          generation: active ? { turn_id: active.turn_id, turn_index: active.turn_index, attempt_id: active.attempt_id } : null,
          phase: active ? "streaming" : "idle",
        });
        if (active) void followRef.current();
        return true;
      } catch (error) {
        if (epochRef.current === epoch) update({ phase: "idle", error });
        return false;
      }
    },
    [reset, update],
  );

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const question = raw.trim();
      const current = stateRef.current;
      if (!question || sendingRef.current || current.generation || current.phase === "sending") return false;
      if (current.pending?.status === "waiting_for_source" && current.pending.question !== question) return false;
      const epoch = epochRef.current;
      const pending: PendingQuestion =
        current.pending?.question === question
          ? { ...current.pending, status: "sending" }
          : { question, clientRequestId: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "sending" };
      if (scope === "media" && !sourceReady) {
        update({ pending: { ...pending, status: "waiting_for_source" }, error: null });
        return true;
      }
      sendingRef.current = true;
      update({ phase: "sending", pending, error: null });
      try {
        let conversation = current.conversation;
        if (!conversation) {
          conversation = await chatClient.openConversation(scope, scopeId);
          if (epochRef.current !== epoch) return false;
          update({ conversation });
        }
        const turn = await chatClient.sendTurn(conversation.conversation_id, question, pending.clientRequestId);
        if (epochRef.current !== epoch) return false;
        // Draw the question and its empty answer now; the next read replaces them.
        const shown = stateRef.current.conversation ?? conversation;
        const messages = shown.messages.some((message) => message.turn_id === turn.turn_id)
          ? shown.messages
          : [
              ...shown.messages,
              { turn_id: turn.turn_id, turn_index: turn.turn_index, role: "user" as const, text: question, created_at: pending.createdAt },
              {
                turn_id: turn.turn_id,
                turn_index: turn.turn_index,
                role: "assistant" as const,
                text: "",
                status: turn.status,
                attempt_id: turn.attempt_id,
                created_at: pending.createdAt,
              },
            ];
        const generation = { turn_id: turn.turn_id, turn_index: turn.turn_index, attempt_id: turn.attempt_id };
        update({
          conversation: {
            ...shown,
            messages,
            title: shown.title ?? question,
            turn_count: Math.max(shown.turn_count, turn.turn_index),
            generating: true,
            active_generation: generation,
            last_turn_status: turn.status,
          },
          pending: null,
          generation,
          streamingText: "",
          lastSeq: -1,
          phase: "streaming",
          error: null,
        });
        lastStreamRef.current = 0;
        void followRef.current();
        return true;
      } catch (error) {
        if (epochRef.current !== epoch) return false;
        // The media's text is not there yet: the question waits for it instead.
        const preparing = scope === "media" && codeOf(error) === "scope_preparing";
        update({
          phase: "idle",
          pending: { ...pending, status: preparing ? "waiting_for_source" : "failed" },
          error: preparing ? null : error,
        });
        return preparing;
      } finally {
        if (epochRef.current === epoch) sendingRef.current = false;
      }
    },
    [scope, scopeId, sourceReady, update],
  );

  // A question kept while the media was extracted leaves once its text is ready.
  useEffect(() => {
    const pending = state.pending;
    if (sourceReady && pending?.status === "waiting_for_source") void send(pending.question);
  }, [sourceReady, state.pending, send]);

  const cancelPending = useCallback(() => {
    if (!stateRef.current.pending || stateRef.current.phase === "sending") return;
    update({ pending: null, error: null });
  }, [update]);

  const stop = useCallback(async () => {
    const { conversation, generation } = stateRef.current;
    if (!conversation || !generation) return;
    const epoch = epochRef.current;
    try {
      await chatClient.stopTurn(conversation.conversation_id, generation);
    } catch (error) {
      if (epochRef.current !== epoch || stateRef.current.generation?.attempt_id !== generation.attempt_id) return;
      update({ error });
      void syncRef.current();
    }
  }, [update]);

  const remove = useCallback(
    async (conversationId: string) => {
      await chatClient.deleteConversation(conversationId);
      if (stateRef.current.conversation?.conversation_id === conversationId) reset();
    },
    [reset],
  );

  const dismissError = useCallback(() => update({ error: null }), [update]);

  // Open on the latest conversation of the scope, resuming its answer if one is
  // being written (a reload in the middle of a stream picks it back up).
  useEffect(() => {
    // A new scope (the Digest shows one media after another in the same view):
    // drop the previous one's transport and state. The state is not set here —
    // `key` makes a render of the new scope read as empty until it is written.
    epochRef.current += 1;
    const epoch = epochRef.current;
    sendingRef.current = false;
    lastStreamRef.current = 0;
    disconnect();
    stateRef.current = { ...EMPTY, key };
    let cancelled = false;
    chatClient
      .listConversations(scope, scopeId)
      .then((list) => {
        const latest: ChatConversationSummary | undefined = list.conversations[0];
        if (!cancelled && latest && epochRef.current === epoch && !stateRef.current.conversation && !stateRef.current.pending) {
          void select(latest.conversation_id);
        }
      })
      .catch(() => {
        // No history to resume: the pane opens on a new conversation.
      });
    return () => {
      cancelled = true;
      epochRef.current += 1;
      disconnect();
    };
  }, [key, scope, scopeId, select, disconnect]);

  return { state: state.key === key ? state : { ...EMPTY, key }, send, stop, select, newConversation: reset, remove, cancelPending, dismissError };
}
