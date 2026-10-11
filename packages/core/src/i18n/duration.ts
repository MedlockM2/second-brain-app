import { t, tCount } from "./runtime";

/**
 * Durations in words, in the active locale.
 *
 * `formatMinutes` is `mobile/src/lib/planCopy.ts`'s, which cannot be shared
 * whole (it reads the purchases context); `formatDuration` is
 * `mobile/src/lib/formatDuration.ts`'s. Shared with the web app from here; the
 * mobile app keeps its copies until a mobile change points them here.
 */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.trunc(minutes));
  if (total < 60) return tCount("duration.minutes", total);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0
    ? tCount("duration.hours", hours)
    : t("duration.hoursMinutes", {
        hours: tCount("duration.hours", hours),
        minutes: tCount("duration.minutes", rest),
      });
}

/** A media length from seconds: "1h 52m", "21m 4s". */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m`;
  }
  return `${mins}m ${secs}s`;
}
