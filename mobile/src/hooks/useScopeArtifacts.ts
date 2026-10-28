import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { useUserPreferences } from "../contexts/UserPreferencesContext";
import { ArtifactService } from "../services/artifactService";
import { resourceKeys } from "../services/resourceCache";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { t } from "../i18n";
import type {
  ArtifactListResponse,
  ArtifactScope,
  ArtifactSummary,
} from "@media-summarizer/core/types/artifacts";
import type { ArtifactType } from "@media-summarizer/core/types/media";

const ARTIFACT_POLL_INTERVAL_MS = 3000;

const EMPTY_HISTORY: readonly ArtifactSummary[] = [];

export interface ScopeArtifacts {
  /** The scope's entries, newest first, as the API lists them. */
  history: readonly ArtifactSummary[];
  /** True while the first read of the history is in flight. */
  historyLoading: boolean;
  /** Why the history could not be read, or `null`. */
  historyError: string | null;
  refreshHistory: () => void;
  /** Open the "Personnaliser" screen of this format, which asks for the generation. */
  customize: (artifactType: ArtifactType) => void;
  /** Ask again for a failed entry, with the parameters it was asked with. */
  retry: (artifact: ArtifactSummary) => Promise<void>;
  remove: (artifact: ArtifactSummary) => Promise<void>;
  openArtifact: (artifact: Pick<ArtifactSummary, "artifact_id">) => void;
}

export function useScopeArtifacts(
  scope: ArtifactScope,
  scopeId: string,
): ScopeArtifacts {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { readingLanguage } = useUserPreferences();
  const cached = useResourceSnapshot<ArtifactListResponse>(
    resourceKeys.artifacts(scope, scopeId),
  );
  const history = cached.data?.artifacts ?? EMPTY_HISTORY;

  // Set when a tile opens "Personnaliser", cleared when this screen has the
  // focus back: a second tap landing before the modal covers the tab would
  // otherwise open it twice.
  const customizingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // A failure is published by the snapshot rather than thrown: the panel then
  // offers a Retry instead of claiming the scope has nothing generated.
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await ArtifactService.listArtifacts(
        scope,
        scopeId,
        undefined,
        readingLanguage,
      );
    } catch {
      /* The resource snapshot keeps readable data and exposes the failure. */
    }
  }, [isAuthenticated, scope, scopeId, readingLanguage]);

  useFocusEffect(
    useCallback(() => {
      customizingRef.current = false;
      void refresh();
    }, [refresh]),
  );

  const hasInFlight = useMemo(
    () =>
      history.some(
        (artifact) =>
          artifact.status === "queued" || artifact.status === "generating",
      ),
    [history],
  );

  useEffect(() => {
    if (!hasInFlight) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void refresh();
    }, ARTIFACT_POLL_INTERVAL_MS);
  }, [hasInFlight, refresh]);

  const openArtifact = useCallback(
    (artifact: Pick<ArtifactSummary, "artifact_id">) => {
      router.push(`/artifacts/${artifact.artifact_id}`);
    },
    [router],
  );

  const customize = useCallback(
    (artifactType: ArtifactType) => {
      if (customizingRef.current) return;
      customizingRef.current = true;
      router.push({
        pathname: "/artifacts/customize",
        params: { scope, scopeId, type: artifactType },
      });
    },
    [router, scope, scopeId],
  );

  const retry = useCallback(async (artifact: ArtifactSummary) => {
    try {
      await ArtifactService.retryArtifact(artifact.artifact_id);
    } finally {
      void refresh();
    }
  }, [refresh]);
  const remove = useCallback(async (artifact: ArtifactSummary) => {
    try {
      await ArtifactService.deleteArtifact(artifact.artifact_id, scope, scopeId);
    } finally {
      void refresh();
    }
  }, [refresh, scope, scopeId]);

  return {
    history,
    historyLoading: !cached.data && !cached.error,
    historyError: cached.error
      ? getFriendlyErrorMessage(cached.error, {
          fallback: t("folder.artifactsLoadFailed"),
        })
      : null,
    refreshHistory: () => void refresh(),
    customize,
    retry,
    remove,
    openArtifact,
  };
}
