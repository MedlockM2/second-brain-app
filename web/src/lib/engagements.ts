import type { EngagementKind, RecordEngagementRequest } from "@media-summarizer/core/types/engagements";
import { apiRequest } from "../api";

/** An unreadable recency decoration must never fail the action being performed. */
export async function reportEngagement(kind: EngagementKind, id: string): Promise<void> {
  try {
    await apiRequest<void>("/api/engagements", { method: "POST", body: { kind, id } satisfies RecordEngagementRequest });
  } catch { /* Best-effort; a later explicit opening records a fresh engagement. */ }
}
