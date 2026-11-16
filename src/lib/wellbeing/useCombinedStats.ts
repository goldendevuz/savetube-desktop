import { useCallback, useEffect, useState } from "react";

import { getRecapSummary, getRecapWeek, type RecapWeek } from "../api/recap";
import { getSetting } from "../api/db";
import { flushRecapQueue } from "../recap/recapQueue";
import { SETTINGS } from "../settings/schema";
import { setSettingValue } from "../../store/useAppSettingsStore";
import { currentMonth } from "./useTopChannels";
import { deviceLabel, ensureOwnId } from "./useDailyLimit";
import {
  combineChannels,
  combineWeek,
  combinedShortsShare,
  encodeStats,
  mergeStats,
  ownEntry,
  parseStats,
  type ChannelTotal,
  type DeviceTotal,
  type SharedStats,
} from "./sharedStats";

const TOP_COUNT = 5;
/** An unchanged entry is published again only after this long, so sync is not woken for nothing. */
const REPUBLISH_MS = 10 * 60_000;
/** The last result is reused this long when two cards ask at once. */
const CACHE_MS = 20_000;

export interface PublishedStats {
  shared: SharedStats;
  ownId: string;
  month: string;
  /** This device's own week: the dates to show, and where its ledger starts. */
  week: RecapWeek;
}

/**
 * Publishes this device's watching so the other devices can add it up, and returns every device's statistics
 * (what the others published, merged with this device's). Read once per visit to a page that shows them.
 */
export async function publishOwnStats(): Promise<PublishedStats> {
  await flushRecapQueue();
  const month = currentMonth();
  const [week, summary, ownId] = await Promise.all([getRecapWeek(), getRecapSummary(month, "VIDEO"), ensureOwnId()]);
  const now = Date.now();
  const entry = ownEntry({
    name: deviceLabel(),
    now,
    month,
    week,
    channels: summary.video.topChannels,
    formatMs: summary.video.formatMs,
  });
  const saved = parseStats(await getSetting(SETTINGS.WATCH_STATS));
  const known = saved[ownId];
  const unchanged =
    known !== undefined &&
    now - known.u < REPUBLISH_MS &&
    JSON.stringify({ ...known, u: 0 }) === JSON.stringify({ ...entry, u: 0 });
  const merged = unchanged ? saved : mergeStats(saved, { [ownId]: entry });
  if (!unchanged) await setSettingValue(SETTINGS.WATCH_STATS, encodeStats(merged));
  return { shared: merged, ownId, month, week };
}

let cached: { at: number; value: Promise<PublishedStats> } | null = null;

/** Forgets the last result, so the next read goes to the ledger again. */
export function resetPublishedCache(): void {
  cached = null;
}

function published(force: boolean): Promise<PublishedStats> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = publishOwnStats();
  cached = { at: Date.now(), value };
  value.catch(() => {
    if (cached?.value === value) cached = null;
  });
  return value;
}

export interface CombinedStats {
  /** The last seven days, every device added; `startedAt` is this device's. */
  week: RecapWeek;
  /** Each device's part of the week. */
  devices: DeviceTotal[];
  /** This month's most watched channels, every device added. */
  channels: ChannelTotal[];
  shortsShare: number | null;
}

/** Watching on all devices together, with each device's part, for the Wellbeing page. */
export function useCombinedStats() {
  const [stats, setStats] = useState<CombinedStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    published(attempt > 0)
      .then(({ shared, ownId, month, week }) => {
        if (cancelled) return;
        const dates = week.days.map(([date]) => date);
        const { days, devices } = combineWeek(shared, dates, ownId);
        setStats({
          week: { ...week, days },
          devices,
          channels: combineChannels(shared, month, TOP_COUNT),
          shortsShare: combinedShortsShare(shared, month),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Failed to read watch statistics", error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { stats, failed, retry };
}

const PUBLISH_FIRST_MS = 20_000;
const PUBLISH_EVERY_MS = 10 * 60_000;

/** Publishes this device's statistics a little after the app starts and every ten minutes, whether or not a page shows them. */
export function usePublishStats() {
  useEffect(() => {
    const run = () => {
      void published(true).catch((error) => console.warn("Failed to publish watch statistics", error));
    };
    const first = setTimeout(run, PUBLISH_FIRST_MS);
    const every = setInterval(run, PUBLISH_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
}
