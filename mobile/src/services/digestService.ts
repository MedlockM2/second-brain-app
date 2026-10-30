import { apiRequest } from "./apiClient";
import {
  readResource,
  resourceKeys,
  resourceSession,
  type DigestResource,
} from "./resourceCache";
import type { Digest, DigestPeriod } from "@media-summarizer/core/types/digest";

/**
 * Digest service for the mobile app.
 * Uses the canonical /api/digest/* endpoints.
 */
export class DigestService {
  private static async getDigest(period: DigestPeriod): Promise<Digest> {
    const owner = resourceSession().cache;
    const response = await readResource(
      resourceKeys.digest(period),
      async () => {
        const digest = await apiRequest<Digest>(`/api/digest/${period}`, {
          method: "GET",
        });
        const captured = owner.snapshot<DigestResource>(
          resourceKeys.digest(period, digest.period_key),
        ).data;
        const latest = owner.snapshot<DigestResource>(
          resourceKeys.digest(period),
        ).data;
        const previous =
          captured ??
          (latest?.period_key === digest.period_key ? latest : undefined);
        const excluded = new Set(previous?.excluded_media_item_ids ?? []);
        return {
          ...digest,
          media_item_ids: digest.media_item_ids.filter(
            (id) => !excluded.has(id),
          ),
          excluded_media_item_ids: [...excluded],
        };
      },
    );
    // Keep the captured period addressable even when "latest" advances while
    // its carousel is open. Known deletions update both resources together.
    owner.set(resourceKeys.digest(period, response.period_key), response);
    return response;
  }

  /** Current local calendar day, cached server-side for up to five minutes. */
  static async getDailyDigest(): Promise<Digest> {
    return this.getDigest("daily");
  }

  /** Current local ISO week, cached server-side for up to five minutes. */
  static async getWeeklyDigest(): Promise<Digest> {
    return this.getDigest("weekly");
  }
}
