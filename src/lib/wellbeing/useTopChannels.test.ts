import { describe, expect, it } from "vitest";

import { currentMonth, percentLabel, shortsShare } from "./useTopChannels";

describe("currentMonth", () => {
  it("is the year and the two-digit month", () => {
    expect(currentMonth(new Date(2026, 10, 16))).toBe("2026-11");
    expect(currentMonth(new Date(2026, 0, 3))).toBe("2026-01");
  });
});

describe("shortsShare", () => {
  it("is the Shorts time over all video time", () => {
    expect(shortsShare({ LONG: 60_000, SHORT: 20_000, LIVE: 20_000 })).toBeCloseTo(0.2);
    expect(shortsShare({ SHORT: 5_000 })).toBe(1);
    expect(shortsShare({ LONG: 5_000 })).toBe(0);
  });

  it("is null when nothing was watched", () => {
    expect(shortsShare({})).toBeNull();
    expect(shortsShare({ LONG: 0, SHORT: 0 })).toBeNull();
  });
});

describe("percentLabel", () => {
  it("rounds to a whole percentage", () => {
    expect(percentLabel(0.2)).toBe("20%");
    expect(percentLabel(0.3449)).toBe("34%");
    expect(percentLabel(1)).toBe("100%");
  });
});
