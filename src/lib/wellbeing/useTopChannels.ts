import { useCallback, useEffect, useState } from "react";

import { getRecapSummary, type RankedItem, type ViewFormat } from "../api/recap";
import { flushRecapQueue } from "../recap/recapQueue";

const TOP_COUNT = 5;

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

export interface TopChannels {
  channels: RankedItem[];
  shortsShare: number | null;
}

/** The channels this month's watching went to, most time first, and how much of it was Shorts. */
export function useTopChannels() {
  const [data, setData] = useState<TopChannels | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void flushRecapQueue()
      .then(() => getRecapSummary(currentMonth(), "VIDEO"))
      .then((summary) => {
        if (cancelled) return;
        const channels = [...summary.video.topChannels].sort((a, b) => b.durationMs - a.durationMs).slice(0, TOP_COUNT);
        setData({ channels, shortsShare: shortsShare(summary.video.formatMs) });
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Failed to read the top channels", error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, failed, retry };
}
