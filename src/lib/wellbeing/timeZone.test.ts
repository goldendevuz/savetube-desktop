import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_ZONE,
  epochDayIn,
  isValidZone,
  nextWallClockAt,
  offsetMs,
  selectableZones,
  zoneLabel,
  zoneOrDefault,
} from "./timeZone";

const HOUR = 3_600_000;

describe("the time zone", () => {
  it("is Tashkent unless another is chosen, and a bad name falls back to it", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Tashkent");
    expect(zoneOrDefault(undefined)).toBe("Asia/Tashkent");
    expect(zoneOrDefault("")).toBe("Asia/Tashkent");
    expect(zoneOrDefault("Mars/Olympus")).toBe("Asia/Tashkent");
    expect(zoneOrDefault("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("lists every zone except UTC and its aliases", () => {
    const zones = selectableZones();
    expect(zones).toContain("Asia/Tashkent");
    expect(zones).toContain("Europe/Berlin");
    expect(zones.length).toBeGreaterThan(100);
    for (const utc of ["UTC", "Etc/UTC", "GMT", "Etc/GMT", "Zulu"]) expect(zones).not.toContain(utc);
    expect(isValidZone("UTC")).toBe(false);
    expect(zoneOrDefault("UTC")).toBe("Asia/Tashkent");
  });

  it("knows how far a zone is from UTC", () => {
    const noon = Date.UTC(2026, 10, 16, 12, 0, 0);
    expect(offsetMs("Asia/Tashkent", noon)).toBe(5 * HOUR);
    expect(offsetMs("Asia/Kolkata", noon)).toBe(5.5 * HOUR);
    expect(offsetMs("Europe/Berlin", noon)).toBe(1 * HOUR);
    expect(offsetMs("Europe/Berlin", Date.UTC(2026, 6, 16, 12))).toBe(2 * HOUR);
    expect(zoneLabel("Asia/Tashkent", noon)).toBe("Asia/Tashkent (UTC+05:00)");
    expect(zoneLabel("Asia/Kolkata", noon)).toBe("Asia/Kolkata (UTC+05:30)");
  });

  it("changes the day at that zone's midnight, not at UTC's", () => {
    const beforeMidnightInTashkent = Date.UTC(2026, 10, 16, 18, 59, 59);
    const afterMidnightInTashkent = Date.UTC(2026, 10, 16, 19, 0, 0);
    const utcDay = Math.floor(beforeMidnightInTashkent / 86_400_000);
    expect(epochDayIn("Asia/Tashkent", beforeMidnightInTashkent)).toBe(utcDay);
    expect(epochDayIn("Asia/Tashkent", afterMidnightInTashkent)).toBe(utcDay + 1);
    expect(epochDayIn("America/New_York", afterMidnightInTashkent)).toBe(utcDay);
  });

  it("finds the next time a zone's clock reads a given time", () => {
    const now = Date.UTC(2026, 10, 16, 12, 0, 0); // 17:00 in Tashkent
    expect(nextWallClockAt("Asia/Tashkent", 23 * 60, now)).toBe(Date.UTC(2026, 10, 16, 18, 0, 0));
    // Already past 10:00 in Tashkent today: the next one is tomorrow's.
    expect(nextWallClockAt("Asia/Tashkent", 10 * 60, now)).toBe(Date.UTC(2026, 10, 17, 5, 0, 0));
    expect(nextWallClockAt("Europe/Berlin", 23 * 60, now)).toBe(Date.UTC(2026, 10, 16, 22, 0, 0));
  });
});
