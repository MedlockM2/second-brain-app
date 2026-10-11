import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { ChatService, type ChatStreamOpening } from "../services/chatService";
import type {
  ChatConversationDetail,
  ChatGeneration,
  ChatScope,
  ChatStreamEvent,
} from "@media-summarizer/core/types/chat";
import { useAuth } from "./AuthContext";

/**
 * Shared by the media and folder chat, above navigation (task-467, task-497).
 * React receives a new session snapshot on every change, including fragments.
 * Refs keep synchronous access for transports and the pre-network send lock.
 * Leaving a screen or backgrounding only disconnects: only stopGeneration asks
 * the server to stop. Reconnects resume the same generation after the last seq.
 */
export type ChatSessionPhase = "idle" | "sending" | "streaming" | "polling";

export interface PendingChatQuestion {
  question: string;
  clientRequestId: string;
  createdAt: string;
  status: "sending" | "failed";
}

export interface ChatSession {
  scope: ChatScope;
  scopeId: string;
  conversation: ChatConversationDetail | null;
  /** Local until accepted; a failed send retains its id for an uncertain retry. */
  pendingQuestion: PendingChatQuestion | null;
  generation: ChatGeneration | null;
  streamingText: string;
  lastSeq: number;
  phase: ChatSessionPhase;
  error: unknown;
}

interface ChatSessionContextValue {
  sessions: ReadonlyMap<string, ChatSession>;
  selectConversation: (scope: ChatScope, scopeId: string, conversationId: string) => Promise<void>;
  /** Resolves at acceptance, never waits for generation; false on failure or a superseded send. */
  sendQuestion: (scope: ChatScope, scopeId: string, question: string) => Promise<boolean>;
  stopGeneration: (scope: ChatScope, scopeId: string) => Promise<void>;
  deleteConversation: (scope: ChatScope, scopeId: string, conversationId: string) => Promise<void>;
  refresh: (scope: ChatScope, scopeId: string) => Promise<void>;
  clearActive: (scope: ChatScope, scopeId: string) => void;
  dismissError: (scope: ChatScope, scopeId: string) => void;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);
const EMPTY_SESSIONS: ReadonlyMap<string, ChatSession> = new Map();
const POLL_INTERVAL_MS = 2_000;
const STREAM_RETRY_MS = 10_000;
const MIN_RECONNECT_MS = 1_000;
const scopeKey = (scope: ChatScope, scopeId: string) => `${scope}:${scopeId}`;

const emptySession = (scope: ChatScope, scopeId: string): ChatSession => ({
  scope,
  scopeId,
  conversation: null,
  pendingQuestion: null,
  generation: null,
  streamingText: "",
  lastSeq: -1,
  phase: "idle",
  error: null,
});

