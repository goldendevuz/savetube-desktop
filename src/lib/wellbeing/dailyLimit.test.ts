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
