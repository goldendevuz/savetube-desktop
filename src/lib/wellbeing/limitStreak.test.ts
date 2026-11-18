import { describe, expect, it } from "vitest";

import { currentStreak, encodeStreak, mergeStreak, newMilestone, nextMilestone, parseStreak, recordDay } from "./limitStreak";

describe("limit streak", () => {
  it("starts at one day and grows with every day without a break", () => {
    const first = recordDay(null, 100, false);
    expect(currentStreak(first, 100)).toBe(1);
    expect(currentStreak(first, 104)).toBe(5);
  });

  it("counts a day the app was not opened as a good day", () => {
    const s = recordDay(null, 10, false);
    expect(currentStreak(s, 20)).toBe(11);
  });

  it("resets to zero on the day the limit breaks and starts again the day after", () => {
    let s = recordDay(null, 10, false);
    s = recordDay(s, 14, true);
    expect(currentStreak(s, 14)).toBe(0);
    expect(currentStreak(s, 15)).toBe(1);
    expect(s.best).toBe(4);
  });

  it("keeps the best streak after a break", () => {
    let s = recordDay(null, 1, false);
    s = recordDay(s, 8, false);
    s = recordDay(s, 8, true);
    expect(s.best).toBe(8);
    expect(currentStreak(s, 9)).toBe(1);
  });

  it("returns the same record when nothing changed", () => {
    const s = recordDay(null, 5, false);
    expect(recordDay(s, 5, false)).toBe(s);
  });

  it("merges two devices without forgetting a broken day", () => {
    const a = { s: 5, b: [20], best: 4, a: 3 };
    const b = { s: 3, b: [25, 20], best: 9, a: 7 };
    expect(mergeStreak(a, b)).toEqual({ s: 3, b: [25, 20], best: 9, a: 7 });
    expect(mergeStreak(null, a)).toBe(a);
  });

  it("announces a milestone once", () => {
    let s = recordDay(null, 1, false);
    expect(newMilestone(s, 2)).toBeNull();
    expect(newMilestone(s, 3)).toBe(3);
    s = { ...s, a: 3 };
    expect(newMilestone(s, 3)).toBeNull();
    expect(newMilestone(s, 7)).toBe(7);
  });

  it("knows the next milestone", () => {
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(7)).toBe(14);
    expect(nextMilestone(400)).toBeNull();
  });

  it("round-trips and rejects junk", () => {
    const s = recordDay(null, 9, true);
    expect(parseStreak(encodeStreak(s))).toEqual(s);
    expect(parseStreak("nope")).toBeNull();
    expect(parseStreak("")).toBeNull();
  });
});
