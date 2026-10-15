import type { Digest, DigestPeriod } from "@media-summarizer/core/types/digest";
import type { ListMediaResponse, MediaListItem, MediaStatusResponse } from "@media-summarizer/core/types/media";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { cachedData, readCached } from "../lib/resourceCache";

/**
 * A digest period and the rows that name its media.
 *
 * `GET /api/digest/{daily,weekly}` answers ids only, in reading order. The rows
 * come from the first page of the library, where nearly every digest item sits
 * (it is recent by construction), and the few that do not are read one by one
 * from `GET /api/media/:id` — the same two reads the mobile digest makes.
 */
export type DigestRow = Pick<
  MediaListItem,
  "media_item_id" | "title" | "title_label_key" | "creator_name" | "media_type" | "media_image" | "created_at" | "review_blurb"
>;

const LIBRARY_PAGE = 100;
const LIBRARY_PATH = `/api/media?limit=${LIBRARY_PAGE}`;

export function useDigest(periods: readonly DigestPeriod[]) {
  // The composition read last time is drawn at once (task-507), then re-read.
  const [digests, setDigests] = useState<Partial<Record<DigestPeriod, string[]>>>(() =>
    Object.fromEntries(
      periods.flatMap((period) => {
        const cached = cachedData<Digest>(`/api/digest/${period}`);
        return cached ? [[period, cached.media_item_ids]] : [];
      }),
    ),
  );
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState<Record<string, DigestRow>>(() =>
    Object.fromEntries((cachedData<ListMediaResponse>(LIBRARY_PATH)?.items ?? []).map((item) => [item.media_item_id, item])),
  );
  const [round, setRound] = useState(0);
  const key = periods.join(",");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [library, ...answers] = await Promise.allSettled([
        readCached(LIBRARY_PATH, () => apiRequest<ListMediaResponse>(LIBRARY_PATH)),
        ...key.split(",").map((period) => {
          const path = `/api/digest/${period}`;
          return readCached(path, () => apiRequest<Digest>(path));
        }),
      ]);
      if (cancelled) return;
      const next: Partial<Record<DigestPeriod, string[]>> = {};
      let anyFailed = false;
      answers.forEach((answer, i) => {
        const period = key.split(",")[i] as DigestPeriod;
        if (answer.status === "fulfilled") next[period] = (answer.value as Digest).media_item_ids;
        else anyFailed = true;
      });
      setDigests(next);
      setFailed(anyFailed && Object.keys(next).length === 0);

      const known: Record<string, DigestRow> = {};
      if (library.status === "fulfilled") {
        for (const item of (library.value as ListMediaResponse).items) known[item.media_item_id] = item;
      }
      setRows(known);
      const missing = [...new Set(Object.values(next).flat())].filter((id) => !known[id]);
      const details = await Promise.allSettled(
        missing.map((id) => apiRequest<MediaStatusResponse>(`/api/media/${encodeURIComponent(id)}`)),
      );
      if (cancelled) return;
      const extra: Record<string, DigestRow> = {};
      for (const detail of details) {
        if (detail.status !== "fulfilled") continue;
        const item = detail.value.media_item;
        extra[item.media_item_id] = item;
      }
      if (Object.keys(extra).length > 0) setRows((current) => ({ ...current, ...extra }));
    })();
    return () => {
      cancelled = true;
    };
  }, [key, round]);

  const retry = useCallback(() => setRound((n) => n + 1), []);
  /** A media deleted from a period's page leaves the period on screen too. */
  const remove = useCallback((mediaId: string) => {
    setDigests((current) =>
      Object.fromEntries(Object.entries(current).map(([period, ids]) => [period, ids?.filter((id) => id !== mediaId)])),
    );
  }, []);

  return { digests, rows, failed, retry, remove };
}
