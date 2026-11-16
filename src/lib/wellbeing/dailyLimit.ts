/**
 * The daily limit, the same rules as the Android app's `DailyLimitPolicy`: playing time is counted on one
 * local day, a warning goes out five minutes before the end, and "Keep watching" adds fifteen minutes.
 */

export const DAILY_LIMIT_MIN_MINUTES = 15;
export const DAILY_LIMIT_MAX_MINUTES = 8 * 60;
export const DAILY_LIMIT_STEP_MINUTES = 15;
export const DAILY_LIMIT_DEFAULT_MINUTES = 2 * 60;
export const EXTENSION_MS = 15 * 60_000;
export const WARNING_MS = 5 * 60_000;
/** Turning the limit off or lowering it after it ran out waits this long first. */
export const WAIT_MS = 30_000;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export interface DailyLimitSettings {
  enabled: boolean;
  minutes: number;
  countMusic: boolean;
}

/**
 * Playing time counted on one local day (`day` is an epoch day). `extraMs` is the time "Keep watching" added that
 * day, `warned` whether the five-minute warning went out, `reached` whether the limit ran out.
 */
export interface DailyTally {
  day: number;
  playedMs: number;
  extraMs: number;
  warned: boolean;
  reached: boolean;
}

export const MINUTE_CHOICES: number[] = Array.from(
  { length: (DAILY_LIMIT_MAX_MINUTES - DAILY_LIMIT_MIN_MINUTES) / DAILY_LIMIT_STEP_MINUTES + 1 },
  (_, index) => DAILY_LIMIT_MIN_MINUTES + index * DAILY_LIMIT_STEP_MINUTES,
);

/** The local calendar day of a moment, as a number of days. */
export function localEpochDay(ms: number): number {
  return Math.floor((ms - new Date(ms).getTimezoneOffset() * MS_PER_MINUTE) / MS_PER_DAY);
}

/** `minutes` if it is one of the choices, otherwise the default. */
export function validMinutes(minutes: number | null | undefined): number {
  return minutes != null && MINUTE_CHOICES.includes(minutes) ? minutes : DAILY_LIMIT_DEFAULT_MINUTES;
}

export function emptyTally(day: number): DailyTally {
  return { day, playedMs: 0, extraMs: 0, warned: false, reached: false };
}

/**
 * The tally to count on for `today`. A later day starts from nothing. An earlier one means the clock was moved
 * back, so the stored day carries on rather than handing out a fresh day.
 */
export function rollover(tally: DailyTally | null, today: number): DailyTally {
  return tally === null || today > tally.day ? emptyTally(today) : tally;
}

export function addPlayed(tally: DailyTally, playedMs: number): DailyTally {
  return { ...tally, playedMs: tally.playedMs + Math.max(0, playedMs) };
}

export function allowanceMs(minutes: number, tally: DailyTally): number {
  return minutes * MS_PER_MINUTE + tally.extraMs;
}

export function remainingMs(minutes: number, tally: DailyTally): number {
  return Math.max(0, allowanceMs(minutes, tally) - tally.playedMs);
}

/** True once per day, when the time left first drops to the warning and the limit has not run out yet. */
export function shouldWarn(minutes: number, tally: DailyTally): boolean {
  const remaining = remainingMs(minutes, tally);
  return !tally.warned && remaining > 0 && remaining <= WARNING_MS;
}

/**
 * Exactly `EXTENSION_MS` more from now, also when playing ran past the limit. `reached` and `warned` stay as they
 * are: the limit did run out today, so turning it off still waits, and the warning goes out once a day.
 */
export function extend(minutes: number, tally: DailyTally): DailyTally {
  const overrunMs = Math.max(0, tally.playedMs - allowanceMs(minutes, tally));
  return { ...tally, extraMs: tally.extraMs + overrunMs + EXTENSION_MS };
}

/** Whether the limit is used up: nothing left of the allowance. */
export function isUsedUp(minutes: number, tally: DailyTally): boolean {
  return remainingMs(minutes, tally) === 0;
}

/** Turning the limit off or lowering it after it ran out today waits first. Raising it does not. */
export function changeNeedsWait(
  current: DailyLimitSettings,
  next: DailyLimitSettings,
  tally: DailyTally | null,
  today: number,
): boolean {
  const ranOutToday = tally !== null && tally.reached && today <= tally.day;
  if (!ranOutToday || !current.enabled) return false;
  return !next.enabled || next.minutes < current.minutes || (current.countMusic && !next.countMusic);
}
