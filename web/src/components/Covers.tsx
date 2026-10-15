import { mediaStatusMarker, mediaTypeBadgeTone, mediaTypeIconName, mediaTypeLabelKey } from "@media-summarizer/core/media/mediaDisplay";
import { useI18n } from "../i18n/I18nProvider";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { ICON_PATHS } from "./icons.generated";

const IMAGE_RETRIES = 2;
const IMAGE_RETRY_MS = 2_000;

/**
 * A picture that comes back after a failed load (task-504): a cover that failed
 * once — a dropped connection, a CDN hiccup — is tried again twice, a little
 * later, before its glyph stands in for good. The URL is reloaded as is: a
 * signed URL must not be altered.
 */
function useRecoveringImage(url: string | null | undefined) {
  const [failure, setFailure] = useState<{ url: string; count: number; waiting: boolean } | null>(null);
  const failed = failure?.url === url ? failure : null;
  useEffect(() => {
    if (!failed?.waiting) return;
    const timer = window.setTimeout(() => setFailure((f) => (f ? { ...f, waiting: false } : f)), IMAGE_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [failed]);
  return {
    shown: Boolean(url) && !(failed && (failed.waiting || failed.count > IMAGE_RETRIES)),
    attempt: failed?.count ?? 0,
    onError: () =>
      setFailure((f) => ({ url: url ?? "", count: (f && f.url === url ? f.count : 0) + 1, waiting: true })),
  };
}

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
  const image = useRecoveringImage(imageUrl);
  const marker = mediaStatusMarker(status);
  const glyph = mediaTypeIconName(mediaType);
  return (
    <div className={marker === "processing" ? "wcover processing" : "wcover"}>
      {image.shown ? (
        <img key={image.attempt} src={imageUrl!} alt="" loading="lazy" onError={image.onError} />
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
        cells[i] ? <MosaicCell key={i} url={cells[i]} /> : <i key={i} />,
      )}
    </div>
  );
}

function MosaicCell({ url }: { url: string }) {
  const image = useRecoveringImage(url);
  return image.shown ? <img key={image.attempt} src={url} alt="" loading="lazy" onError={image.onError} /> : <i />;
}

/** A media type's pill, in its family's colour (`mediaTypeBadgeTone`, shared with the mobile). */
export function TypeBadge({ type }: { type?: string | null }) {
  const { t } = useI18n();
  return <span className={`badge tone-${mediaTypeBadgeTone(type)}`}>{t(mediaTypeLabelKey(type))}</span>;
}
