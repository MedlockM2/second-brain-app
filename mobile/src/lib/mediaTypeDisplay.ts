/**
 * Glyph and label of a media type.
 *
 * One mapping for every surface that shows a media row — the inbox vignette, the
 * media detail page, the Sources tab of a folder. Three private copies of the
 * glyph switch had drifted apart before it was extracted; a source that changes
 * icon between two screens is a bug the user notices. The label joined it when a
 * second surface needed it: the media page names the type in words beside its
 * fallback glyph, which is decorative (task-410 §2.3).
 */

import type { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import type { MediaType } from "../types/media";

export function getMediaTypeIcon(
  type: MediaType,
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "podcast_episode":
      return "headset-outline";
    case "article":
      return "document-text-outline";
    case "youtube_video":
    case "short_video":
      return "play-circle-outline";
    // A publication made of pictures, so the stacked-photos glyph rather than
    // the single-frame one: a carousel is the common case (task-385).
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

/** The type written out, in the badge's capitals: "PODCAST", "ARTICLE", … */
export function getMediaTypeLabel(type: MediaType): string {
  switch (type) {
    case "podcast_episode":
      return t("mediaType.podcast");
    case "article":
      return t("mediaType.article");
    case "youtube_video":
      return t("mediaType.video");
    case "short_video":
      return t("mediaType.short");
    case "image_post":
      return t("mediaType.imagePost");
    case "audio_file":
    case "audio":
      return t("mediaType.audio");
    case "shared_text":
      return t("mediaType.text");
    case "document":
      return t("mediaType.document");
    default:
      return t("mediaType.link");
  }
}
