import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { resourceKeys } from "../services/resourceCache";
import { startHomeSectionSpan } from "../lib/crashReporting";
import { subscribeToMediaSaves } from "../lib/mediaSaveNotice";
import { EngagementService } from "../services/engagementService";
import { OrganizationService } from "../services/organizationService";
import type { RecentEngagement } from "@media-summarizer/core/types/engagements";

/** Independent session snapshots: a refresh never blanks a readable section. */
export function useHomeSections() {
  const { isAuthenticated } = useAuth();
  const recent = useResourceSnapshot<RecentEngagement[]>(resourceKeys.recentEngagements());
  const unsorted = useResourceSnapshot<number>(resourceKeys.unsortedCount);
  const settled = useRef({ recent: recent.data !== undefined, unsorted: unsorted.data !== undefined });
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const read = async (kind: "recent" | "unsorted") => {
      const span = settled.current[kind] ? null : startHomeSectionSpan(
        kind === "recent" ? "continue_learning" : "unsorted_count",
      );
      try {
        if (kind === "recent") await EngagementService.listRecent(12);
        else await OrganizationService.getUnsortedCount();
        span?.end("ok");
      } catch { span?.end("error"); }
      finally { settled.current[kind] = true; }
    };
    await Promise.all([read("recent"), read("unsorted")]);
  }, [isAuthenticated]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => subscribeToMediaSaves(() => { void refresh(); }), [refresh]);
  return {
    continueLearning: recent.data ?? [],
    hasLoadedContinueLearning: recent.data !== undefined || Boolean(recent.error),
    unsortedCount: unsorted.data ?? 0,
    hasLoadedUnsortedCount: unsorted.data !== undefined || Boolean(unsorted.error),
    refresh,
  };
}
