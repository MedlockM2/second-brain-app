import { getFriendlyErrorMessage } from "@media-summarizer/core/errors/friendlyError";
import { t } from "@media-summarizer/core/i18n/runtime";
import type { MediaStatusResponse } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";

/**
 * A media and the job behind it, re-read every 3 s until the job ends — the
 * web counterpart of the mobile `useMediaDetailPolling`. Five minutes without
 * an end is a timeout, not a failure: the job may still finish, and `refresh`
 * starts a new wait.
 */
export type MediaDetailState = "loading" | "processing" | "completed" | "failed" | "timeout" | "error";

const POLL_MS = 3_000;
const TIMEOUT_MS = 5 * 60 * 1000;

export function useMediaDetail(mediaId: string) {
  const [data, setData] = useState<MediaStatusResponse | null>(null);
  const [state, setState] = useState<MediaDetailState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const startedAt = useRef(0);

  const read = useCallback(async (): Promise<MediaDetailState> => {
    try {
      const response = await apiRequest<MediaStatusResponse>(`/api/media/${encodeURIComponent(mediaId)}`);
      setData(response);
      setError(null);
      const job = response.processing_job.status;
      if (job === "completed") return "completed";
      if (job === "failed" || job === "cancelled") {
        setError(
          getFriendlyErrorMessage({ code: response.processing_job.error_code }, { fallback: t("media.failedFallback") }),
        );
        return "failed";
      }
      return "processing";
    } catch (caught) {
      setError(getFriendlyErrorMessage(caught, { fallback: t("media.loadFailed") }));
      return "error";
    }
  }, [mediaId]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    startedAt.current = Date.now();
    const tick = async () => {
      const next = await read();
      if (cancelled) return;
      if (next === "processing" && Date.now() - startedAt.current >= TIMEOUT_MS) {
        setState("timeout");
        return;
      }
      setState(next);
      if (next === "processing") timer = window.setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [read, round]);

  /** Read again now, and wait again if the job is still running. */
  const refresh = useCallback(() => setRound((n) => n + 1), []);

  /** Apply a change the API already confirmed (a rename, a move) without a re-read. */
  const patch = useCallback((change: Partial<MediaStatusResponse["media_item"]>) => {
    setData((current) => (current ? { ...current, media_item: { ...current.media_item, ...change } } : current));
  }, []);

  return { data, state, error, refresh, patch };
}
