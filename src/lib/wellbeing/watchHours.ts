/**
 * When the user watches: the playing time of this device, by day and hour of day (on the chosen time zone's clock),
 * for the last 28 days. It is kept on this device only.
 */

export const HOURS_KEEP_DAYS = 28;

/** Epoch day (as text) to 24 amounts of ms, one for each hour of the day. */
export type HoursLedger = Record<string, number[]>;

export function parseHours(text: string | null | undefined): HoursLedger {
  if (!text) return {};
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const ledger: HoursLedger = {};
    for (const [day, hours] of Object.entries(raw)) {
      if (!Array.isArray(hours) || hours.length !== 24) continue;
      ledger[day] = hours.map((ms) => (typeof ms === "number" && ms > 0 ? ms : 0));
    }
    return ledger;
  } catch {
    return {};
  }
}

export function encodeHours(ledger: HoursLedger): string {
  return JSON.stringify(ledger);
}

/** `ms` more playing time in `hour` of `day`; days older than the kept window are dropped. */
export function addHours(ledger: HoursLedger, day: number, hour: number, ms: number): HoursLedger {
  if (ms <= 0 || hour < 0 || hour > 23) return ledger;
  const next: HoursLedger = {};
  for (const [key, hours] of Object.entries(ledger)) {
    if (Number(key) > day - HOURS_KEEP_DAYS) next[key] = hours;
  }
  const hours = [...(next[String(day)] ?? new Array<number>(24).fill(0))];
  hours[hour] = (hours[hour] ?? 0) + ms;
  next[String(day)] = hours;
  return next;
}

export interface HoursSummary {
  /** Time at each hour of the day, all days together. */
  byHour: number[];
  total: number;
  /** The hour with the most time, or null when nothing was counted. */
  peakHour: number | null;
}

export function summarizeHours(ledger: HoursLedger): HoursSummary {
  const byHour = new Array<number>(24).fill(0);
  for (const hours of Object.values(ledger)) hours.forEach((ms, hour) => (byHour[hour] = (byHour[hour] ?? 0) + ms));
  const total = byHour.reduce((sum, ms) => sum + ms, 0);
  const peak = Math.max(...byHour);
  return { byHour, total, peakHour: total > 0 ? byHour.indexOf(peak) : null };
}
