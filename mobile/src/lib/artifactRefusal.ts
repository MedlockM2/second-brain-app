/**
 * Turn a refused generation into a sentence the user can act on.
 *
 * Every refusal the artifact API returns is typed and carries its numbers, so
 * neither AI tab has to fall back on a spinner that never ends or an error that
 * says nothing. Shared between the media tab and the folder tab: the same
 * refusals reach both, and they should read the same.
 */

import { getFriendlyErrorMessage } from "./getFriendlyErrorMessage";
import type { HttpError } from "./httpError";
import { getQuotaErrorCode, getQuotaErrorMessage } from "./quotaError";
import { formatNumber, t } from "../i18n";

export function describeArtifactRefusal(
  err: unknown,
  options?: { scope?: "media" | "folder" },
): string {
  const httpError = err as HttpError | undefined;
  const details = httpError?.details ?? {};
  const code = httpError?.code ?? httpError?.quotaErrorCode;
  const isFolder = options?.scope === "folder";

  // A generation over a single item is free, so only a folder can ever run
  // into the minute allowance. The backend sentence already carries the figures
  // (how many minutes this needs, how many are left, when they reset), so it is
  // repeated verbatim instead of being flattened into a generic quota line.
  const quotaCode = getQuotaErrorCode(err);
  if (quotaCode) {
    return getQuotaErrorMessage(err, quotaCode);
  }

  switch (code) {
    case "scope_empty":
      return isFolder
        ? t("artifacts.refusal.folderEmpty")
        : t("artifacts.refusal.mediaEmpty");
    case "scope_too_large": {
      const sourceCount = Number(details.source_count ?? 0);
      const maxSources = Number(details.max_sources ?? 0);
      if (sourceCount > 0 && maxSources > 0 && sourceCount > maxSources) {
        return t("artifacts.refusal.tooManySources", {
          count: formatNumber(sourceCount),
          max: formatNumber(maxSources),
        });
      }
      return t("artifacts.refusal.tooMuchText");
    }
    // No 409 left on this endpoint. A source still being transcribed is not
    // refused — the request is accepted and the tile spins until the backend
    // starts it (task-360) — and a source in a foreign language is not a refusal
    // either: the generation reads the original transcript and writes in the
    // reading language (task-398).
    default:
      return getFriendlyErrorMessage(err, {
        fallback: t("artifacts.refusal.generic"),
      });
  }
}
