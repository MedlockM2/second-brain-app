/**
 * Wire types of the scope-addressed artifact API.
 *
 * Artifacts are an append-only history per scope: a scope holds several entries
 * of the same type, each carrying the snapshot of the sources it was generated
 * over. There is no "current artifact of type X" anywhere in these shapes, which
 * is the whole point — the concept stopped existing backend-side too.
 *
 * A new entry only appears when the set of sources differs from every entry
 * already stored (task-322): a media item therefore holds one entry per type for
 * good, and a folder gains one each time its contents change. No screen compares
 * the `sources` snapshot with the folder any more (task-534, task-541): a
 * generation is always offered, and one over sources already covered answers
 * the existing entry (`reused`), which the screen then opens.
 */

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
 * it before the hash anyway, and leaving it out keeps the request readable.
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
}

export interface ArtifactDetail extends ArtifactSummary {
  scope: ArtifactScope;
  scope_id: string;
  sources: ArtifactSource[];
  s3_key?: string | null;
  /**
   * The `parameters` that ask for this very entry again (task-535): its options,
   * its language when the request pinned one, its chosen sources. `{}` at the
   * defaults. What a failed entry is rerun with, so the rerun lands on it and not
   * on the entry at the defaults.
   */
  request_parameters: ArtifactGenerationParameters;
}

/**
 * What a generation request actually did, as the API names it.
 *
 * - `created`: a generation was queued over these sources.
 * - `retried`: an entry that had failed over these sources was rerun.
 * - `reused`: a generation already covered these sources, so nothing was queued.
 *   The normal answer to a second request on a media item, to a folder whose
 *   sources have not changed, and to the first request of an account over content
 *   another account already generated this artifact for. It says nothing about the
 *   allowance: only an artifact this account already held is free.
 * - `collapsed`: two concurrent taps, and this one lost the race; the entry
 *   returned is the one already in flight.
 */
export type ArtifactGenerationOutcome =
  | "created"
  | "retried"
  | "reused"
  | "collapsed";

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
  /** Parsed JSON payload (shape depends on artifact_type). */
  content: Record<string, unknown>;
}
