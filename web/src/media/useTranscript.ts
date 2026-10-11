import { getFriendlyErrorMessage } from "@media-summarizer/core/errors/friendlyError";
import { t } from "@media-summarizer/core/i18n/runtime";
import type { RawContentResponse, TranslationMetadata } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

/**
 * The full text of a ready media, in the reading language when a translation
 * exists, and the original on demand. A translation still being produced is
 * re-read every 5 s; past two minutes it is reported as stalled, with the
 * source text on screen meanwhile (the mobile `useTranslationRefresh`).
 */
export type TranscriptState =
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "translation_pending"; content: string }
  | { status: "translation_stalled"; content: string }
  | { status: "translation_failed"; content: string }
  | { status: "not_available" }
  | { status: "error"; message: string };

const TRANSLATION_POLL_MS = 5_000;
const TRANSLATION_BUDGET = 24;

function resolve(response: RawContentResponse): TranscriptState {
  const content = (response.content ?? "").trim();
  if (!content) return { status: "not_available" };
  if (response.translation?.translation_status === "failed") return { status: "translation_failed", content };
  if (response.translation?.translation_pending === true) return { status: "translation_pending", content };
  return { status: "ready", content };
}

export function useTranscript(mediaId: string, enabled: boolean) {
  const [state, setState] = useState<TranscriptState>({ status: "loading" });
  const [translation, setTranslation] = useState<TranslationMetadata | null>(null);
  const [round, setRound] = useState(0);
  const [original, setOriginal] = useState<{ content: string | null; shown: boolean; loading: boolean; failed: boolean }>({
    content: null,
    shown: false,
    loading: false,
    failed: false,
  });

  const path = `/api/media/${encodeURIComponent(mediaId)}/raw-content`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer = 0;
    let reads = 0;
    const read = async () => {
      reads += 1;
      try {
        const response = await apiRequest<RawContentResponse>(path);
        if (cancelled) return;
        const next = resolve(response);
        setTranslation(response.translation ?? null);
        if (next.status === "translation_pending") {
          if (reads > TRANSLATION_BUDGET) {
            setState({ status: "translation_stalled", content: next.content });
            return;
          }
          timer = window.setTimeout(() => void read(), TRANSLATION_POLL_MS);
        }
        setState(next);
      } catch (error) {
        if (cancelled) return;
        // A re-read that fails keeps the text already on screen.
        if (reads > 1) return;
        setState(
          (error as { status?: number } | null)?.status === 404
            ? { status: "not_available" }
            : { status: "error", message: getFriendlyErrorMessage(error, { fallback: t("media.transcriptLoadFailed") }) },
        );
      }
    };
    void read();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [path, enabled, round]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setRound((n) => n + 1);
  }, []);

  const toggleOriginal = useCallback(async () => {
    if (original.shown || original.content !== null) {
      setOriginal((current) => ({ ...current, shown: !current.shown }));
      return;
    }
    if (original.loading) return;
    setOriginal((current) => ({ ...current, loading: true, failed: false }));
    try {
      const response = await apiRequest<RawContentResponse>(`${path}?variant=original`);
      const content = (response.content ?? "").trim();
      setOriginal({ content: content || null, shown: Boolean(content), loading: false, failed: !content });
    } catch {
      setOriginal((current) => ({ ...current, loading: false, failed: true }));
    }
  }, [original, path]);

  return { state, translation, original, toggleOriginal, retry };
}
