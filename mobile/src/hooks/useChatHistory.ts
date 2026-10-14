import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ChatService, type ChatHistoryWindow } from "../services/chatService";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { resourceKeys } from "../services/resourceCache";
import { isResourceSuperseded } from "@media-summarizer/core/cache/resourceCache";
import type {
  ChatConversationSummary,
  ChatScope,
} from "@media-summarizer/core/types/chat";

const EMPTY: ChatConversationSummary[] = [];
/** The session owns history; the existing controller still owns messages/streaming. */
export function useChatHistory(
  scope: ChatScope,
  scopeId: string,
  active: boolean,
) {
  const snapshot = useResourceSnapshot<ChatHistoryWindow>(
    resourceKeys.historyWindow(scope, scopeId),
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const busy = useRef(false);
  const retryAfter = useRef<string | null>(null);
  const load = useCallback(
    async (after: string | null) => {
      if (after && busy.current) return;
      const request = ++requestId.current;
      busy.current = true;
      setLoading(true);
      setLoadingMore(after !== null);
      retryAfter.current = after;
      try {
        await ChatService.historyWindow(scope, scopeId, after);
      } catch (error) {
        if (isResourceSuperseded(error)) return;
      } finally {
        if (request === requestId.current) {
          busy.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [scope, scopeId],
  );
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const timer = setTimeout(() => void load(null), 0);
      return () => {
        clearTimeout(timer);
        requestId.current += 1;
        busy.current = false;
      };
    }, [active, load]),
  );
  // The successful DELETE has already removed the row from all cached windows.
  const remove = (_id: string) => {
    requestId.current += 1;
    busy.current = false;
    setLoading(false);
    setLoadingMore(false);
  };
  return {
    items: snapshot.data?.conversations ?? EMPTY,
    cursor: snapshot.data?.next_cursor ?? null,
    loading: loading || (!snapshot.data && !snapshot.error),
    loadingMore,
    initialized: snapshot.data !== undefined,
    failed: Boolean(snapshot.error),
    load,
    remove,
    retry: () => load(retryAfter.current),
  };
}
export type ChatHistoryState = ReturnType<typeof useChatHistory>;
