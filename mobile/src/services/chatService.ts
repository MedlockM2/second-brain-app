import { fetch as expoFetch } from "expo/fetch";
import * as Crypto from "expo-crypto";
import { Config } from "../constants/config";
import { createHttpError, parseErrorResponse } from "@media-summarizer/core/api/httpError";
import { parseSseBlock } from "@media-summarizer/core/chat/sse";
import { apiRequest, sendAuthenticated } from "./apiClient";
import type {
  ChatConversationDetail,
  ChatConversationList,
  ChatGeneration,
  ChatScope,
  ChatStreamEvent,
  ChatTurnAccepted,
} from "@media-summarizer/core/types/chat";

/** What opening the stream answered before any event. */
export type ChatStreamOpening =
  /** 200: events follow. */
  | { kind: "streaming" }
  /** 204: no generation in flight — read the conversation for the final answer. */
  | { kind: "idle" }
  /** 409 generation_stale: another generation is live, here it is. */
  | { kind: "stale"; live: ChatGeneration }
  /** No stream URL in this build, or the stream could not be opened. */
  | { kind: "unavailable"; error?: unknown };

export interface ChatStreamHandlers {
  onEvent: (event: ChatStreamEvent) => void;
}

/**
 * The chat's network layer (task-467).
 *
 * REST calls go to the main API under /api/chat through `apiRequest`; the answer
 * is followed on the separate streaming door (`Config.CHAT_STREAM_URL`) with
 * `expo/fetch`, whose response body is a readable stream in React Native — the
 * global `fetch` buffers the whole response. No other dependency.
 *
 * Nothing here stops a generation by itself. Closing a stream (`abort`) is a
 * disconnect; only `stopTurn` asks the server to stop, and only an explicit user
 * action may call it.
 */
export class ChatService {
  /** POST /api/chat/conversations — sources frozen now. */
  static async openConversation(
    scope: ChatScope,
    scopeId: string,
  ): Promise<ChatConversationDetail> {
    return apiRequest<ChatConversationDetail>("/api/chat/conversations", {
      method: "POST",
      body: { scope, scope_id: scopeId },
    });
  }

  /** GET /api/chat/conversations?scope=&scope_id= — latest activity first. */
  static async listConversations(
    scope: ChatScope,
    scopeId: string,
    options: { limit?: number; cursor?: string | null } = {},
  ): Promise<ChatConversationList> {
    const params = new URLSearchParams({ scope, scope_id: scopeId });
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    return apiRequest<ChatConversationList>(
      `/api/chat/conversations?${params.toString()}`,
    );
  }

  /** GET /api/chat/conversations/{id} — messages in order, live generation. */
  static async getConversation(
    conversationId: string,
  ): Promise<ChatConversationDetail> {
    return apiRequest<ChatConversationDetail>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
    );
  }

  /** DELETE /api/chat/conversations/{id}. */
  static async deleteConversation(conversationId: string): Promise<void> {
    await apiRequest<void>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      { method: "DELETE" },
    );
  }

  /**
   * A fresh id for one question. Sent again unchanged on a retry of the same
   * question, so the server answers with the turn it already created.
   */
  static newClientRequestId(): string {
    return Crypto.randomUUID();
  }

  /** POST /api/chat/conversations/{id}/turns. */
  static async sendTurn(
    conversationId: string,
    question: string,
    clientRequestId: string,
  ): Promise<ChatTurnAccepted> {
    return apiRequest<ChatTurnAccepted>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/turns`,
      {
        method: "POST",
        body: { question, client_request_id: clientRequestId },
      },
    );
  }

  /**
   * POST /api/chat/conversations/{id}/turns/{turn_id}/stop — the explicit stop.
   *
   * Never call this from a cleanup (an unmount, a blur, a background
   * transition): leaving a screen is a disconnect, and the answer goes on.
   */
  static async stopTurn(
    conversationId: string,
    generation: ChatGeneration,
  ): Promise<void> {
    await apiRequest<void>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(generation.turn_id)}/stop`,
      { method: "POST", body: { attempt_id: generation.attempt_id } },
    );
  }

  /** Whether this build knows where the streaming door is. */
  static streamingAvailable(): boolean {
    return Config.CHAT_STREAM_URL.length > 0;
  }

  /**
   * Open the stream of a conversation's live generation and read it until it
   * ends, the signal aborts, or the connection drops.
   *
   * Resolves with how the opening went; events are delivered to `onEvent` while
   * the promise is pending. A dropped connection resolves normally after the
   * last event: the caller resumes with the generation and the last sequence it
   * holds.
   */
  static async followStream(
    conversationId: string,
    resume: { generation?: ChatGeneration | null; afterSeq: number },
    handlers: ChatStreamHandlers,
    signal: AbortSignal,
  ): Promise<ChatStreamOpening> {
    if (!ChatService.streamingAvailable()) {
      return { kind: "unavailable" };
    }
    const params = new URLSearchParams({ after_seq: String(resume.afterSeq) });
    if (resume.generation) {
      params.set("turn_id", resume.generation.turn_id);
      params.set("attempt_id", resume.generation.attempt_id);
    }
    const url = `${Config.CHAT_STREAM_URL}/chat/conversations/${encodeURIComponent(conversationId)}/stream?${params.toString()}`;

    let response: Awaited<ReturnType<typeof expoFetch>>;
    try {
      response = await sendAuthenticated((accessToken) =>
        expoFetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
        }),
      );
    } catch (error) {
      if (signal.aborted) return { kind: "idle" };
      return { kind: "unavailable", error };
    }

    if (response.status === 204) {
      return { kind: "idle" };
    }
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as {
        detail?: Partial<ChatGeneration> & { error_code?: string };
      } | null;
      const live = body?.detail;
      if (live?.turn_id && live.attempt_id && typeof live.turn_index === "number") {
        return {
          kind: "stale",
          live: {
            turn_id: live.turn_id,
            turn_index: live.turn_index,
            attempt_id: live.attempt_id,
          },
        };
      }
    }
    if (!response.ok || !response.body) {
      const { message, code, details } = await parseErrorResponse(
        response as unknown as Response,
        "Chat stream could not be opened",
      );
      return {
        kind: "unavailable",
        error: createHttpError(message, response.status, code, undefined, details),
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = parseSseBlock(block);
          if (event) handlers.onEvent(event);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      // A drop mid-stream, or the caller's abort: both resume from the cursor.
      if (!signal.aborted) {
        return { kind: "streaming" };
      }
    } finally {
      reader.releaseLock();
    }
    return { kind: "streaming" };
  }
}
