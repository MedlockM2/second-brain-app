/**
 * Which marker a media vignette shows for the lifecycle of its library entry, or
 * neither — resolved in one place so the answer can never be "both".
 *
 * The two predicates are already disjoint (`failed` on one side, `pending` and
 * `processing` on the other, `ready` and `null` on neither), but reading them
 * into a single value is what keeps them that way: a vignette's cover, its
 * subtitle line and its accessibility label then branch on the same answer
 * instead of each asking its own pair of questions.
 *
 * Two surfaces read it — the Home tile and the library / search row — and they
 * draw the same two markers, which is why this does not live in either of them.
 */

import { isFailedLibraryStatus } from "../components/MediaFailureBadge";
import { isProcessingLibraryStatus } from "../components/MediaProcessingSweep";

export type MediaStatusMarker = "failed" | "processing" | null;

export function mediaStatusMarker(status?: string | null): MediaStatusMarker {
  if (isFailedLibraryStatus(status)) return "failed";
  if (isProcessingLibraryStatus(status)) return "processing";
  return null;
}
