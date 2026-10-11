import type { MediaType } from "./media";

/**
 * Wire types of `GET /api/search/transcripts` (full-text search over the
 * account's sources, backend-proxied). Moved from the mobile search service so
 * the web app reads the same shapes.
 */
export interface SearchHitHighlight {
  field: string;
  /** Algolia's `<mark>`-tagged, HTML-escaped excerpt (`parseHighlightSnippet`). */
  snippet: string;
}

export interface SearchHit {
  media_item_id: string;
  title: string | null;
  title_label_key: string | null;
  creator_name: string | null;
  source_platform: string | null;
  media_type: MediaType | null;
  media_image: string | null;
  source_url: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  /** False for a hit whose media left the library since it was indexed. */
  in_library: boolean;
  text_match_score: number;
  highlights: SearchHitHighlight[];
}

export interface SearchTranscriptsResponse {
  query: string;
  found: number;
  page: number;
  per_page: number;
  hits: SearchHit[];
}
