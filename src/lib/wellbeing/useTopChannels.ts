import type { ViewFormat } from "../api/recap";

/** The month key the recap ledger uses for `now`: "2026-11". */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The share of video time spent in Shorts, from 0 to 1, or null when nothing was watched. */
export function shortsShare(formatMs: Partial<Record<ViewFormat, number>>): number | null {
  const total = (formatMs.LONG ?? 0) + (formatMs.SHORT ?? 0) + (formatMs.LIVE ?? 0);
  if (total <= 0) return null;
  return (formatMs.SHORT ?? 0) / total;
}

/** "35%": a share as a whole percentage. */
export function percentLabel(share: number): string {
  return `${Math.round(share * 100)}%`;
}
