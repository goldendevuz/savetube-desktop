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

// ---------------------------------------------------------------------------------------------------------
// The count of every device. A device only ever changes its own entry, and the total is the sum of the entries
// of the day, so two devices playing at once never overwrite each other. The entries travel as one setting and
// a receiving device merges them into its own instead of replacing them.
// ---------------------------------------------------------------------------------------------------------

/** What one device counted on one day: name, day, played time, Keep watching time and the two flags. */
export interface DeviceCount {
  n: string;
  d: number;
  p: number;
  x: number;
  r: boolean;
  w: boolean;
}

export type SharedTally = Record<string, DeviceCount>;

/** Entries more than this many days older than the newest are dropped. */
export const SHARED_KEEP_DAYS = 7;

export function parseShared(raw: string | null | undefined): SharedTally {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: SharedTally = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.d !== "number") continue;
    out[id] = {
      n: typeof e.n === "string" ? e.n : "",
      d: e.d,
      p: Math.max(0, Number(e.p ?? 0)),
      x: Math.max(0, Number(e.x ?? 0)),
      r: e.r === true,
      w: e.w === true,
    };
  }
  return out;
}

export function pruneShared(shared: SharedTally): SharedTally {
  const days = Object.values(shared).map((entry) => entry.d);
  if (days.length === 0) return shared;
  const newest = Math.max(...days);
  return Object.fromEntries(Object.entries(shared).filter(([, entry]) => entry.d >= newest - SHARED_KEEP_DAYS));
}

/** The text that is saved and sent: ids in order, so the same counts always give the same text. */
export function encodeShared(shared: SharedTally): string {
  const pruned = pruneShared(shared);
  const sorted: SharedTally = {};
  for (const id of Object.keys(pruned).sort()) {
    const e = pruned[id]!;
    sorted[id] = { n: e.n, d: e.d, p: e.p, x: e.x, r: e.r, w: e.w };
  }
  return JSON.stringify(sorted);
}

/** One device's entry from two copies: the later day wins; on the same day the larger count and either flag. */
function mergeCount(a: DeviceCount, b: DeviceCount): DeviceCount {
  if (a.d !== b.d) return a.d > b.d ? a : b;
  return { n: a.n || b.n, d: a.d, p: Math.max(a.p, b.p), x: Math.max(a.x, b.x), r: a.r || b.r, w: a.w || b.w };
}

export function mergeShared(a: SharedTally, b: SharedTally): SharedTally {
  const out: SharedTally = { ...a };
  for (const [id, count] of Object.entries(b)) {
    const own = out[id];
    out[id] = own ? mergeCount(own, count) : count;
  }
  return pruneShared(out);
}

/** The newest day any device has counted, or null when none has. */
export function latestDay(shared: SharedTally): number | null {
  const days = Object.values(shared).map((entry) => entry.d);
  return days.length === 0 ? null : Math.max(...days);
}

/** All devices' count for `day` as one tally. */
export function aggregate(shared: SharedTally, day: number): DailyTally {
  const entries = Object.values(shared).filter((entry) => entry.d === day);
  return {
    day,
    playedMs: entries.reduce((sum, entry) => sum + entry.p, 0),
    extraMs: entries.reduce((sum, entry) => sum + entry.x, 0),
    warned: entries.some((entry) => entry.w),
    reached: entries.some((entry) => entry.r),
  };
}

/**
 * Records `tally`, the all-devices count of its day, as this device's own entry: whatever it grew by since the
 * stored total is this device's. Another device's entry is never touched.
 */
export function withOwn(shared: SharedTally, deviceId: string, name: string, tally: DailyTally): SharedTally {
  const total = aggregate(shared, tally.day);
  const current = shared[deviceId];
  const own: DeviceCount = current && current.d === tally.day ? current : { n: name, d: tally.day, p: 0, x: 0, r: false, w: false };
  const next: DeviceCount = {
    n: name || own.n,
    d: tally.day,
    p: own.p + Math.max(0, tally.playedMs - total.playedMs),
    x: own.x + Math.max(0, tally.extraMs - total.extraMs),
    r: own.r || tally.reached,
    w: own.w || tally.warned,
  };
  return pruneShared({ ...shared, [deviceId]: next });
}

/** One device's share of a day, for the list under the total. */
export interface DeviceShare {
  id: string;
  name: string;
  ms: number;
  own: boolean;
}

/** The devices that counted on `day`, the one with the most time first. */
export function deviceShares(shared: SharedTally, day: number, ownId: string): DeviceShare[] {
  return Object.entries(shared)
    .filter(([, entry]) => entry.d === day)
    .map(([id, entry]) => ({ id, name: entry.n, ms: entry.p, own: id === ownId }))
    .sort((a, b) => b.ms - a.ms || a.id.localeCompare(b.id));
}
