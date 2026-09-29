/**
 * Types for folders (media organization).
 */

/**
 * A folder, exactly as `GET /api/folders` returns it — the field names are the
 * API's own, so nothing between the wire and the screen renames anything.
 */
export interface Folder {
  id: string;
  name: string;
  /**
   * Items stored *directly* in this folder, counted server-side from the durable
   * `user_media` library (task-220) — so an item whose processing job has
   * expired still counts.
   *
   * Every folder of the list carries one, and paying for all of them is why the
   * Home screen no longer reads this endpoint for the single figure on its
   * unsorted card: that one comes from `getUnsortedCount` (task-417). The screens
   * that *list* folders draw a figure on each, so they read them here.
   */
  media_count: number;
  parent_folder_id?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
