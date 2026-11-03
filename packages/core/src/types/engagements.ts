import type { ArtifactScope } from "./artifacts";
import type { ArtifactType } from "./media";

/** One target can have one recent entry, regardless of its parent or type. */
export type EngagementKind = "artifact" | "conversation";
export interface RecordEngagementRequest { kind: EngagementKind; id: string }
export interface RecentEngagement {
  kind: EngagementKind;
  id: string;
  scope: ArtifactScope;
  scope_id: string;
  title: string | null;
  artifact_type: ArtifactType | null;
  state: "pending" | "ready" | "failed";
  engaged_at: string;
  scope_title: string | null;
  scope_title_label_key: string | null;
  scope_created_at: string | null;
  creator_name: string | null;
  image_url: string | null;
  media_type: string | null;
  item_count: number | null;
  preview_images: string[];
}
export interface RecentEngagementsResponse { status: string; items: RecentEngagement[] }
