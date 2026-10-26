import type {
  ArtifactGenerationParameters,
  ArtifactScope,
} from "../types/artifacts";
import type {
  ListMediaResponse,
  MediaListItem,
  MediaStatusResponse,
} from "../types/media";

export interface ArtifactSource extends MediaListItem {
  duration_seconds?: number | null;
}

/** Load the whole subtree. A partial library page must never mean "all sources". */
export async function loadArtifactSources(
  scope: ArtifactScope,
  scopeId: string,
  read: <T>(path: string) => Promise<T>,
): Promise<ArtifactSource[]> {
  if (scope === "media") {
    const { media_item: item } = await read<MediaStatusResponse>(
      `/api/media/${encodeURIComponent(scopeId)}`,
    );
    return [{ ...item, duration_seconds: item.transcript.duration_seconds }];
  }
  const sources = new Map<string, ArtifactSource>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ folder_id: scopeId, limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await read<ListMediaResponse>(`/api/media?${query}`);
    for (const item of page.items) sources.set(item.media_item_id, item);
    if (!page.has_more) break;
    cursor = page.next_cursor ?? null;
    if (!cursor || cursors.has(cursor))
      throw new Error("Incomplete source pagination");
    cursors.add(cursor);
  } while (cursor);
  // List rows carry no duration. Enrich with the canonical detail, with bounded
  // concurrency; unavailable metadata must not remove a selectable library row.
  const items = [...sources.values()];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        try {
          const detail = await read<MediaStatusResponse>(
            `/api/media/${encodeURIComponent(item.media_item_id)}`,
          );
          item.duration_seconds = detail.media_item.transcript.duration_seconds;
        } catch {
          /* The source remains selectable, without an invented duration. */
        }
      }
    }),
  );
  return items;
}

/** Omit the all-sources/default-language choices; media never sends source_ids. */
export function sourceParameters(
  scope: ArtifactScope,
  sources: readonly ArtifactSource[],
  selected: ReadonlySet<string>,
  language: string | null,
  readingLanguage: string | null,
): ArtifactGenerationParameters {
  const parameters: ArtifactGenerationParameters = {};
  if (
    scope === "folder" &&
    sources.some((source) => !selected.has(source.media_item_id))
  ) {
    parameters.source_ids = sources
      .filter((source) => selected.has(source.media_item_id))
      .map((source) => source.media_item_id);
  }
  if (language && language !== readingLanguage) parameters.language = language;
  return parameters;
}
