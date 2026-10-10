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
import { ChatService } from "../services/chatService";
import type {
  ChatConversationDetail,
  ChatGeneration,
  ChatScope,
  ChatStreamEvent,
} from "../types/chat";
import { useAuth } from "./AuthContext";

/**
 * The chat's conversation controller (task-467), mounted above the navigation.
 *
 * Decision point 1 of docs/research/task-430-chatbot-architecture/README.md: the
 * conversation controller is shared by the media and the folder scope, and **the
 * navigation does not carry the lifetime of a generation**. So the state lives
 * here, keyed by scope, and a screen that comes back finds it as it was.
 *
 * Decision point 6, how an answer is followed:
 *
 * - the stream is opened with the generation identity and the last sequence held,
 *   and a fragment whose sequence is already held is dropped;
 * - `204` (nothing in flight) or a stream that cannot be opened → the conversation
 *   is read back; while a generation is still in flight and no stream can be held,
 *   it is read back every few seconds instead;
 * - back to the foreground, the durable state is read first, then the stream is
 *   resumed or the final answer taken from it;
 * - leaving a screen, going to the background or a dropped connection closes the
 *   stream and nothing else. **Only `stopGeneration`, an explicit user action,
 *   asks the server to stop.**
 */

export type ChatSessionPhase =
  /** Nothing in flight. */
  | "idle"
  /** Opening a conversation or sending a question. */
  | "sending"
  /** An answer is being written and followed on the stream. */
  | "streaming"
  /** An answer is in flight but followed by reading the conversation back. */
  | "polling";

export interface ChatSession {
  scope: ChatScope;
  scopeId: string;
  conversation: ChatConversationDetail | null;
  /** The generation being followed, if any. */
  generation: ChatGeneration | null;
  /** Text of the generation being followed, assembled from its fragments. */
  streamingText: string;
  /** Highest fragment sequence held for `generation`; -1 for none. */
  lastSeq: number;
  phase: ChatSessionPhase;
  /** The last refusal or failure of an action, for the screen to word. */
  error: unknown;
}

interface ChatSessionContextValue {
  getSession: (scope: ChatScope, scopeId: string) => ChatSession;
  /** Open a new conversation on the scope and make it the active one. */
  startConversation: (scope: ChatScope, scopeId: string) => Promise<ChatConversationDetail>;
  /** Make an existing conversation the active one, and resume it if it is generating. */
  selectConversation: (
    scope: ChatScope,
    scopeId: string,
    conversationId: string,
  ) => Promise<ChatConversationDetail>;
  /** Ask a question in the active conversation, opening one if there is none. */
  sendQuestion: (scope: ChatScope, scopeId: string, question: string) => Promise<void>;
  /** The explicit stop. The only path that calls the stop route. */
  stopGeneration: (scope: ChatScope, scopeId: string) => Promise<void>;
  /** Delete a conversation; forget it if it was the active one. */
  deleteConversation: (scope: ChatScope, scopeId: string, conversationId: string) => Promise<void>;
  /** Re-read the active conversation from the server. */
  refresh: (scope: ChatScope, scopeId: string) => Promise<void>;
  /** Forget the active conversation of a scope (a new one starts on the next question). */
  clearActive: (scope: ChatScope, scopeId: string) => void;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

/** How often a generation followed without a stream is read back. */
const POLL_INTERVAL_MS = 2_000;
/** How long a failed stream waits before being tried again while polling. */
const STREAM_RETRY_MS = 10_000;
/** Two stream openings in a row are at least this far apart. */
const MIN_RECONNECT_MS = 1_000;

const scopeKey = (scope: ChatScope, scopeId: string) => `${scope}:${scopeId}`;

const emptySession = (scope: ChatScope, scopeId: string): ChatSession => ({
  scope,
  scopeId,
  conversation: null,
  generation: null,
  streamingText: "",
  lastSeq: -1,
  phase: "idle",
  error: null,
});

/** Per-scope transport state, outside React state: it never renders. */
interface Follower {
  abort: AbortController | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  lastStreamAttempt: number;
  /** The id of the question being sent, kept for a retry of the same question. */
  pendingRequest: { question: string; clientRequestId: string } | null;
}

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const sessionsRef = useRef<Map<string, ChatSession>>(new Map());
  const followersRef = useRef<Map<string, Follower>>(new Map());
  const [, setVersion] = useState(0);

