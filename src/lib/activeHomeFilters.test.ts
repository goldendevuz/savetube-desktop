import { describe, expect, it } from "vitest";
import { activeHomeFilters } from "./activeHomeFilters";
import { SETTINGS } from "./settings/schema";

describe("activeHomeFilters", () => {
  it("lists nothing when no filter is on", () => {
    expect(activeHomeFilters({})).toEqual([]);
    expect(
      activeHomeFilters({
        [SETTINGS.HOME_MIN_VIEWS]: "0",
        [SETTINGS.HOME_DURATION_GROUP]: "any",
        [SETTINGS.HOME_FEED_SCOPE]: "off",
        [SETTINGS.HOME_HIDE_MUSIC_VIDEOS]: "false",
      }),
    ).toEqual([]);
  });

  it("names each filter that is on", () => {
    const filters = activeHomeFilters({
      [SETTINGS.HOME_MIN_VIEWS]: "1000",
      [SETTINGS.HOME_MIN_SUBSCRIBERS]: "1000000",
      [SETTINGS.HOME_DURATION_GROUP]: "g4",
      [SETTINGS.HOME_HIDE_MUSIC_VIDEOS]: "true",
      [SETTINGS.HOME_FEED_SCOPE]: "unsubscribed",
    });
    expect(filters).toHaveLength(5);
    expect(filters.join(" | ")).toContain("1,000 views");
    expect(filters.join(" | ")).toContain("1,000,000 subscribers");
    expect(filters.join(" | ")).toContain("10–20 minutes");
  });

  it("names every chosen length range", () => {
    const filters = activeHomeFilters({ [SETTINGS.HOME_DURATION_GROUP]: "g3,g4" });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain("5–10 minutes");
    expect(filters[0]).toContain("10–20 minutes");
  });

  it("reads the removed 'g1' length choice as any length", () => {
    expect(activeHomeFilters({ [SETTINGS.HOME_DURATION_GROUP]: "g1" })).toEqual([]);
  });
});
