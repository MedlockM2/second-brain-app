import { useLocation, useNavigate, useParams } from "react-router";
import { MediaView } from "../components/media/MediaView";

/** What a search result hands the page it opens: the excerpt it quoted (`SearchPage`). */
export type MediaPageState = { passage: string };

function passageOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("passage" in state)) return null;
  return typeof state.passage === "string" ? state.passage : null;
}

/** /media/:mediaId — a media of the library, in its three panes. */
export function MediaPage() {
  const { mediaId = "" } = useParams();
  const navigate = useNavigate();
  const passage = passageOf(useLocation().state);
  // Keyed by id: another media is another page, with none of this one's state.
  return <MediaView key={mediaId} mediaId={mediaId} passage={passage} onDeleted={() => navigate("/library", { replace: true })} />;
}
