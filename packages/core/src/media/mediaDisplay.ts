import type { TranslationKey } from "../i18n/runtime";
import type { MediaType } from "../types/media";

/**
 * How a media row is drawn, as data: the glyph of its type, the label of its
 * type, and the marker of its library status.
 *
 * The same switches as `mobile/src/lib/mediaTypeDisplay.ts` and
 * `mobile/src/lib/mediaStatusMarker.ts`, without their platform pieces: the icon
 * is an Ionicons *name* (each app draws it its own way) and the label a
 * catalogue *key*. Shared with the web app from here (task-476); the mobile app
 * keeps its copies until a mobile change points them here.
 */

/** Ionicons name of the fallback glyph of a media type. */
export function mediaTypeIconName(type: MediaType | string | null | undefined): string {
  switch (type) {
    case "podcast_episode":
      return "headset-outline";
    case "article":
      return "document-text-outline";
    case "youtube_video":
    case "short_video":
      return "play-circle-outline";
    case "image_post":
      return "images-outline";
    case "audio_file":
    case "audio":
      return "musical-notes-outline";
    case "shared_text":
      return "text-outline";
    case "document":
      return "document-attach-outline";
    default:
      return "link-outline";
  }
}

/** Catalogue key of the type written out, in the badge's capitals: "PODCAST", "ARTICLE", … */
export function mediaTypeLabelKey(type: MediaType | string | null | undefined): TranslationKey {
  switch (type) {
    case "podcast_episode":
      return "mediaType.podcast";
    case "article":
      return "mediaType.article";
    case "youtube_video":
      return "mediaType.video";
    case "short_video":
      return "mediaType.short";
    case "image_post":
      return "mediaType.imagePost";
    case "audio_file":
    case "audio":
      return "mediaType.audio";
    case "shared_text":
      return "mediaType.text";
    case "document":
      return "mediaType.document";
    default:
      return "mediaType.link";
  }
}

export type MediaStatusMarker = "failed" | "processing" | null;

/**
 * Which marker a vignette shows for the lifecycle of its library entry, or
 * neither: `failed` earns the failure badge, `pending` and `processing` the
 * processing state, `ready` and an absent value nothing.
 */
export function mediaStatusMarker(status?: string | null): MediaStatusMarker {
  if (status === "failed") return "failed";
  if (status === "pending" || status === "processing") return "processing";
  return null;
}
