import { describe, expect, it } from "vitest";

import type { RankedItem } from "../api/recap";
import {
  combineChannels,
  combineWeek,
  combinedShortsShare,
  encodeStats,
  mergeStats,
  ownEntry,
  parseStats,
  type DeviceStats,
  type SharedStats,
} from "./sharedStats";

const MIN = 60_000;
const device = (over: Partial<DeviceStats> = {}): DeviceStats => ({
  n: "",
  u: 1000,
  m: "2026-11",
  days: {},
  ch: [],
  fmt: [0, 0, 0],
  ...over,
});
const ranked = (id: string, name: string, durationMs: number): RankedItem => ({
  id,
  name,
  count: 1,
  durationMs,
  detail: "",
  imageUrl: "",
  kind: "CHANNEL",
});

describe("a device's own entry", () => {
  it("holds the week, the busiest channels of the month and the format split", () => {
    const channels = Array.from({ length: 20 }, (_, i) => ranked(`c${i}`, `Channel ${i}`, (i + 1) * MIN));
    const entry = ownEntry({
      name: "Windows PC",
      now: 5000,
      month: "2026-11",
      week: { days: [["2026-11-15", 10 * MIN], ["2026-11-16", 20 * MIN]], startedAt: 0 },
      channels,
      formatMs: { LONG: 3 * MIN, SHORT: MIN },
    });
    expect(entry).toMatchObject({ n: "Windows PC", u: 5000, m: "2026-11", fmt: [3 * MIN, MIN, 0] });
    expect(entry.days).toEqual({ "2026-11-15": 10 * MIN, "2026-11-16": 20 * MIN });
    expect(entry.ch).toHaveLength(15);
    expect(entry.ch[0]).toEqual(["c19", "Channel 19", 20 * MIN]);
  });
});

describe("merging", () => {
  it("keeps each device's newest publication and never adds one twice", () => {
    const a: SharedStats = { phone: device({ n: "old", u: 2000 }), laptop: device({ n: "Laptop", u: 5000 }) };
    const b: SharedStats = { phone: device({ n: "new", u: 3000 }), laptop: device({ n: "stale", u: 4000 }) };
    const merged = mergeStats(a, b);
    expect(merged.phone!.n).toBe("new");
    expect(merged.laptop!.n).toBe("Laptop");
    expect(mergeStats(merged, merged)).toEqual(merged);
  });

  it("drops a device not heard from for weeks", () => {
    const day = 24 * 60 * 60 * 1000;
    const merged = mergeStats({ gone: device({ u: 1000 }) }, { here: device({ u: 60 * day }) });
    expect(Object.keys(merged)).toEqual(["here"]);
  });

  it("survives the trip through text and ignores damaged text", () => {
    const shared: SharedStats = {
      me: device({ n: "Windows PC", u: 7, days: { "2026-11-16": 5 * MIN }, ch: [["c1", "One", MIN]], fmt: [1, 2, 3] }),
    };
    expect(parseStats(encodeStats(shared))).toEqual(shared);
    expect(parseStats("not json")).toEqual({});
    expect(parseStats('{"x":{"no":1}}')).toEqual({});
    expect(parseStats(null)).toEqual({});
  });
});

describe("combining the devices", () => {
  const shared: SharedStats = {
    me: device({
      n: "Windows PC",
      days: { "2026-11-15": 10 * MIN, "2026-11-16": 20 * MIN },
      ch: [["a", "Alpha", 12 * MIN], ["b", "Beta", 6 * MIN]],
      fmt: [18 * MIN, 0, 0],
    }),
    phone: device({
      n: "SM-A515F",
      days: { "2026-11-16": 35 * MIN },
      ch: [["a", "Alpha", 5 * MIN], ["c", "Gamma", 30 * MIN]],
      fmt: [20 * MIN, 15 * MIN, 0],
    }),
    elsewhere: device({ m: "2026-10", ch: [["z", "Zeta", 99 * MIN]], fmt: [99, 99, 99] }),
  };

  it("adds the devices day by day and lists each device's part of the week", () => {
    const { days, devices } = combineWeek(shared, ["2026-11-15", "2026-11-16"], "me");
    expect(days).toEqual([["2026-11-15", 10 * MIN], ["2026-11-16", 55 * MIN]]);
    expect(devices.map((d) => [d.name, d.ms, d.own])).toEqual([
      ["SM-A515F", 35 * MIN, false],
      ["Windows PC", 30 * MIN, true],
    ]);
  });

  it("adds a channel's time across devices and ranks them", () => {
    const channels = combineChannels(shared, "2026-11", 5);
    expect(channels.map((c) => [c.name, c.ms])).toEqual([
      ["Gamma", 30 * MIN],
      ["Alpha", 17 * MIN],
      ["Beta", 6 * MIN],
    ]);
    expect(combineChannels(shared, "2026-11", 2)).toHaveLength(2);
  });

  it("works out the Shorts share over all devices, for the month only", () => {
    expect(combinedShortsShare(shared, "2026-11")).toBeCloseTo(15 / 53);
    expect(combinedShortsShare({}, "2026-11")).toBeNull();
  });
});
