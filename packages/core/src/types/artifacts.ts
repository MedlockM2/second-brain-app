/** Wire types of the artifact history. Every submitted creation owns a fresh entry. */

import type { ArtifactStatus, ArtifactType } from "./media";

/** What a generation was run over: a single media item, or a whole folder. */
export type ArtifactScope = "media" | "folder";

/** How deep a summary goes (`length`, `summary_short` only). Same schema at every length. */
export type SummaryLength = "short" | "medium" | "long";

/** How many questions or cards, against what the material carries (`count`). */
export type ItemCount = "fewer" | "standard" | "more";

/** How demanding the questions or cards are (`difficulty`). */
export type Difficulty = "easy" | "medium" | "hard";

/**
 * The `parameters` of a generation request: the options of the "Personnaliser"
 * screen (task-531), and the language and sources of task-533 and task-532.
 *
 * Which option a type accepts, and the default of each, is in
 * `artifacts/options.ts`. An option at its default is not sent: the backend drops
 * it before storing them, and leaving it out keeps the request readable.
 */
export interface ArtifactGenerationParameters {
  length?: SummaryLength;
  count?: ItemCount;
  difficulty?: Difficulty;
  /** The topic to favour, 300 characters at most once its whitespace is collapsed. */
  focus?: string;
  /** Sent only to pin another language than the reading language. */
  language?: string;
  /** A folder's chosen sources; never on a media. */
  source_ids?: string[];
}

export interface GenerateArtifactRequest {
  scope: ArtifactScope;
  scope_id: string;
  artifact_type: ArtifactType;
  parameters?: ArtifactGenerationParameters;
}

/**
 * One source of an entry's immutable snapshot. `excluded` marks a source that
 * was in the scope but carried no usable transcript: recorded, not dropped, so
 * the entry stays honest about what it could not read.
 */
export interface ArtifactSource {
  media_item_id: string;
  title?: string | null;
  language?: string | null;
  excluded: boolean;
  excluded_reason?: string | null;
}

/** One row of a scope's artifact history. */
export interface ArtifactSummary {
  artifact_id: string;
  artifact_type: ArtifactType;
  status: ArtifactStatus;
  /** Written by the model, which is what tells two entries of the same type apart. */
  title?: string | null;
  source_count: number;
  created_at: string;
  completed_at?: string | null;
  error_code?: string | null;
  error_params: Record<string, unknown>;
  retryable: boolean;
}

export interface ArtifactDetail extends ArtifactSummary {
  scope: ArtifactScope;
  scope_id: string;
  sources: ArtifactSource[];
  s3_key?: string | null;
  /** Stored generation options; the retry endpoint uses them on the server. */
  request_parameters: ArtifactGenerationParameters;
}

export type ArtifactGenerationOutcome = "created";

/** The answer to `POST /api/artifacts`: the entry, plus what the call did. */
export interface ArtifactCreateResult extends ArtifactDetail {
  generation_outcome: ArtifactGenerationOutcome;
}

export interface ArtifactListResponse {
  scope: ArtifactScope;
  scope_id: string;
  artifacts: ArtifactSummary[];
  next_cursor?: string | null;
}

export interface ArtifactContentResponse {
  artifact_id: string;
  artifact_type: ArtifactType;
  scope: ArtifactScope;
  scope_id: string;
  status: ArtifactStatus;
  /** Immutable output language captured at generation, independent of the profile. */
  language: string | null;
  /** Parsed JSON payload (shape depends on artifact_type). */
  content: Record<string, unknown>;
}
