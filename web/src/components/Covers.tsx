import { mediaStatusMarker, mediaTypeIconName } from "@media-summarizer/core/media/mediaDisplay";
import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { ICON_PATHS } from "./icons.generated";

/**
 * A media's 16:9 cover: the picture when there is one, the glyph of its type
 * otherwise (or when the picture fails to load), with the processing sweep or
 * the failure badge of its library status.
 */
export function MediaCover({
  imageUrl,
  mediaType,
  status,
}: {
  imageUrl?: string | null;
  mediaType?: string | null;
  status?: string | null;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const marker = mediaStatusMarker(status);
  const glyph = mediaTypeIconName(mediaType);
  const showImage = Boolean(imageUrl) && broken !== imageUrl;
  return (
    <div className={marker === "processing" ? "wcover processing" : "wcover"}>
      {showImage ? (
        <img src={imageUrl!} alt="" loading="lazy" onError={() => setBroken(imageUrl ?? null)} />
      ) : (
        <Icon name={glyph in ICON_PATHS ? (glyph as IconName) : "link-outline"} />
      )}
      {marker === "failed" && (
        <span className="fbadge">
          <Icon name="alert-circle-outline" size={14} />
        </span>
      )}
    </div>
  );
}

/** A folder's tile on the Home: up to four covers of its newest items, in a 2 × 2 grid. */
export function FolderMosaic({ images }: { images: string[] }) {
  const cells = images.slice(0, 4);
  return (
    <div className="mosaic">
      {[0, 1, 2, 3].map((i) =>
        cells[i] ? <img key={i} src={cells[i]} alt="" loading="lazy" /> : <i key={i} />,
      )}
    </div>
  );
}
