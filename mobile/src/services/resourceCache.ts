import type { ArtifactListResponse } from "@media-summarizer/core/types/artifacts";
import type { Digest, DigestPeriod } from "@media-summarizer/core/types/digest";
import {
  ResourceCache,
  ResourceSupersededError,
  isResourceGone,
  resourceId,
  type ResourceKey,
} from "@media-summarizer/core/cache/resourceCache";
import type { Folder } from "@media-summarizer/core/types/organization";
import type {
  ListMediaResponse,
  MediaStatusResponse,
  PatchMediaResponse,
} from "@media-summarizer/core/types/media";
import type { ChatConversationList } from "@media-summarizer/core/types/chat";

interface ResourceSession {
  userId: string | null;
  language: string | null;
  cache: ResourceCache;
}
/** Local removals must survive re-reading the server's immutable capture. */
export interface DigestResource extends Digest {
  excluded_media_item_ids: string[];
}
let session: ResourceSession = {
  userId: null,
  language: null,
  cache: new ResourceCache(),
};
export function activateResourceAccount(
  userId: string | null,
  language: string | null = null,
): void {
  if (session.userId !== userId) {
    session.cache.dispose();
    session = { userId, language, cache: new ResourceCache() };
  } else session.language = language;
}
export function setResourceLanguage(language: string | null): void {
  session.language = language;
}
export function resourceSession(): ResourceSession {
  return session;
}
export const resourceKeys = {
  digest: (period: DigestPeriod, periodKey = "latest"): ResourceKey => [
    "digest",
    period,
    periodKey,
  ],
  mediaWindow: ["media-window"] as ResourceKey,
  historyWindow: (scope: string, id: string): ResourceKey => [
    "chat-history-window",
    scope,
    id,
  ],
  folders: ["folders"] as ResourceKey,
  recentEngagements: (limit = 12): ResourceKey => ["recent-engagements", limit],
  unsortedCount: ["unsorted-count"] as ResourceKey,
  mediaPage: (
    options: {
      folderId?: string | null;
      limit?: number;
      sort?: string;
      cursor?: string | null;
    } = {},
  ): ResourceKey => [
    "media-page",
    options.folderId ?? null,
    options.limit ?? 20,
    options.sort ?? "desc",
    options.cursor ?? null,
  ],
  media: (id: string, language = session.language): ResourceKey => [
    "media",
    id,
    language,
  ],
  text: (
    id: string,
    variant = "translated",
    language = session.language,
  ): ResourceKey => [
    "text",
    id,
    variant,
    variant === "original" ? null : language,
  ],
  artifact: (id: string, language = session.language): ResourceKey => [
    "artifact",
    id,
    language,
  ],
  artifactBody: (id: string, language = session.language): ResourceKey => [
    "artifact-body",
    id,
    language,
  ],
  artifacts: (
    scope: string,
    id: string,
    limit = 50,
    cursor: string | null = null,
    language = session.language,
  ): ResourceKey => ["artifact-list", scope, id, language, limit, cursor],
  history: (
    scope: string,
    id: string,
    limit = 20,
    cursor: string | null = null,
  ): ResourceKey => ["chat-history", scope, id, limit, cursor],
};
/** Every call revalidates; only simultaneous requests share their transport. */
export function readResource<T>(
  key: ResourceKey,
  load: () => Promise<T>,
  languageSensitive = false,
  revalidate?: () => Promise<T>,
): Promise<T> {
  const owner = session;
  if (!owner.userId) return Promise.reject(new ResourceSupersededError());
  const language = owner.language;
  const keyLanguage =
    key[0] === "artifact-list" || key[0] === "text" ? key[3] : key[2];
  if (languageSensitive && keyLanguage !== language)
    return Promise.reject(new ResourceSupersededError());
  const guard = (loader: () => Promise<T>) => async () => {
    const current = () =>
      session === owner &&
      (!languageSensitive || session.language === language);
    if (!current()) throw new ResourceSupersededError();
    try {
      const data = await loader();
      if (!current()) throw new ResourceSupersededError();
      return data;
    } catch (error) {
      if (!current()) throw new ResourceSupersededError();
      throw error;
    }
  };
  return owner.cache
    .fetch(key, guard(load), revalidate ? guard(revalidate) : undefined)
    .catch((error) => {
      if (isResourceGone(error) && key[0] === "digest") {
        owner.cache.remove(
          (entry) =>
            entry[0] === "digest" &&
            entry[1] === key[1] &&
            resourceId(entry) !== resourceId(key),
        );
      }
      if (isResourceGone(error) && key[0] === "media") {
        removeMedia(owner.cache, String(key[1]), key);
        owner.cache.invalidate((entry) =>
          ["media-page", "media-window"].includes(String(entry[0])),
        );
      }
      if (
        isResourceGone(error) &&
        ["artifact", "artifact-body"].includes(String(key[0]))
      ) {
        const id = key[1];
        owner.cache.update(
          (entry) => entry[0] === "artifact-list",
          (data) => {
            const page = data as ArtifactListResponse;
            return {
              ...page,
              artifacts: page.artifacts.filter(
                (artifact) => artifact.artifact_id !== id,
              ),
            };
          },
        );
        owner.cache.remove(
          (entry) =>
            ["artifact", "artifact-body"].includes(String(entry[0])) &&
            entry[1] === id &&
            resourceId(entry) !== resourceId(key),
        );
        owner.cache.invalidate((entry) => entry[0] === "artifact-list");
      }
      throw error;
    });
}
export function mutationOwner(): ResourceCache {
  return session.cache;
}
const mediaFamilies = (key: ResourceKey) =>
  [
    "media-page",
    "media-window",
    "media",
    "artifact-list",
    "folders",
    "chat-history",
    "chat-history-window",
    "digest",
    "recent-engagements",
    "unsorted-count",
  ].includes(String(key[0]));
