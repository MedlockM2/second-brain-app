/**
 * Digest types for the mobile app.
 *
 * A digest is an ordered list of media ids and nothing else: the screen renders
 * the media page of each one, so anything a projection could carry here (title,
 * cover, excerpt, read time) it already gets from `GET /api/media/{id}`.
 */

/** The two periods a digest covers, in the order the Digest tab offers them. */
export type DigestPeriod = "daily" | "weekly";

export interface Digest {
  digest_type: DigestPeriod;
  /** Local date of the send for daily, elapsed ISO week for weekly. */
  period_key: string;
  /** The media of the period, oldest first. Empty when the period held none. */
  media_item_ids: string[];
}
