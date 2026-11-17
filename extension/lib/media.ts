/**
 * Where a save stands, in the three states the side panel shows. Reads both the
 * library row's status (`pending`, `processing`, `ready`, `failed`) and the
 * detail's (`ingested` … `ready_for_artifacts`, `cancelled`).
 */
export type MediaStage = "processing" | "ready" | "failed";

export function mediaStage(status: string | null | undefined): MediaStage {
  if (status === "ready" || status === "ready_for_artifacts" || status === "completed") return "ready";
  if (status === "failed" || status === "cancelled") return "failed";
  return "processing";
}
