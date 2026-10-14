import { useCallback, useEffect, useRef, useState } from "react";
import { ChatService } from "../services/chatService";
import type { ChatConversationSummary, ChatScope } from "@media-summarizer/core/types/chat";

/** Owned by the dock, so closing history or following a citation retains its list. */
export function useChatHistory(scope: ChatScope, scopeId: string, active: boolean) {
  const [items, setItems] = useState<ChatConversationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const busy = useRef(false);
  const pages = useRef(1);
  const retryAfter = useRef<string | null>(null);

  const load = useCallback(async (after: string | null) => {
    if (after && busy.current) return;
    const request = ++requestId.current;
    busy.current = true;
    setLoading(true);
    setLoadingMore(after !== null);
    setFailed(false);
    retryAfter.current = after;
    try {
      const fetched = new Map<string, ChatConversationSummary>();
      let next = after;
      let count = 0;
      do {
        const page = await ChatService.listConversations(scope, scopeId, { limit: 20, cursor: next });
        if (request !== requestId.current) return;
        page.conversations.forEach((item) => fetched.set(item.conversation_id, item));
        next = page.next_cursor ?? null;
        count += 1;
      } while (!after && next && count < pages.current);
      setItems((previous) => after
        ? [...new Map([...previous, ...fetched.values()].map((item) => [item.conversation_id, item])).values()]
        : [...fetched.values()]);
      pages.current = after ? pages.current + 1 : count;
      setCursor(next);
      setInitialized(true);
    } catch {
      if (request === requestId.current) setFailed(true);
    } finally {
      if (request === requestId.current) {
        busy.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [scope, scopeId]);

  useEffect(() => {
    if (!active) return;
    // Opening history refreshes its retained window without hiding the old list.
    const timer = setTimeout(() => void load(null), 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
      busy.current = false;
    };
  }, [active, load]);

  const remove = (id: string) => {
    requestId.current += 1;
    busy.current = false;
    setLoading(false);
    setLoadingMore(false);
    setItems((previous) => previous.filter((item) => item.conversation_id !== id));
  };
  return { items, cursor, loading, loadingMore, initialized, failed, load, remove, retry: () => load(retryAfter.current) };
}
export type ChatHistoryState = ReturnType<typeof useChatHistory>;
