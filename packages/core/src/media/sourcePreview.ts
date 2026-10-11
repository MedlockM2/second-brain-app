import type { MediaItemContract } from "../types/media";

/**
 * "L'essentiel" of a media: the hook and points of its review blurb, or where
 * that blurb stands. An absent blurb only means "coming" while its status says
 * `pending`; otherwise there is none to wait for. Same rule as
 * `mobile/src/components/SourcePreview.tsx`, shared with the web app from here.
 */
export type SourcePreviewState =
  | { status: "ready"; hook: string; points: string[] }
  | { status: "pending" }
  | { status: "unavailable" };

export function resolveSourcePreviewState(
  item: Pick<MediaItemContract, "review_blurb" | "review_blurb_status">,
): SourcePreviewState {
  const hook = item.review_blurb?.hook?.trim() ?? "";
  const points = (item.review_blurb?.points ?? []).map((point) => point.trim()).filter(Boolean);
  if (hook) return { status: "ready", hook, points };
  return item.review_blurb_status === "pending" ? { status: "pending" } : { status: "unavailable" };
}
