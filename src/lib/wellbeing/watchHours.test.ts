import { describe, expect, it } from "vitest";

import { addHours, encodeHours, parseHours, summarizeHours } from "./watchHours";
import { encodeGoal, goalFor, mergeGoal, parseGoal, writeGoal } from "./dailyGoal";

describe("watch hours", () => {
  it("adds time to the hour of the day", () => {
    let ledger = addHours({}, 100, 21, 60_000);
    ledger = addHours(ledger, 100, 21, 30_000);
    ledger = addHours(ledger, 101, 8, 10_000);
    expect(ledger["100"]![21]).toBe(90_000);
    expect(ledger["101"]![8]).toBe(10_000);
  });

  it("drops days older than 28", () => {
    const ledger = addHours(addHours({}, 10, 1, 1000), 40, 1, 1000);
    expect(Object.keys(ledger)).toEqual(["40"]);
  });

  it("finds the peak hour over all days", () => {
    let ledger = addHours({}, 1, 9, 5000);
    ledger = addHours(ledger, 2, 22, 4000);
    ledger = addHours(ledger, 3, 22, 4000);
    const summary = summarizeHours(ledger);
    expect(summary.peakHour).toBe(22);
    expect(summary.total).toBe(13000);
    expect(summarizeHours({}).peakHour).toBeNull();
  });

  it("round-trips and ignores junk", () => {
    const ledger = addHours({}, 5, 3, 1000);
    expect(parseHours(encodeHours(ledger))).toEqual(ledger);
    expect(parseHours("nope")).toEqual({});
    expect(parseHours('{"5":[1,2]}')).toEqual({});
  });
});

describe("daily goal", () => {
  it("shows only today's goal", () => {
    const goal = writeGoal(50, "Finish the course video", false, 1000);
    expect(goalFor(goal, 50)?.t).toBe("Finish the course video");
    expect(goalFor(goal, 51)).toBeNull();
    expect(goalFor(writeGoal(50, "   ", false, 1), 50)).toBeNull();
  });

  it("keeps the newer copy", () => {
    const older = writeGoal(50, "a", false, 100);
    const newer = writeGoal(50, "a", true, 200);
    expect(mergeGoal(older, newer)).toBe(newer);
    expect(mergeGoal(newer, older)).toBe(newer);
    expect(mergeGoal(null, older)).toBe(older);
  });

  it("limits the length and round-trips", () => {
    const goal = writeGoal(1, "x".repeat(200), false, 1);
    expect(goal.t.length).toBe(80);
    expect(parseGoal(encodeGoal(goal))).toEqual(goal);
    expect(parseGoal("nope")).toBeNull();
  });
});
