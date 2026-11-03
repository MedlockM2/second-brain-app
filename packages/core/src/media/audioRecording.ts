/** Capture limits and presentation shared by both microphone adapters. */
export const MAX_RECORDING_SECONDS = 60 * 60;
export const RECORDING_BIT_RATE = 64_000;
export const RECORDING_SAMPLE_INTERVAL_MS = 120;
export const RECORDING_WAVEFORM_BARS = 40;

export function formatRecordingDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

/** A human title, with a filesystem-safe local date and time. */
export function recordingFileName(label: string, date: Date, extension: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${label} — ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${extension}`;
}

/** Metering is in dBFS: bring speech into a readable 0..1 waveform. */
export function recordingLevel(decibels: number | undefined): number {
  if (decibels === undefined || !Number.isFinite(decibels)) return 0;
  return Math.max(0, Math.min(1, (decibels + 60) / 60));
}
