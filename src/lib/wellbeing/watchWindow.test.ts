import { describe, expect, it } from "vitest";

import { isOpen, minutesUntilOpen, parseClock } from "./watchWindow";

const at = (h: number, m = 0) => h * 60 + m;

describe("watch window", () => {
  it("reads clock times", () => {
    expect(parseClock("07:30")).toBe(450);
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("nope")).toBeNull();
    expect(parseClock(undefined)).toBeNull();
  });

  it("is open between the two times and closed outside them", () => {
    expect(isOpen("07:00", "22:00", at(7))).toBe(true);
    expect(isOpen("07:00", "22:00", at(21, 59))).toBe(true);
    expect(isOpen("07:00", "22:00", at(22))).toBe(false);
    expect(isOpen("07:00", "22:00", at(3))).toBe(false);
  });

  it("wraps past midnight", () => {
    expect(isOpen("22:00", "06:00", at(23))).toBe(true);
    expect(isOpen("22:00", "06:00", at(5, 59))).toBe(true);
    expect(isOpen("22:00", "06:00", at(12))).toBe(false);
  });

  it("never closes when the times are equal or unreadable", () => {
    expect(isOpen("08:00", "08:00", at(3))).toBe(true);
    expect(isOpen("x", "22:00", at(3))).toBe(true);
  });

  it("counts the minutes until it opens", () => {
    expect(minutesUntilOpen("07:00", "22:00", at(6, 30))).toBe(30);
    expect(minutesUntilOpen("07:00", "22:00", at(23))).toBe(8 * 60);
    expect(minutesUntilOpen("07:00", "22:00", at(12))).toBe(0);
    expect(minutesUntilOpen("22:00", "06:00", at(12))).toBe(10 * 60);
  });
});
