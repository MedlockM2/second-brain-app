import { useNavigate, useParams } from "react-router";
import { MediaView } from "../components/media/MediaView";

/** /media/:mediaId — a media of the library, in its three panes. */
export function MediaPage() {
  const { mediaId = "" } = useParams();
  const navigate = useNavigate();
  // Keyed by id: another media is another page, with none of this one's state.
  return <MediaView key={mediaId} mediaId={mediaId} onDeleted={() => navigate("/library", { replace: true })} />;
}