export function mediaSaved(cache = session.cache): void {
  cache.invalidate(mediaFamilies);
}
function belongsToFolder(
  cache: ResourceCache,
  folderId: string | null,
  ancestor: string,
): boolean {
  const folders = cache.snapshot<Folder[]>(resourceKeys.folders).data ?? [];
  const visited = new Set<string>();
  while (folderId && !visited.has(folderId)) {
    if (folderId === ancestor) return true;
    visited.add(folderId);
    folderId =
      folders.find((folder) => folder.id === folderId)?.parent_folder_id ??
      null;
  }
  return false;
}
export function mediaPatched(
  cache: ResourceCache,
  id: string,
  patch: Pick<PatchMediaResponse, "folder_id" | "title">,
): void {
  cache.update(
    (key) => key[0] === "media-page" || key[0] === "media-window",
    (data, key) => {
      const page = data as ListMediaResponse;
      const items = page.items.flatMap((item) => {
        if (item.media_item_id !== id) return [item];
        if (
          "folder_id" in patch &&
          key[0] === "media-page" &&
          key[1] &&
          !belongsToFolder(cache, patch.folder_id ?? null, String(key[1]))
        )
          return [];
        return [{ ...item, ...patch }];
      });
      return {
        ...page,
        items,
        total: Math.max(0, page.total - (page.items.length - items.length)),
      };
    },
  );
  cache.update(
    (key) => key[0] === "media" && key[1] === id,
    (data) => {
      const detail = data as MediaStatusResponse;
      return { ...detail, media_item: { ...detail.media_item, ...patch } };
    },
  );
  cache.invalidate(mediaFamilies);
}
function removeMedia(
  cache: ResourceCache,
  id: string,
  keep?: ResourceKey,
): void {
  cache.update(
    (key) => key[0] === "digest",
    (data) => {
      const digest = data as DigestResource;
      if (!digest.media_item_ids.includes(id)) return digest;
      return {
        ...digest,
        media_item_ids: digest.media_item_ids.filter(
          (mediaId) => mediaId !== id,
        ),
        excluded_media_item_ids: [...digest.excluded_media_item_ids, id],
      };
    },
  );
  cache.update(
    (key) => key[0] === "media-page" || key[0] === "media-window",
    (data) => {
      const page = data as ListMediaResponse;
      const items = page.items.filter((item) => item.media_item_id !== id);
      return {
        ...page,
        items,
        total: Math.max(0, page.total - (page.items.length - items.length)),
      };
    },
  );
  cache.remove(
    (key) =>
      (!keep || resourceId(key) !== resourceId(keep)) &&
      ["media", "text"].includes(String(key[0])) &&
      key[1] === id,
  );
}
export function mediaDeleted(cache: ResourceCache, id: string): void {
  removeMedia(cache, id);
  cache.invalidate((key) =>
    ["artifact", "artifact-body"].includes(String(key[0])),
  );
  cache.invalidate(mediaFamilies);
}
export function folderChanged(cache: ResourceCache, folder?: Folder): void {
  if (folder)
    cache.update(
      (key) => key[0] === "folders",
      (data) => {
        const folders = data as Folder[];
        return folders.some((entry) => entry.id === folder.id)
          ? folders.map((entry) => (entry.id === folder.id ? folder : entry))
          : [...folders, folder];
      },
    );
  cache.invalidate(mediaFamilies);
}
export function folderDeleted(
  cache: ResourceCache,
  id: string,
  defaultId: string,
): void {
  const folders = cache.snapshot<Folder[]>(resourceKeys.folders).data ?? [];
  const ids = new Set([id]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const folder of folders)
      if (
        folder.parent_folder_id &&
        ids.has(folder.parent_folder_id) &&
        !ids.has(folder.id)
      ) {
        ids.add(folder.id);
        changed = true;
      }
  }
  cache.update(
    (key) => key[0] === "folders",
    (data) => (data as Folder[]).filter((folder) => !ids.has(folder.id)),
  );
  cache.update(
    (key) => key[0] === "media-page" || key[0] === "media-window",
    (data, key) => {
      const page = data as ListMediaResponse;
      const items = page.items.flatMap((item) => {
        if (!item.folder_id || !ids.has(item.folder_id)) return [item];
        if (
          key[0] === "media-page" &&
          key[1] &&
          !belongsToFolder(cache, defaultId, String(key[1]))
        )
          return [];
        return [{ ...item, folder_id: defaultId }];
      });
      return {
        ...page,
        items,
        total: Math.max(0, page.total - (page.items.length - items.length)),
      };
    },
  );
  cache.update(
    (key) => key[0] === "media",
    (data) => {
      const detail = data as MediaStatusResponse;
      return detail.media_item.folder_id && ids.has(detail.media_item.folder_id)
        ? {
            ...detail,
            media_item: { ...detail.media_item, folder_id: defaultId },
          }
        : detail;
    },
  );
  cache.remove(
    (key) =>
      (key[0] === "media-page" && ids.has(String(key[1]))) ||
      (["artifact-list", "chat-history", "chat-history-window"].includes(
        String(key[0]),
      ) &&
        key[1] === "folder" &&
        ids.has(String(key[2]))),
  );
  cache.invalidate(mediaFamilies);
}
export function homeChanged(cache = session.cache): void {
  cache.invalidate((key) => key[0] === "recent-engagements" || key[0] === "unsorted-count");
}
export function historyChanged(cache: ResourceCache, id?: string): void {
  if (id)
    cache.update(
      (key) => key[0] === "chat-history" || key[0] === "chat-history-window",
      (data) => {
        const page = data as ChatConversationList;
        return {
          ...page,
          conversations: page.conversations.filter(
            (item) => item.conversation_id !== id,
          ),
        };
      },
    );
  cache.invalidate(
    (key) => key[0] === "chat-history" || key[0] === "chat-history-window",
  );
}
