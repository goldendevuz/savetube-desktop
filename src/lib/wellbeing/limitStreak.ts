/**
 * The streak: how many days in a row the daily limit held. Only the days it broke are remembered (a day counts as
 * broken once the limit ran out or "Keep watching" was used), and every other day since the streak began is a good
 * one, also a day the app was never opened. The record travels as one synced setting; a device merges what it
 * reads into its own copy before saving, so a broken day is never forgotten.
 */

export const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];
const KEEP_BROKEN = 120;

export interface Streak {
  /** The first day (epoch day) the limit was watched. */
  s: number;
  /** Days the limit broke, newest first. */
  b: number[];
  /** The longest streak so far, in days. */
  best: number;
  /** The highest milestone already announced. */
  a: number;
}

export function parseStreak(text: string | null | undefined): Streak | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<Streak>;
    if (typeof raw.s !== "number" || !Number.isFinite(raw.s)) return null;
    const b = Array.isArray(raw.b) ? raw.b.filter((d): d is number => typeof d === "number" && Number.isFinite(d)) : [];
    return {
      s: raw.s,
      b: [...new Set(b)].sort((x, y) => y - x).slice(0, KEEP_BROKEN),
      best: typeof raw.best === "number" && raw.best > 0 ? raw.best : 0,
      a: typeof raw.a === "number" && raw.a > 0 ? raw.a : 0,
    };
  } catch {
    return null;
  }
}

export function encodeStreak(streak: Streak): string {
  return JSON.stringify(streak);
}

/** Two copies of the record in one: the earliest start, every broken day, the best of each count. */
export function mergeStreak(a: Streak | null, b: Streak | null): Streak | null {
  if (!a) return b;
  if (!b) return a;
  return {
    s: Math.min(a.s, b.s),
    b: [...new Set([...a.b, ...b.b])].sort((x, y) => y - x).slice(0, KEEP_BROKEN),
    best: Math.max(a.best, b.best),
    a: Math.max(a.a, b.a),
  };
}

/** The streak on `today`, in days: the days since the last broken one, today included. A broken today is zero. */
export function currentStreak(streak: Streak | null, today: number): number {
  if (!streak) return 0;
  const lastBroken = streak.b[0] ?? streak.s - 1;
  return lastBroken >= today ? 0 : today - lastBroken;
}

/**
 * The record after `today` was seen: started if it was new, today marked broken when `exceeded`, the best raised.
 * The same object comes back when nothing changed, so the caller can skip saving.
 */
export function recordDay(streak: Streak | null, today: number, exceeded: boolean): Streak {
  let next: Streak = streak ?? { s: today, b: [], best: 0, a: 0 };
  if (exceeded && !next.b.includes(today)) {
    // the run that ends today still counts for the best, also when the app was closed on those days
    const before = currentStreak(next, today - 1);
    next = { ...next, best: Math.max(next.best, before), b: [today, ...next.b].sort((x, y) => y - x).slice(0, KEEP_BROKEN) };
  }
  const days = currentStreak(next, today);
  if (days > next.best) next = { ...next, best: days };
  return next === streak ? streak : sameRecord(next, streak) ? (streak as Streak) : next;
}

function sameRecord(a: Streak, b: Streak | null): boolean {
  return b !== null && a.s === b.s && a.best === b.best && a.a === b.a && a.b.length === b.b.length && a.b.every((d, i) => d === b.b[i]);
}

/** The milestone reached today that was not announced yet, if any. */
export function newMilestone(streak: Streak | null, today: number): number | null {
  if (!streak) return null;
  const days = currentStreak(streak, today);
  const reached = MILESTONES.filter((m) => m <= days && m > streak.a);
  return reached[reached.length - 1] ?? null;
}

/** The next milestone after `days`, or null once all are reached. */
export function nextMilestone(days: number): number | null {
  return MILESTONES.find((m) => m > days) ?? null;
}
