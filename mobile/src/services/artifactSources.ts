import { loadArtifactSources } from "@media-summarizer/core/artifacts/sources";
import type { ArtifactScope } from "@media-summarizer/core/types/artifacts";
import { apiRequest } from "./apiClient";

export function getArtifactSources(scope: ArtifactScope, scopeId: string) {
  return loadArtifactSources(scope, scopeId, (path) => apiRequest(path, { method: "GET" }));
}