  const render = useCallback(() => setVersion((value) => value + 1), []);

  const getSession = useCallback(
    (scope: ChatScope, scopeId: string): ChatSession =>
      sessionsRef.current.get(scopeKey(scope, scopeId)) ?? emptySession(scope, scopeId),
    [],
  );

  const update = useCallback(
    (scope: ChatScope, scopeId: string, patch: Partial<ChatSession>) => {
      const key = scopeKey(scope, scopeId);
      const current = sessionsRef.current.get(key) ?? emptySession(scope, scopeId);
      sessionsRef.current.set(key, { ...current, ...patch });
      render();
    },
    [render],
  );

  const follower = useCallback((key: string): Follower => {
    let entry = followersRef.current.get(key);
    if (!entry) {
      entry = { abort: null, pollTimer: null, lastStreamAttempt: 0, pendingRequest: null };
      followersRef.current.set(key, entry);
    }
    return entry;
  }, []);

  /** Close the stream and stop polling. A disconnect: the server is not told. */
  const disconnect = useCallback(
    (key: string) => {
      const entry = follower(key);
      entry.abort?.abort();
      entry.abort = null;
      if (entry.pollTimer) clearTimeout(entry.pollTimer);
      entry.pollTimer = null;
    },
    [follower],
  );

  // The two functions below call each other through refs, so the latest
  // closures are always the ones scheduled.
  const syncRef = useRef<(scope: ChatScope, scopeId: string) => Promise<void>>(async () => {});
  const followRef = useRef<(scope: ChatScope, scopeId: string) => Promise<void>>(async () => {});

