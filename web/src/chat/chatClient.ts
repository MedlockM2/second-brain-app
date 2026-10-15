import { createHttpError, parseErrorResponse } from "@media-summarizer/core/api/httpError";
import { parseSseBlock } from "@media-summarizer/core/chat/sse";
import type {
  ChatConversationDetail,
  ChatConversationList,
  ChatGeneration,
  ChatScope,
  ChatStreamEvent,
  ChatTurnAccepted,
} from "@media-summarizer/core/types/chat";
import { apiRequest, sendAuthenticated } from "../api";
import { Config } from "../config";

/** What opening the stream answered before any event. */
export type ChatStreamOpening =
  /** 200: events followed until the end, a reconnect or a drop. */
  | { kind: "streaming" }
  /** 204: no generation in flight — read the conversation for the final answer. */
  | { kind: "idle" }
  /** 409 generation_stale: another generation is live, here it is. */
  | { kind: "stale"; live: ChatGeneration }
  /** No stream URL in this build, or the stream could not be opened. */
  | { kind: "unavailable"; error?: unknown };

const conversationPath = (conversationId: string) => `/api/chat/conversations/${encodeURIComponent(conversationId)}`;

/**
 * The web chat's network layer, the same routes as the mobile `ChatService`
 * (docs/CANONICAL_MEDIA_API_CONTRACT.md, "Chat conversations" and "Chat
 * stream"). REST calls go to the main API under /api/chat; the answer is followed
 * on the separate streaming door with `fetch` and a `ReadableStream`, carrying
 * `Authorization: Bearer` — `EventSource` cannot send a header.
 *
 * Nothing here stops a generation by itself. Aborting a stream is a disconnect;
 * only `stopTurn` asks the server to stop, and only an explicit click calls it.
 */
export const chatClient = {
  openConversation: (scope: ChatScope, scopeId: string) =>
    apiRequest<ChatConversationDetail>("/api/chat/conversations", {
      method: "POST",
      body: { scope, scope_id: scopeId },
    }),

  listConversations: (scope: ChatScope, scopeId: string, cursor?: string | null) => {
    const params = new URLSearchParams({ scope, scope_id: scopeId, limit: "20" });
    if (cursor) params.set("cursor", cursor);
    return apiRequest<ChatConversationList>(`/api/chat/conversations?${params.toString()}`);
  },

  getConversation: (conversationId: string) => apiRequest<ChatConversationDetail>(conversationPath(conversationId)),

  deleteConversation: (conversationId: string) =>
    apiRequest<void>(conversationPath(conversationId), { method: "DELETE" }),

  /** The same `clientRequestId` on a retry of one question: the server answers the turn it already made. */
  sendTurn: (conversationId: string, question: string, clientRequestId: string) =>
    apiRequest<ChatTurnAccepted>(`${conversationPath(conversationId)}/turns`, {
      method: "POST",
      body: { question, client_request_id: clientRequestId },
    }),

  stopTurn: (conversationId: string, generation: ChatGeneration) =>
    apiRequest<void>(`${conversationPath(conversationId)}/turns/${encodeURIComponent(generation.turn_id)}/stop`, {
      method: "POST",
      body: { attempt_id: generation.attempt_id },
    }),

  streamingAvailable: () => Config.CHAT_STREAM_URL.length > 0,

  /**
   * Open the stream of a conversation's live generation and read it until it
   * ends, the signal aborts or the connection drops. Events reach `onEvent`
   * while the promise is pending; a drop resolves normally after the last one,
   * and the caller resumes with the generation and the last sequence it holds.
   */
  async followStream(
    conversationId: string,
    resume: { generation: ChatGeneration | null; afterSeq: number },
    onEvent: (event: ChatStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatStreamOpening> {
    if (!chatClient.streamingAvailable()) return { kind: "unavailable" };
    const params = new URLSearchParams({ after_seq: String(resume.afterSeq) });
    if (resume.generation) {
      params.set("turn_id", resume.generation.turn_id);
      params.set("attempt_id", resume.generation.attempt_id);
    }
    const url = `${Config.CHAT_STREAM_URL}/chat/conversations/${encodeURIComponent(conversationId)}/stream?${params.toString()}`;

    let response: Response;
    try {
      response = await sendAuthenticated((accessToken) =>
        fetch(url, {
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${accessToken}` },
          signal,
        }),
      );
    } catch (error) {
      return signal.aborted ? { kind: "idle" } : { kind: "unavailable", error };
    }

    if (response.status === 204) return { kind: "idle" };
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as {
        detail?: Partial<ChatGeneration>;
      } | null;
      const live = body?.detail;
      if (live?.turn_id && live.attempt_id && typeof live.turn_index === "number") {
        return { kind: "stale", live: { turn_id: live.turn_id, turn_index: live.turn_index, attempt_id: live.attempt_id } };
      }
    }
    if (!response.ok || !response.body) {
      const { message, code, details } = await parseErrorResponse(response, "Chat stream could not be opened");
      return { kind: "unavailable", error: createHttpError(message, response.status, code, undefined, details) };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const event = parseSseBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (event) onEvent(event);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // A drop mid-stream, or the caller's abort: both resume from the cursor.
    } finally {
      reader.releaseLock();
    }
    return { kind: "streaming" };
  },
};
