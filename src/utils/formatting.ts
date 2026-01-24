/**
 * Formats seconds into a human-readable duration string (m:ss).
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined || seconds === 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const remainingSecs = totalSecs % 60;
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}