/** Per-scope transport state: none of this is rendered. */
interface Follower {
  abort: AbortController | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  lastStreamAttempt: number;
  /** Invalidates operations when the active conversation changes. */
  epoch: number;
  /** Only the latest conversation read may publish its result. */
  readVersion: number;
  sending: boolean;
}

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const accountId = user?.id;
  const sessionsRef = useRef<Map<string, ChatSession>>(new Map());
  const followersRef = useRef<Map<string, Follower>>(new Map());
  const appStateRef = useRef(AppState.currentState);
  const [snapshot, setSnapshot] = useState(() => ({ accountId, sessions: EMPTY_SESSIONS }));

  const publish = useCallback(() => {
    setSnapshot({ accountId, sessions: new Map(sessionsRef.current) });
  }, [accountId]);

  const getSession = useCallback(
    (scope: ChatScope, scopeId: string): ChatSession =>
      sessionsRef.current.get(scopeKey(scope, scopeId)) ?? emptySession(scope, scopeId),
    [],
  );

  const update = useCallback(
    (scope: ChatScope, scopeId: string, patch: Partial<ChatSession>) => {
      const key = scopeKey(scope, scopeId);
      const current = getSession(scope, scopeId);
      sessionsRef.current.set(key, { ...current, ...patch });
      publish();
    },
    [getSession, publish],
  );

  const follower = useCallback((key: string): Follower => {
    let entry = followersRef.current.get(key);
    if (!entry) {
      entry = {
        abort: null,
        pollTimer: null,
        lastStreamAttempt: 0,
        epoch: 0,
        readVersion: 0,
        sending: false,
      };
      followersRef.current.set(key, entry);
    }
    return entry;
  }, []);

  const isCurrent = useCallback(
    (key: string, entry: Follower, epoch: number) =>
      followersRef.current.get(key) === entry && entry.epoch === epoch,
    [],
  );

  /** A transport disconnect, never a server-side stop. */
  const disconnect = useCallback((key: string) => {
    const entry = followersRef.current.get(key);
    if (!entry) return;
    entry.abort?.abort();
    entry.abort = null;
    if (entry.pollTimer) clearTimeout(entry.pollTimer);
    entry.pollTimer = null;
  }, []);

  const reset = useCallback(
    (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      entry.epoch += 1;
      entry.readVersion += 1;
      entry.sending = false;
      entry.lastStreamAttempt = 0;
      disconnect(key);
      sessionsRef.current.set(key, emptySession(scope, scopeId));
      publish();
      return entry;
    },
    [disconnect, follower, publish],
  );

  const syncRef = useRef<(scope: ChatScope, scopeId: string) => Promise<void>>(async () => {});
  const followRef = useRef<(scope: ChatScope, scopeId: string) => Promise<void>>(async () => {});

  const schedulePoll = useCallback(
    (scope: ChatScope, scopeId: string) => {
      if (appStateRef.current === "background") return;
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      const epoch = entry.epoch;
      if (entry.pollTimer) clearTimeout(entry.pollTimer);
      entry.pollTimer = setTimeout(() => {
        entry.pollTimer = null;
        if (isCurrent(key, entry, epoch)) void syncRef.current(scope, scopeId);
      }, POLL_INTERVAL_MS);
    },
    [follower, isCurrent],
  );

  /** Reconcile durable state, then start following without awaiting the stream. */
  const sync = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      const session = getSession(scope, scopeId);
      const conversationId = session.conversation?.conversation_id;
      // An uncertain send is reconciled by retrying its request id, not by
      // matching question text against older, potentially identical questions.
      if (!conversationId || session.pendingQuestion || appStateRef.current === "background")
        return;
      const entry = follower(key);
      const epoch = entry.epoch;
      const readVersion = ++entry.readVersion;
      const ownsRead = () => isCurrent(key, entry, epoch) && entry.readVersion === readVersion;
      let detail: ChatConversationDetail;
      try {
        detail = await ChatService.getConversation(conversationId);
      } catch (error) {
        if (!ownsRead()) return;
        update(scope, scopeId, { error });
        schedulePoll(scope, scopeId);
        return;
      }
      if (!ownsRead()) return;
      // Fragments may have arrived while the read was pending: preserve the
      // latest text and cursor, not the snapshot taken before the request.
      const current = getSession(scope, scopeId);
      const active = detail.active_generation ?? null;
      if (!active) {
        disconnect(key);
        update(scope, scopeId, {
          conversation: detail,
          generation: null,
          streamingText: "",
          lastSeq: -1,
          phase: "idle",
          error: null,
        });
        return;
      }
      const sameAttempt =
        current.generation?.attempt_id === active.attempt_id &&
        current.generation?.turn_id === active.turn_id;
      if (!sameAttempt) disconnect(key);
      update(scope, scopeId, {
        conversation: detail,
        generation: {
          turn_id: active.turn_id,
          turn_index: active.turn_index,
          attempt_id: active.attempt_id,
        },
        streamingText: sameAttempt ? current.streamingText : "",
        lastSeq: sameAttempt ? current.lastSeq : -1,
        error: null,
      });
      void followRef.current(scope, scopeId);
    },
    [disconnect, follower, getSession, isCurrent, schedulePoll, update],
  );

  const applyEvent = useCallback(
    (scope: ChatScope, scopeId: string, event: ChatStreamEvent) => {
      const session = getSession(scope, scopeId);
      if (event.type !== "fragment" || event.data.seq <= session.lastSeq) return;
      update(scope, scopeId, {
        streamingText: session.streamingText + event.data.text,
        lastSeq: event.data.seq,
        phase: "streaming",
      });
    },
    [getSession, update],
  );

  const follow = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      const session = getSession(scope, scopeId);
      const conversationId = session.conversation?.conversation_id;
      const generation = session.generation;
      if (!conversationId || !generation || entry.abort || appStateRef.current === "background")
        return;
      const epoch = entry.epoch;
      const ownsGeneration = () => {
        const current = getSession(scope, scopeId);
        return (
          isCurrent(key, entry, epoch) &&
          current.conversation?.conversation_id === conversationId &&
          current.generation?.turn_id === generation.turn_id &&
          current.generation?.attempt_id === generation.attempt_id
        );
      };
      const now = Date.now();
      const wait = session.phase === "polling" ? STREAM_RETRY_MS : MIN_RECONNECT_MS;
      if (!ChatService.streamingAvailable() || now - entry.lastStreamAttempt < wait) {
        update(scope, scopeId, { phase: "polling" });
        schedulePoll(scope, scopeId);
        return;
      }
      entry.lastStreamAttempt = now;
      const controller = new AbortController();
      entry.abort = controller;
      update(scope, scopeId, { phase: "streaming" });

      let ended: ChatStreamEvent | null = null;
      let opening: ChatStreamOpening;
      try {
        opening = await ChatService.followStream(
          conversationId,
          { generation, afterSeq: session.lastSeq },
          {
            onEvent: (event) => {
              if (controller.signal.aborted || entry.abort !== controller || !ownsGeneration())
                return;
              if (event.type === "end" || event.type === "reconnect") ended = event;
              applyEvent(scope, scopeId, event);
            },
          },
          controller.signal,
        );
      } catch (error) {
        opening = { kind: "unavailable", error };
      }
      if (entry.abort === controller) entry.abort = null;
      if (controller.signal.aborted || !ownsGeneration()) return;

      const last = ended as ChatStreamEvent | null;
      if (opening.kind === "stale") {
        update(scope, scopeId, { generation: opening.live, streamingText: "", lastSeq: -1 });
        entry.lastStreamAttempt = 0;
        void syncRef.current(scope, scopeId);
      } else if (opening.kind === "unavailable") {
        update(scope, scopeId, { phase: "polling" });
        schedulePoll(scope, scopeId);
      } else if (last?.type === "reconnect") {
        entry.lastStreamAttempt = 0;
        void followRef.current(scope, scopeId);
      } else {
        // End, idle or a dropped connection: durable state decides what follows.
        void syncRef.current(scope, scopeId);
      }
    },
    [applyEvent, follower, getSession, isCurrent, schedulePoll, update],
  );

  // Assign after commit; the transport callbacks always use the latest account.
  useEffect(() => {
    syncRef.current = sync;
    followRef.current = follow;
  }, [sync, follow]);

  const selectConversation = useCallback(
    async (scope: ChatScope, scopeId: string, conversationId: string) => {
      const key = scopeKey(scope, scopeId);
      const entry = reset(scope, scopeId);
      const epoch = entry.epoch;
      update(scope, scopeId, { phase: "sending" });
      try {
        const detail = await ChatService.getConversation(conversationId);
        if (!isCurrent(key, entry, epoch)) return;
        update(scope, scopeId, {
          conversation: detail,
          generation: detail.active_generation ?? null,
          phase: detail.active_generation ? "streaming" : "idle",
        });
        if (detail.active_generation) void followRef.current(scope, scopeId);
      } catch (error) {
        if (isCurrent(key, entry, epoch)) update(scope, scopeId, { phase: "idle", error });
      }
    },
    [isCurrent, reset, update],
  );

  const sendQuestion = useCallback(
    async (scope: ChatScope, scopeId: string, question: string) => {
      question = question.trim();
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      const session = getSession(scope, scopeId);
      if (!question || entry.sending || session.generation || session.phase === "sending")
        return false;
      // Close the same-tick double-tap window before the first await, including
      // when opening the first conversation. Invalidate older reads as well.
      const epoch = entry.epoch;
      const pending: PendingChatQuestion =
        session.pendingQuestion?.question === question
          ? { ...session.pendingQuestion, status: "sending" }
          : {
              question,
              clientRequestId: ChatService.newClientRequestId(),
              createdAt: new Date().toISOString(),
              status: "sending",
            };
      entry.sending = true;
      entry.readVersion += 1;
      update(scope, scopeId, { phase: "sending", pendingQuestion: pending, error: null });
      try {
        let conversation = session.conversation;
        if (!conversation) {
          conversation = await ChatService.openConversation(scope, scopeId);
          if (!isCurrent(key, entry, epoch)) return false;
          update(scope, scopeId, { conversation });
        }
        const turn = await ChatService.sendTurn(
          conversation.conversation_id,
          question,
          pending.clientRequestId,
        );
        if (!isCurrent(key, entry, epoch)) return false;
        // Adopt the server identity immediately. The next durable read replaces
        // these local messages; do not wait for that extra round trip to render.
        const current = getSession(scope, scopeId).conversation!;
        const messages = current.messages.some((message) => message.turn_id === turn.turn_id)
          ? current.messages
          : [
              ...current.messages,
              {
                turn_id: turn.turn_id,
                turn_index: turn.turn_index,
                role: "user" as const,
                text: question,
                created_at: pending.createdAt,
              },
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
        const generation = {
          turn_id: turn.turn_id,
          turn_index: turn.turn_index,
          attempt_id: turn.attempt_id,
        };
        update(scope, scopeId, {
          conversation: {
            ...current,
            messages,
            turn_count: Math.max(current.turn_count, turn.turn_index),
            generating: true,
            active_generation: generation,
            last_turn_status: turn.status,
          },
          pendingQuestion: null,
          generation,
          streamingText: "",
          lastSeq: -1,
          phase: "streaming",
          error: null,
        });
        entry.lastStreamAttempt = 0;
        void followRef.current(scope, scopeId);
        return true;
      } catch (error) {
        if (isCurrent(key, entry, epoch)) {
          update(scope, scopeId, {
            phase: "idle",
            pendingQuestion: { ...pending, status: "failed" },
            error,
          });
        }
        return false;
      } finally {
        if (isCurrent(key, entry, epoch)) entry.sending = false;
      }
    },
    [follower, getSession, isCurrent, update],
  );

  const stopGeneration = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const session = getSession(scope, scopeId);
      const conversationId = session.conversation?.conversation_id;
      const generation = session.generation;
      if (!conversationId || !generation) return;
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      const epoch = entry.epoch;
      try {
        await ChatService.stopTurn(conversationId, generation);
      } catch (error) {
        if (
          !isCurrent(key, entry, epoch) ||
          getSession(scope, scopeId).generation?.attempt_id !== generation.attempt_id
        )
          return;
        update(scope, scopeId, { error });
        void syncRef.current(scope, scopeId);
      }
    },
    [follower, getSession, isCurrent, update],
  );

  const deleteConversation = useCallback(
    async (scope: ChatScope, scopeId: string, conversationId: string) => {
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      const epoch = entry.epoch;
      try {
        await ChatService.deleteConversation(conversationId);
        if (
          isCurrent(key, entry, epoch) &&
          getSession(scope, scopeId).conversation?.conversation_id === conversationId
        ) {
          reset(scope, scopeId);
        }
      } catch (error) {
        if (isCurrent(key, entry, epoch)) update(scope, scopeId, { error });
        throw error; // The history list owns its delete dialog.
      }
    },
    [follower, getSession, isCurrent, reset, update],
  );

  const dismissError = useCallback(
    (scope: ChatScope, scopeId: string) => {
      update(scope, scopeId, { error: null });
    },
    [update],
  );

  useEffect(() => {
    const handle = (state: AppStateStatus) => {
      appStateRef.current = state;
      if (state === "background") {
        for (const [key, entry] of followersRef.current) {
          entry.readVersion += 1;
          disconnect(key);
        }
      } else if (state === "active") {
        for (const session of sessionsRef.current.values()) {
          if (session.conversation) void syncRef.current(session.scope, session.scopeId);
        }
      }
    };
    const subscription = AppState.addEventListener("change", handle);
    return () => subscription.remove();
  }, [disconnect]);

  useEffect(() => {
    const followers = followersRef.current;
    const sessions = sessionsRef.current;
    return () => {
      for (const key of followers.keys()) disconnect(key);
      followers.clear();
      sessions.clear();
    };
  }, [accountId, disconnect]);

  const value = useMemo<ChatSessionContextValue>(
    () => ({
      // Hide the previous account's snapshot on the first render of a new one,
      // before the cleanup effect clears its transports and synchronous state.
      sessions: snapshot.accountId === accountId ? snapshot.sessions : EMPTY_SESSIONS,
      selectConversation,
      sendQuestion,
      stopGeneration,
      deleteConversation,
      refresh: sync,
      clearActive: reset,
      dismissError,
    }),
    [
      accountId,
      snapshot,
      selectConversation,
      sendQuestion,
      stopGeneration,
      deleteConversation,
      sync,
      reset,
      dismissError,
    ],
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(scope: ChatScope, scopeId: string) {
  const context = useContext(ChatSessionContext);
  if (!context) throw new Error("useChatSession must be used inside ChatSessionProvider");
  const session = context.sessions.get(scopeKey(scope, scopeId)) ?? emptySession(scope, scopeId);
  return {
    session,
    selectConversation: (conversationId: string) =>
      context.selectConversation(scope, scopeId, conversationId),
    sendQuestion: (question: string) => context.sendQuestion(scope, scopeId, question),
    stopGeneration: () => context.stopGeneration(scope, scopeId),
    deleteConversation: (conversationId: string) =>
      context.deleteConversation(scope, scopeId, conversationId),
    refresh: () => context.refresh(scope, scopeId),
    clearActive: () => context.clearActive(scope, scopeId),
    dismissError: () => context.dismissError(scope, scopeId),
  };
}
