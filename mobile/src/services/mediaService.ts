import {
  readResource,
  resourceKeys,
  mutationOwner,
  mediaPatched,
  mediaDeleted,
  mediaSaved,
  resourceSession,
} from "./resourceCache";
import { apiRequest } from "./apiClient";
import type {
  IngestUrlRequest,
  IngestUrlResponse,
  MediaListItem,
  MediaStatusResponse,
} from "@media-summarizer/core/types/media";

/**
 * Response shape for GET /api/media (list endpoint).
 * Matches `MediaSearchResponse` on the backend.
 */
export interface ListMediaResponse {
  status: string;
  items: MediaListItem[];
  total: number;
  next_cursor?: string | null;
  has_more: boolean;
}

export interface MediaLibraryWindow extends ListMediaResponse {
  pages: number;
}

/**
 * Translation state machine statuses (task-203).
 * - queued: translation job enqueued, waiting for worker pickup
 * - in_progress: worker is actively translating
 * - done: translation complete and cached in S3
 * - failed: translation failed terminally (DLQ); user can retry manually
 */
export type TranslationStatusValue =
  | "queued"
  | "in_progress"
  | "done"
  | "failed"
  | null;

/**
 * Translation metadata from the backend (task-192 / task-200 / task-203).
 *
 * Three of these fields drive the Reader's "View the original" toggle (task-419):
 * `is_translated` says whether the body on screen is a translation at all — which
 * is the only thing that makes the control exist — and `translated_from` /
 * `target_language` name the two languages it switches between.
 */
export interface TranslationMetadata {
  /** Whether the `content` of this response is a translation, not the source text. */
  is_translated: boolean;
  translated_from?: string | null;
  target_language?: string | null;
  detected_language?: string | null;
  detection_method?: string | null;
  /** When true, translation is being produced asynchronously. Poll again. */
  translation_pending?: boolean;
  /** Explicit state machine status (task-203). More granular than translation_pending. */
  translation_status?: TranslationStatusValue;
}

/**
 * Which body a read of `/raw-content` asks for (task-419).
 *
 * `translated` is the default: the cached translation into the account's reading
 * language when there is one, the source text otherwise. `original` is the source
 * text whatever has been translated — what the Reader's "View the original"
 * control reads — and comes back with no translation metadata.
 */
export type RawContentVariant = "translated" | "original";

/**
 * Response shape for GET /api/media/:id/raw-content.
 * Matches `RawContentResponse` on the backend.
 */
export interface RawContentResponse {
  status: string;
  media_item_id: string;
  content: string;
  content_type: string;
  media_type?: string | null;
  source_format?: string | null;
  translation?: TranslationMetadata | null;
  /** Which body this response carries, echoing the requested variant. */
  variant?: RawContentVariant;
}

/**
 * Response shape for DELETE /api/media/:mediaItemId.
 * Matches `DeleteMediaResponse` on the backend.
 *
 * The item leaves every read surface immediately; `purge_at` is when it and
 * everything it owns are destroyed for good (see `docs/DATA_RETENTION.md`). The
 * grace window is not surfaced in the UI yet, so nothing reads these fields —
 * they are declared because the endpoint answers them.
 */
export interface DeleteMediaResponse {
  status: string;
  media_item_id: string;
  deleted_at?: string | null;
  /** Epoch seconds after which the deletion becomes irreversible. */
  purge_at: number;
  grace_days: number;
}

/**
 * Response shape for PATCH /api/media/:mediaItemId.
 * Matches `PatchMediaResponse` on the backend.
 *
 * The endpoint patches a folder, a title, or both, and only answers the halves
 * the request actually touched — a rename leaves `folder_id` absent.
 */
export interface PatchMediaResponse {
  status: string;
  media_id: string;
  folder_id?: string | null;
  previous_folder_id?: string | null;
  /** The stored title, trimmed by the server. Absent on a folder-only patch. */
  title?: string | null;
}

/**
 * Media ingestion service for mobile.
 * Uses the canonical /api/media/* endpoints.
 * Shared by both Android share intent and iOS share extension flows.
 */
export class MediaService {
  /**
   * Fetch the first page of the current user's media, newest first.
   * GET /api/media
   *
   * `limit` is the page size, which the server clamps to 1-100 and defaults to
   * 20 when it is left out.
   */
  static async listMedia(
    options: { limit?: number; cursor?: string | null } = {},
  ): Promise<ListMediaResponse> {
    return readResource(resourceKeys.mediaPage(options), async () => {
      const params = new URLSearchParams();
      if (options.limit !== undefined)
        params.set("limit", String(options.limit));
      if (options.cursor) params.set("cursor", options.cursor);
      const query = params.toString();
      return apiRequest<ListMediaResponse>(
        `/api/media${query ? `?${query}` : ""}`,
        {
          method: "GET",
        },
      );
    });
  }

