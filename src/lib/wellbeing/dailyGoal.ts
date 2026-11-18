/**
 * Today's goal: one thing to get done today, written by the user and ticked off when done. It belongs to one
 * day (an epoch day) and is simply not shown the next day. The newest edit wins when two devices disagree.
 */

export const GOAL_MAX_LENGTH = 80;

export interface DailyGoal {
  /** The day (epoch day) the goal is for. */
  d: number;
  t: string;
  done: boolean;
  /** When it was last changed, in ms, to tell which copy is newer. */
  u: number;
}

export function parseGoal(text: string | null | undefined): DailyGoal | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<DailyGoal>;
    if (typeof raw.d !== "number" || typeof raw.t !== "string" || !Number.isFinite(raw.d)) return null;
    return { d: raw.d, t: raw.t.slice(0, GOAL_MAX_LENGTH), done: raw.done === true, u: typeof raw.u === "number" ? raw.u : 0 };
  } catch {
    return null;
  }
}

export function encodeGoal(goal: DailyGoal): string {
  return JSON.stringify(goal);
}

/** The goal that counts for `today`, or null when there is none (or it is from another day). */
export function goalFor(goal: DailyGoal | null, today: number): DailyGoal | null {
  return goal && goal.d === today && goal.t.trim() !== "" ? goal : null;
}

/** The newer of two copies. */
export function mergeGoal(a: DailyGoal | null, b: DailyGoal | null): DailyGoal | null {
  if (!a) return b;
  if (!b) return a;
  return b.u > a.u ? b : a;
}

export function writeGoal(today: number, text: string, done: boolean, now: number): DailyGoal {
  return { d: today, t: text.slice(0, GOAL_MAX_LENGTH), done, u: now };
}
