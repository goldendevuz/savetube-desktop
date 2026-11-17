import { describe, expect, it } from "vitest";

import {
  DAILY_LIMIT_DEFAULT_MINUTES,
  EXTENSION_MS,
  MINUTE_CHOICES,
  WARNING_MS,
  addPlayed,
  allowanceMs,
  changeNeedsWait,
  emptyTally,
  extend,
  isUsedUp,
  localEpochDay,
  remainingMs,
  rollover,
  shouldWarn,
  validMinutes,
  type DailyLimitSettings,
} from "./dailyLimit";

const MIN = 60_000;
const on: DailyLimitSettings = { enabled: true, minutes: 120, countMusic: false };

describe("the minute choices", () => {
  it("run from 15 minutes to 8 hours in steps of 15", () => {
    expect(MINUTE_CHOICES[0]).toBe(15);
    expect(MINUTE_CHOICES[1]).toBe(30);
    expect(MINUTE_CHOICES[MINUTE_CHOICES.length - 1]).toBe(480);
    expect(MINUTE_CHOICES).toHaveLength(32);
  });

  it("fall back to two hours for anything else", () => {
    expect(validMinutes(45)).toBe(45);
    expect(validMinutes(50)).toBe(DAILY_LIMIT_DEFAULT_MINUTES);
    expect(validMinutes(null)).toBe(DAILY_LIMIT_DEFAULT_MINUTES);
    expect(validMinutes(undefined)).toBe(120);
  });
});

describe("the day", () => {
  it("changes at local midnight", () => {
    const noon = new Date(2026, 10, 15, 12, 0, 0).getTime();
    const nextNoon = new Date(2026, 10, 16, 12, 0, 0).getTime();
    expect(localEpochDay(nextNoon) - localEpochDay(noon)).toBe(1);
    const lateNight = new Date(2026, 10, 15, 23, 59, 0).getTime();
    expect(localEpochDay(lateNight)).toBe(localEpochDay(noon));
  });

  it("starts from nothing on a later day and carries on when the clock goes back", () => {
    const tally = { ...emptyTally(100), playedMs: 5 * MIN, reached: true };
    expect(rollover(null, 100)).toEqual(emptyTally(100));
    expect(rollover(tally, 100)).toBe(tally);
    expect(rollover(tally, 101)).toEqual(emptyTally(101));
    expect(rollover(tally, 99)).toBe(tally);
  });
});

describe("counting", () => {
  it("adds playing time and ignores a negative amount", () => {
    const tally = addPlayed(addPlayed(emptyTally(1), 30 * MIN), -5 * MIN);
    expect(tally.playedMs).toBe(30 * MIN);
  });

  it("works out the time left", () => {
    const tally = addPlayed(emptyTally(1), 100 * MIN);
    expect(allowanceMs(120, tally)).toBe(120 * MIN);
    expect(remainingMs(120, tally)).toBe(20 * MIN);
    expect(remainingMs(120, addPlayed(tally, 50 * MIN))).toBe(0);
    expect(isUsedUp(120, addPlayed(tally, 50 * MIN))).toBe(true);
    expect(isUsedUp(120, tally)).toBe(false);
  });
});

describe("the warning", () => {
  it("is due once, in the last five minutes, and not after the limit ran out", () => {
    const before = addPlayed(emptyTally(1), 110 * MIN);
    expect(shouldWarn(120, before)).toBe(false);
    const inside = addPlayed(emptyTally(1), 115 * MIN);
    expect(remainingMs(120, inside)).toBe(WARNING_MS);
    expect(shouldWarn(120, inside)).toBe(true);
    expect(shouldWarn(120, { ...inside, warned: true })).toBe(false);
    expect(shouldWarn(120, addPlayed(emptyTally(1), 120 * MIN))).toBe(false);
  });
});

describe("keep watching", () => {
  it("adds exactly fifteen minutes from now", () => {
    const tally = addPlayed(emptyTally(1), 120 * MIN);
    const next = extend(120, tally);
    expect(remainingMs(120, next)).toBe(EXTENSION_MS);
  });

  it("also counts playing that ran past the limit", () => {
    const tally = addPlayed(emptyTally(1), 130 * MIN);
    expect(remainingMs(120, extend(120, tally))).toBe(EXTENSION_MS);
  });

  it("leaves reached and warned as they are", () => {
    const tally = { ...addPlayed(emptyTally(1), 120 * MIN), reached: true, warned: true };
    const next = extend(120, tally);
    expect(next.reached).toBe(true);
    expect(next.warned).toBe(true);
  });
});

