/**
 * The name of a media, including the one nothing named (task-400).
 *
 * A library row either holds a real title — read from the source's own metadata
 * — or holds none at all and carries `title_label_key` instead: the *key* of a
 * label (`photo`, `article`, `instagram_video`, `voice_note`…), never a label.
 * The sentence the user reads is built here, from the app's own catalogues and
 * with the date written the way their locale writes it, because the backend
 * cannot know what language they read in: it stores one key and one save date
 * and nothing else. An `fr-FR` reader used to be shown "Article — 10 Sep 2026",
 * which is what this replaces.
 *
 * Every surface that prints a media title goes through this — the Library
 * vignette, the Home tiles, the detail hero, the search results, the unsorted
 * review, a folder's sources list, and the actions menu that names the media it
 * is about — so one media reads the same on all of them, and follows a language
 * change on the next render like every other string.
 */

import { formatDate, t, type TranslationKey } from "../i18n";

/**
 * What naming a media takes.
 *
 * The three fields travel together on every contract that carries a media title
 * (`GET /api/media`, `GET /api/media/{id}`, `GET /api/search/transcripts`,
 * `GET /api/engagements/recent`), so every shape the app holds satisfies this
 * without converting to anything.
 */
export interface MediaTitleSource {
  title?: string | null;
  /** Set on exactly the rows whose `title` is null. */
  title_label_key?: string | null;
  /** ISO 8601 save date of the row — the date the generic title carries. */
  created_at?: string | null;
}

/**
 * The closed set of keys the backend stores, mapped onto catalogue keys
 * (`TITLE_LABEL_KEYS` in
 * `media_summarizer/core/media_ingestion/title_derivation.py`).
 *
 * A key absent from this map is rendered as "Saved item" rather than printed
 * raw: this is a wire enum, and a build older than the server that answers it
 * must not put `instagram_story` on screen.
 */
const LABEL_KEYS: Record<string, TranslationKey> = {
  youtube_video: "mediaTitle.label.youtubeVideo",
  podcast_episode: "mediaTitle.label.podcastEpisode",
  article: "mediaTitle.label.article",
  video: "mediaTitle.label.video",
  image_post: "mediaTitle.label.imagePost",
  instagram_video: "mediaTitle.label.instagramVideo",
  tiktok_video: "mediaTitle.label.tiktokVideo",
  instagram_post: "mediaTitle.label.instagramPost",
  x_post: "mediaTitle.label.xPost",
  audio_note: "mediaTitle.label.audioNote",
  voice_note: "mediaTitle.label.voiceNote",
  shared_note: "mediaTitle.label.sharedNote",
  document: "mediaTitle.label.document",
  photo: "mediaTitle.label.photo",
  saved_item: "mediaTitle.label.savedItem",
};

const UNKNOWN_LABEL_KEY: TranslationKey = "mediaTitle.label.savedItem";

/**
 * The title to draw for this media, always non-empty.
 *
 * `title` wins whenever it is set — a rename writes it, and from then on the
 * label key on the row is dead weight nobody reads. `common.untitled` is only
 * reached by a row that carries neither, which is the window before a save's
 * metadata has resolved.
 */
export function resolveMediaTitle(source: MediaTitleSource): string {
  const stored = source.title?.trim();
  if (stored) return stored;

  const labelKey = source.title_label_key?.trim();
  if (!labelKey) return t("common.untitled");

  const label = t(LABEL_KEYS[labelKey] ?? UNKNOWN_LABEL_KEY);

  const savedAt = source.created_at ? new Date(source.created_at) : null;
  // The label alone rather than a title with `Invalid Date` in it: the date is
  // what tells two same-day imports apart, and it is not worth a broken string.
  if (!savedAt || Number.isNaN(savedAt.getTime())) return label;

  return t("mediaTitle.generic", {
    label,
    date: formatDate(savedAt, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  });
}
