import { apiRequest } from "./apiClient";
import type { Folder } from "../types/organization";
import type { MediaListItem, MediaSortDirection } from "../types/media";

interface MediaListResponse {
  status: string;
  items: MediaListItem[];
  total: number;
  next_cursor?: string | null;
  has_more: boolean;
}

interface FolderListResponse {
  folders: Folder[];
}

interface UnsortedCountResponse {
  folder_id: string;
  media_count: number;
}

/**
 * What deleting a folder actually did, straight off `DELETE /api/folders/:id`.
 */
export interface FolderDeletion {
  /** The folder itself plus every subfolder under it. */
  deleted_folders: number;
  /** Items reassigned to the default folder. None were deleted. */
  moved_media_count: number;
  default_folder_id: string;
}

/**
 * Service for folders management.
 *
 * Folders cross the wire under their API field names and are handed to the
 * screens as they came: there is no vocabulary to translate any more, so there
 * is no mapper here either.
 */
export class OrganizationService {



  /**
   * Fetch all folders for the authenticated user.
   * GET /api/folders
   */
  static async getUserFolders(): Promise<Folder[]> {
    const response = await apiRequest<FolderListResponse>("/api/folders", {
      method: "GET",
    });
    return response.folders;
  }

  /**
   * How many items are waiting in the default folder — the Home screen's figure.
   * GET /api/folders/unsorted-count
   *
   * A call of its own rather than the count carried by `getUserFolders`, because
   * on the server the two are not the same read: the listing puts a figure on
   * every folder and pays a full pass over the user's library to do it, in
   * parallel with the identical pass `GET /api/media` makes on the same open,
   * which is what made the Home's unsorted card land visibly late (task-417).
   * Screens that list folders still use `getUserFolders` and still get every
   * count.
   *
   * The default folder is identified server-side by its `is_default` flag, never
   * by its name (task-297).
   */
  static async getUnsortedCount(): Promise<number> {
    const response = await apiRequest<UnsortedCountResponse>(
      "/api/folders/unsorted-count",
      { method: "GET" },
    );
    return response.media_count;
  }

  /**
   * Fetch the media items stored inside a folder.
   *
   * The backend `folder_id` filter is inclusive of sub-folders, so callers that
   * want only the media stored *directly* in a folder (the file-explorer
   * behaviour, where subfolders are surfaced as folders) should keep the
   * rows whose `folder_id` equals the requested folder id.
   *
   * `sort` is the chronological direction of the page (task-323). It defaults to
   * the server's own default — newest first — and `"asc"` is what a triage pass
   * through the unsorted backlog asks for: reversing a page client-side would
   * only reverse *that page*, leaving the oldest item on the last one.
   *
   * GET /api/media?folder_id=:folderId&limit=:limit&sort=:sort
   */
  static async getFolderMedia(
    folderId: string,
    options: { limit?: number; sort?: MediaSortDirection } = {},
  ): Promise<MediaListItem[]> {
    const params = new URLSearchParams();
    params.set("folder_id", folderId);
    params.set("limit", String(options.limit ?? 100));
    if (options.sort) {
      params.set("sort", options.sort);
    }
    const response = await apiRequest<MediaListResponse>(
      `/api/media?${params.toString()}`,
      { method: "GET" },
    );
    return response.items;
  }

  /**
   * Set the folder for a specific media item.
   * PATCH /api/media/:id
   */
  static async setMediaFolder(
    mediaItemId: string,
    folderId: string | null,
  ): Promise<void> {
    return apiRequest<void>(
      `/api/media/${encodeURIComponent(mediaItemId)}`,
      {
        method: "PATCH",
        body: { folder_id: folderId },
      },
    );
  }

  /**
   * Create a new folder.
   * POST /api/folders
   */
  static async createFolder(
    name: string,
    parentId?: string | null,
  ): Promise<Folder> {
    return apiRequest<Folder>("/api/folders", {
      method: "POST",
      body: { name, parent_folder_id: parentId ?? null },
    });
  }

  /**
   * Rename a folder, and only rename it.
   *
   * The body carries `name` alone on purpose: `PUT /api/folders/:id` decides
   * whether to reparent by looking at whether `parent_folder_id` is *present* in
   * the JSON (`payload.model_fields_set`), so sending it as `null` would move the
   * folder to the root as a side effect of a rename.
   *
   * PUT /api/folders/:id
   */
  static async renameFolder(folderId: string, name: string): Promise<Folder> {
    return apiRequest<Folder>(
      `/api/folders/${encodeURIComponent(folderId)}`,
      {
        method: "PUT",
        body: { name },
      },
    );
  }

  /**
   * Delete a folder and its subfolders.
   *
   * No media is destroyed: the backend reassigns every item of the deleted
   * subtree to the default folder first, and answers with how many folders
   * went and how many items moved.
   *
   * DELETE /api/folders/:id
   */
  static async deleteFolder(folderId: string): Promise<FolderDeletion> {
    return apiRequest<FolderDeletion>(
      `/api/folders/${encodeURIComponent(folderId)}`,
      { method: "DELETE" },
    );
  }
}