  /** Read the conversation back, then follow what is still in flight. */
  const sync = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      const session = getSession(scope, scopeId);
      const conversationId = session.conversation?.conversation_id;
      if (!conversationId) return;
      let detail: ChatConversationDetail;
      try {
        detail = await ChatService.getConversation(conversationId);
      } catch (error) {
        update(scope, scopeId, { error });
        schedulePoll(key, scope, scopeId);
        return;
      }
      const active = detail.active_generation ?? null;
      if (!active) {
        disconnect(key);
        update(scope, scopeId, {
          conversation: detail,
          generation: null,
          streamingText: "",
          lastSeq: -1,
          phase: "idle",
        });
        return;
      }
      const sameAttempt = session.generation?.attempt_id === active.attempt_id;
      update(scope, scopeId, {
        conversation: detail,
        generation: {
          turn_id: active.turn_id,
          turn_index: active.turn_index,
          attempt_id: active.attempt_id,
        },
        // A new attempt starts from nothing: never append it to another's text.
        streamingText: sameAttempt ? session.streamingText : "",
        lastSeq: sameAttempt ? session.lastSeq : -1,
      });
      await followRef.current(scope, scopeId);
    },
    // schedulePoll is a hoisted function declaration below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disconnect, getSession, update],
  );

  function schedulePoll(key: string, scope: ChatScope, scopeId: string) {
    const entry = follower(key);
    if (entry.pollTimer) clearTimeout(entry.pollTimer);
    entry.pollTimer = setTimeout(() => {
      entry.pollTimer = null;
      void syncRef.current(scope, scopeId);
    }, POLL_INTERVAL_MS);
  }

  const applyEvent = useCallback(
    (scope: ChatScope, scopeId: string, event: ChatStreamEvent) => {
      const session = getSession(scope, scopeId);
      switch (event.type) {
        case "fragment": {
          if (event.data.seq <= session.lastSeq) return; // already held
          update(scope, scopeId, {
            streamingText: session.streamingText + event.data.text,
            lastSeq: event.data.seq,
            phase: "streaming",
          });
          return;
        }
        case "replaced": {
          update(scope, scopeId, {
            generation: event.data,
            streamingText: "",
            lastSeq: -1,
          });
          return;
        }
        default:
          return;
      }
    },
    [getSession, update],
  );

  /** Open (or resume) the stream of the live generation, falling back on reads. */
  const follow = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      const session = getSession(scope, scopeId);
      const conversationId = session.conversation?.conversation_id;
      if (!conversationId || !session.generation) return;
      if (entry.abort) return; // already following

      // A stream that keeps failing (or dropping as soon as it opens) must not
      // turn into a tight reconnect loop: past a failure, reads take over and
      // the stream is tried again every STREAM_RETRY_MS.
      const now = Date.now();
      const wait = session.phase === "polling" ? STREAM_RETRY_MS : MIN_RECONNECT_MS;
      const mayStream =
        ChatService.streamingAvailable() && now - entry.lastStreamAttempt >= wait;
      if (!mayStream) {
        if (session.phase !== "polling") update(scope, scopeId, { phase: "polling" });
        schedulePoll(key, scope, scopeId);
        return;
      }
      entry.lastStreamAttempt = now;
      const controller = new AbortController();
      entry.abort = controller;
      update(scope, scopeId, { phase: "streaming" });

      let ended: ChatStreamEvent | null = null;
      const opening = await ChatService.followStream(
        conversationId,
        { generation: session.generation, afterSeq: session.lastSeq },
        {
          onEvent: (event) => {
            if (event.type === "end" || event.type === "reconnect" || event.type === "replaced") {
              ended = event;
            }
            applyEvent(scope, scopeId, event);
          },
        },
        controller.signal,
      );
      if (entry.abort === controller) entry.abort = null;
      if (controller.signal.aborted) return; // a disconnect we asked for

      const last = ended as ChatStreamEvent | null;
      if (opening.kind === "stale") {
        update(scope, scopeId, { generation: opening.live, streamingText: "", lastSeq: -1 });
        entry.lastStreamAttempt = 0; // a known generation to follow: no back-off
        await followRef.current(scope, scopeId);
        return;
      }
      if (opening.kind === "unavailable") {
        update(scope, scopeId, { phase: "polling" });
        schedulePoll(key, scope, scopeId);
        return;
      }
      if (last?.type === "reconnect" || last?.type === "replaced") {
        entry.lastStreamAttempt = 0; // asked to reconnect: no back-off
        await followRef.current(scope, scopeId);
        return;
      }
      // 204, an `end`, or a dropped connection: the durable state decides.
      await syncRef.current(scope, scopeId);
    },
    // schedulePoll is a hoisted function declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyEvent, follower, getSession, update],
  );

  syncRef.current = sync;
  followRef.current = follow;

  const startConversation = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      disconnect(key);
      update(scope, scopeId, { phase: "sending", error: null });
      try {
        const detail = await ChatService.openConversation(scope, scopeId);
        sessionsRef.current.set(key, { ...emptySession(scope, scopeId), conversation: detail });
        render();
        return detail;
      } catch (error) {
        update(scope, scopeId, { phase: "idle", error });
        throw error;
      }
    },
    [disconnect, render, update],
  );

  const selectConversation = useCallback(
    async (scope: ChatScope, scopeId: string, conversationId: string) => {
      const key = scopeKey(scope, scopeId);
      disconnect(key);
      const detail = await ChatService.getConversation(conversationId);
      sessionsRef.current.set(key, { ...emptySession(scope, scopeId), conversation: detail });
      render();
      await sync(scope, scopeId);
      return detail;
    },
    [disconnect, render, sync],
  );

  const sendQuestion = useCallback(
    async (scope: ChatScope, scopeId: string, question: string) => {
      const key = scopeKey(scope, scopeId);
      const entry = follower(key);
      let session = getSession(scope, scopeId);
      if (!session.conversation) {
        await startConversation(scope, scopeId);
        session = getSession(scope, scopeId);
      }
      const conversationId = session.conversation!.conversation_id;
      // The same question retried keeps its id, so the server answers with the
      // turn it already created instead of a second one.
      const pending =
        entry.pendingRequest?.question === question
          ? entry.pendingRequest
          : { question, clientRequestId: ChatService.newClientRequestId() };
      entry.pendingRequest = pending;
      update(scope, scopeId, { phase: "sending", error: null });
      try {
        const turn = await ChatService.sendTurn(conversationId, question, pending.clientRequestId);
        entry.pendingRequest = null;
        update(scope, scopeId, {
          generation: {
            turn_id: turn.turn_id,
            turn_index: turn.turn_index,
            attempt_id: turn.attempt_id,
          },
          streamingText: "",
          lastSeq: -1,
        });
      } catch (error) {
        update(scope, scopeId, { phase: "idle", error });
        throw error;
      }
      // Read the turn back (the question appears in the history), then follow it.
      await sync(scope, scopeId);
    },
    [follower, getSession, startConversation, sync, update],
  );

  const stopGeneration = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      const session = getSession(scope, scopeId);
      const conversationId = session.conversation?.conversation_id;
      if (!conversationId || !session.generation) return;
      try {
        await ChatService.stopTurn(conversationId, session.generation);
      } catch (error) {
        // generation_stale: the answer already ended or was replaced; the
        // durable state says which.
        update(scope, scopeId, { error });
        await sync(scope, scopeId);
      }
      // The stream carries the interrupted end; nothing else to do here.
    },
    [getSession, sync, update],
  );

  const deleteConversation = useCallback(
    async (scope: ChatScope, scopeId: string, conversationId: string) => {
      await ChatService.deleteConversation(conversationId);
      const session = getSession(scope, scopeId);
      if (session.conversation?.conversation_id === conversationId) {
        disconnect(scopeKey(scope, scopeId));
        sessionsRef.current.set(scopeKey(scope, scopeId), emptySession(scope, scopeId));
        render();
      }
    },
    [disconnect, getSession, render],
  );

  const refresh = useCallback(
    async (scope: ChatScope, scopeId: string) => {
      await sync(scope, scopeId);
    },
    [sync],
  );

  const clearActive = useCallback(
    (scope: ChatScope, scopeId: string) => {
      const key = scopeKey(scope, scopeId);
      disconnect(key);
      sessionsRef.current.set(key, emptySession(scope, scopeId));
      render();
    },
    [disconnect, render],
  );

  // Background: close every stream (a disconnect). Foreground: read the durable
  // state of every scope with a conversation, then resume or take the answer.
  useEffect(() => {
    const handle = (state: AppStateStatus) => {
      if (state === "background") {
        for (const key of followersRef.current.keys()) disconnect(key);
        return;
      }
      if (state === "active") {
        for (const session of sessionsRef.current.values()) {
          if (session.conversation) void sync(session.scope, session.scopeId);
        }
      }
    };
    const subscription = AppState.addEventListener("change", handle);
    return () => subscription.remove();
  }, [disconnect, sync]);

  // Another account, or none: nothing of the previous one survives. Closing the
  // streams does not stop their answers.
  useEffect(() => {
    const followers = followersRef.current;
    const sessions = sessionsRef.current;
    return () => {
      for (const key of followers.keys()) disconnect(key);
      followers.clear();
      sessions.clear();
    };
  }, [user?.id, disconnect]);

  const value = useMemo<ChatSessionContextValue>(
    () => ({
      getSession,
      startConversation,
      selectConversation,
      sendQuestion,
      stopGeneration,
      deleteConversation,
      refresh,
      clearActive,
    }),
    [
      getSession,
      startConversation,
      selectConversation,
      sendQuestion,
      stopGeneration,
      deleteConversation,
      refresh,
      clearActive,
    ],
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

function useChatSessionContext(): ChatSessionContextValue {
  const context = useContext(ChatSessionContext);
  if (!context) {
    throw new Error("useChatSession must be used inside ChatSessionProvider");
  }
  return context;
}

/**
 * The chat of one scope — a media or a folder — with its actions bound.
 *
 * Re-renders when any session changes; the controller is shared, the screen only
 * reads its own scope.
 */
export function useChatSession(scope: ChatScope, scopeId: string) {
  const context = useChatSessionContext();
  const session = context.getSession(scope, scopeId);
  return {
    session,
    startConversation: () => context.startConversation(scope, scopeId),
    selectConversation: (conversationId: string) =>
      context.selectConversation(scope, scopeId, conversationId),
    sendQuestion: (question: string) => context.sendQuestion(scope, scopeId, question),
    stopGeneration: () => context.stopGeneration(scope, scopeId),
    deleteConversation: (conversationId: string) =>
      context.deleteConversation(scope, scopeId, conversationId),
    refresh: () => context.refresh(scope, scopeId),
    clearActive: () => context.clearActive(scope, scopeId),
  };
}
