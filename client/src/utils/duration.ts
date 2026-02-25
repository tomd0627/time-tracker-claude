export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export function formatHours(secs: number): string {
  return (secs / 3600).toFixed(2) + 'h';
}

export function secsToHours(secs: number): number {
  return Math.round((secs / 3600) * 100) / 100;
}

export function hoursToSecs(hours: number): number {
  return Math.round(hours * 3600);
}

/** Parse "HH:MM" or "H:MM" duration string to seconds */
export function parseDurationInput(value: string): number | null {
  const match = value.match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60;
}

/** Format seconds as "H:MM" for duration inputs */
export function formatDurationInput(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