  /** Keep the visited library pages together across navigation. */
  static async libraryWindow(
    after: string | null = null,
  ): Promise<MediaLibraryWindow> {
    const owner = resourceSession().cache;
    const key = resourceKeys.mediaWindow;
    const load = (after: string | null) => async () => {
      const previous = owner.snapshot<MediaLibraryWindow>(key).data;
      const items = new Map(
        (after ? (previous?.items ?? []) : []).map((item) => [
          item.media_item_id,
          item,
        ]),
      );
      let cursor = after;
      let total = previous?.total ?? 0;
      let count = 0;
      do {
        const page = await this.listMedia({ cursor });
        page.items.forEach((item) => items.set(item.media_item_id, item));
        total = page.total;
        cursor = page.has_more ? (page.next_cursor ?? null) : null;
        count += 1;
      } while (!after && cursor && count < (previous?.pages ?? 1));
      return {
        status: "success",
        items: [...items.values()],
        total,
        next_cursor: cursor,
        has_more: cursor !== null,
        pages: after ? (previous?.pages ?? 1) + 1 : count,
      };
    };
    return readResource(key, load(after), false, load(null));
  }

  /**
   * Submit a URL for ingestion via the canonical endpoint.
   * POST /api/media/ingest-url
   */
  static async ingestUrl(
    payload: IngestUrlRequest,
  ): Promise<IngestUrlResponse> {
    const owner = mutationOwner();
    const result = await apiRequest<IngestUrlResponse>(
      "/api/media/ingest-url",
      {
        method: "POST",
        body: payload,
      },
    );
    mediaSaved(owner);
    return result;
  }

  /**
   * Get the current status of a media item and its processing job.
   * GET /api/media/:mediaItemId
   */
  static async getMediaStatus(
    mediaItemId: string,
    language = resourceSession().language,
  ): Promise<MediaStatusResponse> {
    return readResource(
      resourceKeys.media(mediaItemId, language),
      async () => {
        return apiRequest<MediaStatusResponse>(
          `/api/media/${encodeURIComponent(mediaItemId)}`,
          { method: "GET" },
        );
      },
      true,
    );
  }

  /**
   * Fetch the raw textual content of a media item (formatted transcript,
   * extracted article body, OCR result, …). Available once processing has
   * progressed enough to produce content; returns 404 otherwise.
   * GET /api/media/:mediaItemId/raw-content
   *
   * `variant: "original"` asks for the source text of a media whose body is
   * served translated (task-419). It is left out of the default read on purpose:
   * that one runs on every open of the Reader tab and on every tick of the
   * translation poll, and it must stay the single-bodied response it has always
   * been.
   */
  static async getRawContent(
    mediaItemId: string,
    options: { variant?: RawContentVariant } = {},
    language = resourceSession().language,
  ): Promise<RawContentResponse> {
    return readResource(
      resourceKeys.text(mediaItemId, options.variant, language),
      async () => {
        const query = options.variant ? `?variant=${options.variant}` : "";
        return apiRequest<RawContentResponse>(
          `/api/media/${encodeURIComponent(mediaItemId)}/raw-content${query}`,
          { method: "GET" },
        );
      },
      options.variant !== "original",
    );
  }

  /**
   * Remove one media item from the user's library.
   *
   * Idempotent server-side: deleting an already-deleted item answers 200 with
   * the original `purge_at` rather than 404, so a retry on a flaky network
   * cannot turn a successful deletion into an error the user has to interpret.
   *
   * DELETE /api/media/:mediaItemId
   */
  static async deleteMedia(mediaItemId: string): Promise<DeleteMediaResponse> {
    const owner = mutationOwner();
    const result = await apiRequest<DeleteMediaResponse>(
      `/api/media/${encodeURIComponent(mediaItemId)}`,
      { method: "DELETE" },
    );
    mediaDeleted(owner, mediaItemId);
    return result;
  }

  /**
   * Give one library item a new user-facing title.
   *
   * The server trims the value, collapses whitespace runs and refuses a blank
   * one, so the stored title is what the response carries — never the raw string
   * that was typed. It is also what refreshes the title denormalized on that
   * media's search records, which is why this is one call and not two.
   *
   * `folder_id` is deliberately not sent: the endpoint dispatches on the fields
   * present in the body, so a rename must not mention the folder at all.
   *
   * PATCH /api/media/:mediaItemId
   */
  static async renameMedia(
    mediaItemId: string,
    title: string,
  ): Promise<PatchMediaResponse> {
    const owner = mutationOwner();
    const result = await apiRequest<PatchMediaResponse>(
      `/api/media/${encodeURIComponent(mediaItemId)}`,
      { method: "PATCH", body: { title } },
    );
    mediaPatched(owner, mediaItemId, { title: result.title });
    return result;
  }
}
