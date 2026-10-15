/**
 * Glyph and label of a media type.
 *
 * One mapping for every surface that shows a media row — the inbox vignette, the
 * media detail page, the Sources tab of a folder. Three private copies of the
 * glyph switch had drifted apart before it was extracted; a source that changes
 * icon between two screens is a bug the user notices. The label joined it when a
 * second surface needed it: the media page names the type in words beside its
 * fallback glyph, which is decorative (task-410 §2.3). The badge's colours
 * joined them when the unsorted-review card started drawing the same pill.
 */

import type { Ionicons } from "@expo/vector-icons";
import { t } from "../i18n";
import type { MediaType } from "@media-summarizer/core/types/media";
import type { ThemeColors } from "../constants/theme";

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

/**
 * The fill of the media-type badge and the ink that goes on it.
 *
 * The two travel together because they cannot be chosen independently: the
 * amber fill needs `onPrimary` over it (`textMain` measures 1.5:1 on the dark
 * amber and 8.9:1 on the light one, so a single ink cannot serve both modes),
 * while every other fill keeps `textMain`, which stays legible on both palettes
 * (7.8:1 at worst, `audioContainer` at night).
 *
 * Takes the palette as an argument rather than importing it: a plain function
 * cannot call `useThemeColors`, and its caller already holds the palette.
 *
 * Shared by the Search and Library vignette and the unsorted-review card, so the
 * one media shows the same pill on both.
 */
export function getMediaTypeBadgeTones(
  type: MediaType,
  Colors: ThemeColors,
): { fill: string; ink: string } {
  switch (type) {
    case "podcast_episode":
      return { fill: Colors.primary, ink: Colors.onPrimary };
    case "youtube_video":
      return { fill: Colors.errorContainer, ink: Colors.textMain };
    // A short is its own family, not a shade of the video red (task-435). It
    // used to take that exact red with that exact glyph, so only the word
    // separated SHORT from VIDÉO — too little to find one while scrolling.
    //
    // `shortVideoContainer` is the blue-grey of the palette's *ink* family
    // (`textMuted`, `textSubtle`), which is the only hue Amber Clarity already
    // owns and has not yet spent as a fill, so this adds a family without
    // importing a foreign accent. It competes with neither neighbour, for two
    // different reasons:
    //
    // - **Not the video red.** Same Lab lightness and chroma as
    //   `errorContainer` (L* 90.3/90.0 light, 30.1/30.0 dark) but 242° away in
    //   hue, so the pills read as peers of equal weight rather than as two
    //   strengths of one colour — ΔE 23.6 light, 87.0 dark.
    // - **Not the podcast amber.** The amber is a saturated accent the system
    //   reserves for "high-value interactions… and meaningful accents" (C* 84.7)
    //   and it carries `onPrimary`; this is a quiet container six times less
    //   chromatic, ΔE 98.6 light and 115.3 dark away from it. No eye confuses a
    //   lit amber chip with a pale slate one.
    //
    // Its ink is `textMain`, measured on the fill in both modes: **10.52:1**
    // light (`#2b2d42` on `#d6e4fd`) and **7.86:1** dark (`#f1ebe1` on
    // `#1a4975`), against the 4.5:1 WCAG AA asks of the badge's 13px label.
    case "short_video":
      return { fill: Colors.shortVideoContainer, ink: Colors.textMain };
    // Every family that has one gets its own hue, on the short's recipe (see
    // `audioContainer` in the theme): green for what is listened to without a
    // picture, orchid for a photo post, sea-green for an article. Text, documents
    // and links keep the tonal surface — they are the catch-all, and a tint of
    // their own would leave no type looking ordinary.
    case "audio_file":
    case "audio":
      return { fill: Colors.audioContainer, ink: Colors.textMain };
    case "image_post":
      return { fill: Colors.imagePostContainer, ink: Colors.textMain };
    case "article":
      return { fill: Colors.articleContainer, ink: Colors.textMain };
    default:
      return { fill: Colors.surfaceContainerHigh, ink: Colors.textMain };
  }
}
