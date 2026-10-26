/**
 * The data behind the AI tab of a scope — a media item or a folder.
 *
 * Both screens used to carry their own copy of this, and the two had to be
 * changed in lockstep every time the tab changed. The rendering was already
 * shared (`ArtifactsPanel`); this is the other half, so a change to how the
 * tab behaves lands on both screens by construction.
 *
 * - **The history**, newest first, every type mixed, read from the shared
 *   resource cache. One request per scope serves both the finished entries and
 *   the ones still queued or generating, so there is never a request per type.
 *   It is re-read on focus, and every few seconds for as long as anything in it
 *   is in flight: the list itself says when to poll.
 * - **A new generation** is not asked from here. A tile opens the
 *   "Personnaliser" screen of its format (task-535), which sends the request
 *   with the options chosen there, waits for the answer so a refusal can be read
 *   where it was asked, and closes. The entry it created is folded into this
 *   history by `ArtifactService.generateArtifact`, so its generating row is in
 *   the list the screen closes onto.
 * - **A rerun of a failed entry** is asked from here, from the entry's row and
 *   without the screen: the same request again, with the parameters the entry
 *   was asked with, so it lands on that entry (`retried`) and not on the one at
 *   the defaults. The list carries no parameters, so the entry is read first.
 *   The tap is answered on the frame it lands, by a generating row for that
 *   format; a second tap on the same format while its request is out is
 *   ignored: it would ask the very same thing again.
 * - **The answer.** A generation the scope already holds comes back `reused`
 *   and queues nothing; the existing artifact then opens. Anything else is
 *   folded into the history, and its row moves on its own.
 * - **The refusal** of a rerun, typed and worded from its code (a quota
 *   reached, a source with no text, …), shown until the next tap.
 *
 * There is no "can this type be generated?" question any more (task-534): the
 * tiles are always offered. The same options over the same sources open what
 * exists; other options, or other sources, create a new entry.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { useUserPreferences } from "../contexts/UserPreferencesContext";
import { ArtifactService } from "../services/artifactService";
import { resourceKeys } from "../services/resourceCache";
import { describeArtifactRefusal } from "../lib/artifactRefusal";
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
  /** The formats whose rerun request has not answered yet. */
  pendingTypes: readonly ArtifactType[];
  /** Why the last rerun was refused, or `null`. */
  refusal: string | null;
  /** Open the "Personnaliser" screen of this format, which asks for the generation. */
  customize: (artifactType: ArtifactType) => void;
  /** Ask again for a failed entry, with the parameters it was asked with. */
  retry: (artifact: ArtifactSummary) => void;
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

  const [refusal, setRefusal] = useState<string | null>(null);
  const [pendingTypes, setPendingTypes] = useState<readonly ArtifactType[]>(
    [],
  );
  // The same set, readable synchronously: the guard against a second tap must
  // see a tap that landed in the same frame, before any re-render.
  const pendingRef = useRef(new Set<ArtifactType>());
  // Set when a tile opens "Personnaliser", cleared when this screen has the
  // focus back: a second tap landing before the modal covers the tab would
  // otherwise open it twice.
  const customizingRef = useRef(false);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
      setRefusal(null);
      router.push({
        pathname: "/artifacts/customize",
        params: { scope, scopeId, type: artifactType },
      });
    },
    [router, scope, scopeId],
  );

  const retry = useCallback(
    async (artifact: ArtifactSummary) => {
      const artifactType = artifact.artifact_type;
      if (!isAuthenticated || pendingRef.current.has(artifactType)) return;
      setRefusal(null);
      // Before any request, with nothing awaited in between: this is the update
      // that draws the generating row, on the frame the finger lifts.
      pendingRef.current.add(artifactType);
      setPendingTypes([...pendingRef.current]);

      try {
        // The list is the `scope-index` projection, which holds no parameters:
        // the entry itself says what it was asked with.
        const entry = await ArtifactService.getArtifact(artifact.artifact_id);
        const result = await ArtifactService.generateArtifact(
          scope,
          scopeId,
          artifactType,
          entry.request_parameters,
        );
        if (mountedRef.current && result.generation_outcome === "reused") {
          openArtifact(result);
        }
      } catch (err) {
        if (mountedRef.current) {
          setRefusal(describeArtifactRefusal(err, { scope }));
        }
      } finally {
        // Both paths: the merged entry carries a real status from here, and a
        // refusal must take the generating row away.
        pendingRef.current.delete(artifactType);
        if (mountedRef.current) setPendingTypes([...pendingRef.current]);
      }
    },
    [isAuthenticated, scope, scopeId, openArtifact],
  );

  return {
    history,
    historyLoading: !cached.data && !cached.error,
    historyError: cached.error
      ? getFriendlyErrorMessage(cached.error, {
          fallback: t("folder.artifactsLoadFailed"),
        })
      : null,
    refreshHistory: () => void refresh(),
    pendingTypes,
    refusal,
    customize,
    retry: (artifact) => void retry(artifact),
    openArtifact,
  };
}
