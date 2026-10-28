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
  /** Create a fresh entry. Two submitted requests generate and are billed twice. */
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
    this.storeMutation(result, owner, language, scope, scopeId);
    return result;
  }

  static async retryArtifact(artifactId: string): Promise<ArtifactDetail> {
    const owner = mutationOwner();
    const language = resourceSession().language;
    const result = await apiRequest<ArtifactDetail>(`/api/artifacts/${encodeURIComponent(artifactId)}/retry`, { method: "POST" });
    this.storeMutation(result, owner, language, result.scope, result.scope_id);
    return result;
  }

  static async deleteArtifact(artifactId: string, scope: ArtifactScope, scopeId: string): Promise<void> {
    const owner = mutationOwner();
    const language = resourceSession().language;
    await apiRequest<void>(`/api/artifacts/${encodeURIComponent(artifactId)}`, { method: "DELETE" });
    if (resourceSession().cache !== owner) return;
    owner.remove(key => (key[0] === "artifact" || key[0] === "artifact-body") && key[1] === artifactId);
    const key = resourceKeys.artifacts(scope, scopeId, 50, null, language);
    const page = owner.snapshot<ArtifactListResponse>(key).data;
    if (page) owner.set(key, { ...page, artifacts: page.artifacts.filter(entry => entry.artifact_id !== artifactId) });
    owner.invalidate(key => key[0] === "artifact-list" && key[1] === scope && key[2] === scopeId);
    homeChanged(owner);
  }

  private static storeMutation(
    result: ArtifactDetail, owner: ReturnType<typeof mutationOwner>, language: string | null,
    scope: ArtifactScope, scopeId: string,
  ): void {
    if (
      resourceSession().cache !== owner ||
      resourceSession().language !== language
    )
      return;
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