describe("changing the limit after it ran out", () => {
  const ranOut = { ...emptyTally(10), reached: true };

  it("waits to turn it off, lower it or stop counting music", () => {
    expect(changeNeedsWait(on, { ...on, enabled: false }, ranOut, 10)).toBe(true);
    expect(changeNeedsWait(on, { ...on, minutes: 90 }, ranOut, 10)).toBe(true);
    expect(changeNeedsWait({ ...on, countMusic: true }, on, ranOut, 10)).toBe(true);
  });

  it("does not wait to raise it or to start counting music", () => {
    expect(changeNeedsWait(on, { ...on, minutes: 180 }, ranOut, 10)).toBe(false);
    expect(changeNeedsWait(on, { ...on, countMusic: true }, ranOut, 10)).toBe(false);
  });

  it("does not wait when it has not run out today, or is off, or it was another day", () => {
    expect(changeNeedsWait(on, { ...on, enabled: false }, emptyTally(10), 10)).toBe(false);
    expect(changeNeedsWait(on, { ...on, enabled: false }, null, 10)).toBe(false);
    expect(changeNeedsWait({ ...on, enabled: false }, { ...on, minutes: 30 }, ranOut, 10)).toBe(false);
    expect(changeNeedsWait(on, { ...on, enabled: false }, ranOut, 11)).toBe(false);
  });
});

import {
  aggregate,
  deviceShares,
  encodeShared,
  latestDay,
  mergeShared,
  parseShared,
  withOwn,
  type DeviceCount,
  type SharedTally,
} from "./dailyLimit";

const count = (over: Partial<DeviceCount> = {}): DeviceCount => ({ n: "", d: 10, p: 0, x: 0, r: false, w: false, ...over });

describe("the shared count of all devices", () => {
  it("is the sum of the devices of the newest day", () => {
    const shared: SharedTally = {
      phone: count({ n: "Phone", p: 30 * MIN, x: 15 * MIN }),
      laptop: count({ n: "Laptop", p: 20 * MIN, r: true }),
      old: count({ d: 9, p: 90 * MIN }),
    };
    expect(latestDay(shared)).toBe(10);
    const total = aggregate(shared, 10);
    expect(total.playedMs).toBe(50 * MIN);
    expect(total.extraMs).toBe(15 * MIN);
    expect(total.reached).toBe(true);
    expect(total.warned).toBe(false);
  });

  it("merges to each device's larger count and never adds time twice", () => {
    const a: SharedTally = { phone: count({ p: 30 * MIN }), laptop: count({ p: 5 * MIN }) };
    const b: SharedTally = { phone: count({ p: 10 * MIN }), laptop: count({ p: 25 * MIN }) };
    const merged = mergeShared(a, b);
    expect(merged.phone!.p).toBe(30 * MIN);
    expect(merged.laptop!.p).toBe(25 * MIN);
    expect(mergeShared(merged, merged)).toEqual(merged);
  });

  it("lets a later day replace an earlier one and keeps flags and names on the same day", () => {
    expect(mergeShared({ phone: count({ d: 10, p: 99 * MIN, r: true }) }, { phone: count({ d: 11, p: MIN }) }).phone).toEqual(
      count({ d: 11, p: MIN }),
    );
    const same = mergeShared({ phone: count({ n: "", w: true }) }, { phone: count({ n: "Phone", r: true, p: MIN }) }).phone!;
    expect(same.w && same.r).toBe(true);
    expect(same.n).toBe("Phone");
  });

  it("books only this device's own growth", () => {
    const shared: SharedTally = { laptop: count({ n: "Laptop", p: 20 * MIN }) };
    const next = withOwn(shared, "me", "Windows PC", { day: 10, playedMs: 25 * MIN, extraMs: 0, warned: false, reached: false });
    expect(next.laptop!.p).toBe(20 * MIN);
    expect(next.me).toMatchObject({ n: "Windows PC", p: 5 * MIN });
    expect(aggregate(next, 10).playedMs).toBe(25 * MIN);
  });

  it("lists the devices of the day, the biggest first, and marks this one", () => {
    const shared: SharedTally = {
      me: count({ n: "Windows PC", p: 10 * MIN }),
      phone: count({ n: "SM-A515F", p: 40 * MIN }),
      old: count({ d: 9, p: 99 * MIN }),
    };
    expect(deviceShares(shared, 10, "me").map((d) => [d.name, d.ms, d.own])).toEqual([
      ["SM-A515F", 40 * MIN, false],
      ["Windows PC", 10 * MIN, true],
    ]);
  });

  it("survives the trip through text, and ignores damaged or old-format text", () => {
    const shared: SharedTally = { me: count({ n: "Windows PC", p: 3 * MIN, x: 15 * MIN, r: true, w: true }) };
    expect(parseShared(encodeShared(shared))).toEqual(shared);
    expect(parseShared("not json")).toEqual({});
    expect(parseShared('{"day":1,"playedMs":2}')).toEqual({});
    expect(parseShared(null)).toEqual({});
  });

  it("drops entries more than a week older than the newest", () => {
    const merged = mergeShared({ ancient: count({ d: 1, p: MIN }) }, { fresh: count({ d: 20 }) });
    expect(Object.keys(merged)).toEqual(["fresh"]);
  });
});
