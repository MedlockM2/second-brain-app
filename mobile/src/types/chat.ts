/**
 * Wire types of the chat (task-467), from docs/CANONICAL_MEDIA_API_CONTRACT.md,
 * section "Chat conversations" (the REST routes under /api/chat) and "Chat
 * stream" (the SSE door).
 *
 * A conversation covers one media or one folder, like an artifact; its sources
 * are frozen when it is opened. A turn is a question and its answer; the answer
 * is generated asynchronously and followed on the stream.
 */

import type { ArtifactScope } from "./artifacts";

/** A conversation covers what an artifact covers. */
export type ChatScope = ArtifactScope;

/**
 * State of a turn, carried by its answer.
 *
 * `interrupted` is an answer that stopped before its end and keeps what it
 * produced, always with a cause: `cancelled` (the user stopped it),
 * `output_limit` (the answer hit the output ceiling) or `provider_error` (the
 * provider failed after part of the answer was shown — a partial failure).
 * `failed` is a turn with no answer to show.
 */
export type ChatTurnStatus =
  | "accepted"
  | "generating"
  | "completed"
  | "failed"
  | "interrupted";

export type ChatInterruptionCause = "cancelled" | "output_limit" | "provider_error";

export const TERMINAL_TURN_STATUSES: readonly ChatTurnStatus[] = [
  "completed",
  "failed",
  "interrupted",
];

export interface ChatSource {
  /** The citable tag of the source, `[S1]` … — what an answer cites. */
  ref: string;
  media_item_id: string;
  title?: string | null;
  language?: string | null;
  excluded: boolean;
  excluded_reason?: string | null;
}

export interface ChatConversationSummary {
  conversation_id: string;
  scope: ChatScope;
  scope_id: string;
  /** The first question, cut; null before the first turn. */
  title?: string | null;
  turn_count: number;
  last_turn_status?: ChatTurnStatus | null;
  /** A turn of this conversation is in flight. */
  generating: boolean;
  created_at: string;
  last_activity_at: string;
}

export interface ChatConversationList {
  scope: ChatScope;
  scope_id: string;
  conversations: ChatConversationSummary[];
  next_cursor?: string | null;
}

export interface ChatMessage {
  turn_id: string;
  turn_index: number;
  role: "user" | "assistant";
  text?: string | null;
  created_at: string;
  /** Assistant messages only. */
  status?: ChatTurnStatus | null;
  interruption_cause?: ChatInterruptionCause | null;
  error_code?: string | null;
  attempt_id?: string | null;
  attempt_count?: number | null;
  completed_at?: string | null;
}

/**
 * The generation identity: the turn, and the attempt allowed to produce its
 * answer. A newer attempt of the same turn starts from nothing.
 */
export interface ChatGeneration {
  turn_id: string;
  turn_index: number;
  attempt_id: string;
}

export interface ChatActiveGeneration extends ChatGeneration {
  /** Highest fragment sequence persisted; null before the first. */
  last_seq?: number | null;
}

export interface ChatConversationDetail extends ChatConversationSummary {
  source_snapshot_version: string;
  sources: ChatSource[];
  messages: ChatMessage[];
  active_generation?: ChatActiveGeneration | null;
}

export interface ChatTurnAccepted extends ChatGeneration {
  conversation_id: string;
  status: ChatTurnStatus;
  minutes_debited: number;
  /** The request was a retry of a turn already accepted. */
  replayed: boolean;
}

/**
 * Typed refusals of the chat routes (`detail.error_code`), besides the quota
 * refusals `out_of_minutes` / `item_too_long` every consuming route shares.
 */
export type ChatErrorCode =
  | "invalid_scope"
  | "scope_not_found"
  | "scope_preparing"
  | "scope_empty"
  | "scope_too_large"
  | "invalid_cursor"
  | "conversation_not_found"
  | "question_too_long"
  | "conversation_full"
  | "turn_in_flight"
  | "turn_count_changed"
  | "context_budget_exceeded"
  | "generation_stale";

/** Events of the chat stream, as the SSE door sends them. */
export type ChatStreamEvent =
  | { type: "generation"; data: ChatGeneration }
  | { type: "fragment"; data: { seq: number; text: string } }
  | {
      type: "end";
      data: {
        turn_id: string;
        attempt_id: string;
        status: ChatTurnStatus | "deleted";
        interruption_cause?: ChatInterruptionCause | null;
        error_code?: string | null;
        last_seq?: number;
        text?: string | null;
      };
    }
  | { type: "replaced"; data: ChatGeneration }
  | { type: "reconnect"; data: { turn_id: string; attempt_id: string; after_seq: number } };
