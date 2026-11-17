import type { RankedItem, RecapWeek, ViewFormat } from "../api/recap";

/**
 * What one device publishes about its own watching, so every device can show the same numbers for all of them:
 * the last days (date to ms, watching and listening), and this month's channels and format split of video. A
 * device only ever publishes its own entry; for each device the newest publication (`u`, in ms) stands.
 */
export interface DeviceStats {
  /** What the device is called in the lists. */
  n: string;
  /** When it was published, ms. */
  u: number;
  /** The month `ch` and `fmt` are for, "2026-11". */
  m: string;
  days: Record<string, number>;
  /** This month's channels: id, name, ms. */
  ch: [string, string, number][];
  /** This month's video time: long, Shorts, live (ms). */
  fmt: [number, number, number];
}

export type SharedStats = Record<string, DeviceStats>;

/** Devices not heard from for this long, counted from the newest publication, are dropped. */
const KEEP_MS = 45 * 24 * 60 * 60 * 1000;
const CHANNELS_PER_DEVICE = 15;

export function parseStats(raw: string | null | undefined): SharedStats {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: SharedStats = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.u !== "number") continue;
    const days: Record<string, number> = {};
    if (typeof e.days === "object" && e.days !== null) {
      for (const [date, ms] of Object.entries(e.days as Record<string, unknown>)) {
        if (typeof ms === "number" && ms >= 0) days[date] = ms;
      }
    }
    const ch: [string, string, number][] = Array.isArray(e.ch)
      ? (e.ch as unknown[]).flatMap((row) =>
          Array.isArray(row) && typeof row[0] === "string" && typeof row[2] === "number"
            ? [[row[0], String(row[1] ?? ""), row[2]] as [string, string, number]]
            : [],
        )
      : [];
    const f = Array.isArray(e.fmt) ? (e.fmt as unknown[]).map((n) => (typeof n === "number" ? n : 0)) : [];
    out[id] = {
      n: typeof e.n === "string" ? e.n : "",
      u: e.u,
      m: typeof e.m === "string" ? e.m : "",
      days,
      ch,
      fmt: [f[0] ?? 0, f[1] ?? 0, f[2] ?? 0],
    };
  }
  return out;
}

function prune(shared: SharedStats): SharedStats {
  const times = Object.values(shared).map((entry) => entry.u);
  if (times.length === 0) return shared;
  const newest = Math.max(...times);
  return Object.fromEntries(Object.entries(shared).filter(([, entry]) => entry.u + KEEP_MS >= newest));
}

/** The text that is saved and sent: ids in order, so the same statistics always give the same text. */
export function encodeStats(shared: SharedStats): string {
  const pruned = prune(shared);
  const sorted: SharedStats = {};
  for (const id of Object.keys(pruned).sort()) sorted[id] = pruned[id]!;
  return JSON.stringify(sorted);
}

/** For each device, the newest publication. */
export function mergeStats(a: SharedStats, b: SharedStats): SharedStats {
  const out: SharedStats = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    const known = out[id];
    if (!known || entry.u > known.u) out[id] = entry;
  }
  return prune(out);
}

/** This device's entry from its own recap: the week and this month's video. */
export function ownEntry(args: {
  name: string;
  now: number;
  month: string;
  week: RecapWeek;
  channels: RankedItem[];
  formatMs: Partial<Record<ViewFormat, number>>;
}): DeviceStats {
  const days: Record<string, number> = {};
  for (const [date, ms] of args.week.days) days[date] = ms;
  const ch = [...args.channels]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, CHANNELS_PER_DEVICE)
    .map((c): [string, string, number] => [c.id, c.name, c.durationMs]);
  return {
    n: args.name,
    u: args.now,
    m: args.month,
    days,
    ch,
    fmt: [args.formatMs.LONG ?? 0, args.formatMs.SHORT ?? 0, args.formatMs.LIVE ?? 0],
  };
}

export interface DeviceTotal {
  id: string;
  name: string;
  ms: number;
  own: boolean;
}

/** The days of `dates` with every device's time added, and each device's part of the whole. */
export function combineWeek(shared: SharedStats, dates: string[], ownId: string) {
  const days: [string, number][] = dates.map((date) => [
    date,
    Object.values(shared).reduce((sum, entry) => sum + (entry.days[date] ?? 0), 0),
  ]);
  const devices: DeviceTotal[] = Object.entries(shared)
    .map(([id, entry]) => ({
      id,
      name: entry.n,
      ms: dates.reduce((sum, date) => sum + (entry.days[date] ?? 0), 0),
      own: id === ownId,
    }))
    .filter((device) => device.ms > 0 || device.own)
    .sort((a, b) => b.ms - a.ms || a.id.localeCompare(b.id));
  return { days, devices };
}

export interface ChannelTotal {
  id: string;
  name: string;
  ms: number;
}

/** This month's channels with every device's time added, the most watched first. */
export function combineChannels(shared: SharedStats, month: string, count: number): ChannelTotal[] {
  const totals = new Map<string, ChannelTotal>();
  for (const entry of Object.values(shared)) {
    if (entry.m !== month) continue;
    for (const [id, name, ms] of entry.ch) {
      const known = totals.get(id);
      if (known) known.ms += ms;
      else totals.set(id, { id, name, ms });
    }
  }
  return [...totals.values()].sort((a, b) => b.ms - a.ms || a.id.localeCompare(b.id)).slice(0, count);
}

/** The share of this month's video time, over every device, that was Shorts: 0 to 1, or null with nothing watched. */
export function combinedShortsShare(shared: SharedStats, month: string): number | null {
  let long = 0;
  let short = 0;
  let live = 0;
  for (const entry of Object.values(shared)) {
    if (entry.m !== month) continue;
    [long, short, live] = [long + entry.fmt[0], short + entry.fmt[1], live + entry.fmt[2]];
  }
  const total = long + short + live;
  return total <= 0 ? null : short / total;
}
