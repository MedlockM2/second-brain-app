import { mergeArtifactIntoHistory } from "../lib/artifactHistory";
import { withoutDefaults } from "@media-summarizer/core/artifacts/options";
import {
  readResource,
  resourceKeys,
  mutationOwner,
  homeChanged,
  resourceSession,
} from "./resourceCache";
import { apiRequest } from "./apiClient";
import type { ArtifactType } from "@media-summarizer/core/types/media";
import type {
  ArtifactContentResponse,
  ArtifactCreateResult,
  ArtifactDetail,
  ArtifactGenerationParameters,
  ArtifactListResponse,
  ArtifactScope,
  GenerateArtifactRequest,
} from "@media-summarizer/core/types/artifacts";

export type {
  ArtifactContentResponse,
  ArtifactCreateResult,
  ArtifactDetail,
  ArtifactGenerationOutcome,
  ArtifactGenerationParameters,
  ArtifactListResponse,
  ArtifactScope,
  ArtifactSource,
  ArtifactSummary,
  GenerateArtifactRequest,
} from "@media-summarizer/core/types/artifacts";

/**
 * Artifact service for the mobile app.
 *
 * One scope-addressed API serves both a single media and a folder: the
 * per-media routes are gone. Artifacts are an append-only history, so a scope
 * can hold several entries of the same type and `listArtifacts` is the single
 * source for both the history and the in-flight progress — one request per
 * scope, never one per artifact type.
 */
export class ArtifactService {
  /**
   * Request a generation over a scope.
   * POST /api/artifacts
   *
   * A request whose sources already produced an artifact answers that artifact
   * instead of generating a second one, so this call is safe to fire twice: it
   * comes back with `generation_outcome: "reused"` and the entry the account
   * already holds, which consumes nothing. Note that `reused` alone does not mean
   * free — it also answers the first request of this account over content someone
   * else already generated for, and that one is charged.
   *
   * `parameters` are the options of the "Personnaliser" screen (task-535), or the
   * `request_parameters` of a failed entry being rerun. Whatever sits at its
   * default is left out, and no `parameters` at all are sent when nothing is
   * left: the request is then, byte for byte, the one at the defaults.
   */
  static async generateArtifact(
    scope: ArtifactScope,
    scopeId: string,
    artifactType: ArtifactType,
    parameters: ArtifactGenerationParameters = {},
  ): Promise<ArtifactCreateResult> {
    const owner = mutationOwner();
    const language = resourceSession().language;
    const sent = withoutDefaults(parameters);
    const result = await apiRequest<ArtifactCreateResult>(`/api/artifacts`, {
      method: "POST",
      body: {
        scope,
        scope_id: scopeId,
        artifact_type: artifactType,
        ...(Object.keys(sent).length > 0 ? { parameters: sent } : {}),
      } satisfies GenerateArtifactRequest,
    });
    if (
      resourceSession().cache !== owner ||
      resourceSession().language !== language
    )
      return result;
    if (result.status !== "ready")
      owner.remove(
        (key) => key[0] === "artifact-body" && key[1] === result.artifact_id,
      );
    const key = resourceKeys.artifacts(scope, scopeId, 50, null, language);
    const page = owner.snapshot<ArtifactListResponse>(key).data;
    owner.set(key, {
      scope,
      scope_id: scopeId,
      ...page,
      artifacts: mergeArtifactIntoHistory(page?.artifacts ?? [], result),
    });
    owner.set(resourceKeys.artifact(result.artifact_id, language), result);
    homeChanged(owner);
    owner.invalidate(
      (key) =>
        (key[0] === "artifact-list" &&
          key[1] === scope &&
          key[2] === scopeId) ||
        (key[0] === "artifact" && key[1] === result.artifact_id),
    );
    return result;
  }

  /**
   * A scope's artifact history, newest first, every type mixed.
   * GET /api/artifacts?scope=...&scope_id=...
   */
  static async listArtifacts(
    scope: ArtifactScope,
    scopeId: string,
    options?: { limit?: number; cursor?: string },
    language = resourceSession().language,
  ): Promise<ArtifactListResponse> {
    return readResource(
      resourceKeys.artifacts(
        scope,
        scopeId,
        options?.limit,
        options?.cursor,
        language,
      ),
      async () => {
        const params = new URLSearchParams({ scope, scope_id: scopeId });
        if (options?.limit) params.set("limit", String(options.limit));
        if (options?.cursor) params.set("cursor", options.cursor);
        const owner = resourceSession().cache;
        const response = await apiRequest<ArtifactListResponse>(
          `/api/artifacts?${params.toString()}`,
          { method: "GET" },
        );
        if (!options?.cursor) {
          const previous = owner.snapshot<ArtifactListResponse>(
            resourceKeys.artifacts(
              scope,
              scopeId,
              options?.limit,
              null,
              language,
            ),
          ).data;
          const active = (previous?.artifacts ?? []).filter(
            (entry) =>
              (entry.status === "queued" || entry.status === "generating") &&
              !response.artifacts.some(
                (item) => item.artifact_id === entry.artifact_id,
              ),
          );
          if (active.length)
            response.artifacts = [...active, ...response.artifacts].sort(
              (a, b) => b.created_at.localeCompare(a.created_at),
            );
        }
        return response;
      },
      true,
    );
  }

  /**
   * One entry with its full source snapshot.
   * GET /api/artifacts/:artifactId
   */
  static async getArtifact(
    artifactId: string,
    language = resourceSession().language,
  ): Promise<ArtifactDetail> {
    return readResource(
      resourceKeys.artifact(artifactId, language),
      async () => {
        return apiRequest<ArtifactDetail>(
          `/api/artifacts/${encodeURIComponent(artifactId)}`,
          { method: "GET" },
        );
      },
      true,
    );
  }

  /**
   * Fetch the rendered JSON payload for a ready artifact.
   * GET /api/artifacts/:artifactId/content
   */
  static async getArtifactContent(
    artifactId: string,
    language = resourceSession().language,
  ): Promise<ArtifactContentResponse> {
    return readResource(
      resourceKeys.artifactBody(artifactId, language),
      async () => {
        return apiRequest<ArtifactContentResponse>(
          `/api/artifacts/${encodeURIComponent(artifactId)}/content`,
          { method: "GET" },
        );
      },
      true,
    );
  }
}
