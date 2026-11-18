/**
 * Watching hours: the part of the day when videos may play. Times are clock times ("07:00") and the window may wrap
 * past midnight ("22:00" to "06:00"). A window whose two times are equal, or that cannot be read, never closes.
 */

const DAY_MINUTES = 24 * 60;

export function parseClock(time: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

/** Whether `nowMinute` (0 to 1439) lies inside the window from `from` to `to`. */
export function isOpen(from: string, to: string, nowMinute: number): boolean {
  const start = parseClock(from);
  const end = parseClock(to);
  if (start === null || end === null || start === end) return true;
  return start < end ? nowMinute >= start && nowMinute < end : nowMinute >= start || nowMinute < end;
}

/** Minutes until the window opens; 0 while it is open. */
export function minutesUntilOpen(from: string, to: string, nowMinute: number): number {
  if (isOpen(from, to, nowMinute)) return 0;
  const start = parseClock(from)!;
  return (((start - nowMinute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}
