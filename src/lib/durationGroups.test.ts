import { describe, expect, it } from "vitest";
import { parseDurationGroups, serializeDurationGroups, toggleDurationGroup } from "./durationGroups";

describe("duration groups", () => {
  it("reads one or several groups and skips anything else", () => {
    expect(parseDurationGroups("g3")).toEqual(["g3"]);
    expect(parseDurationGroups("g5, G2,g9")).toEqual(["g2", "g5"]);
    expect(parseDurationGroups("any")).toEqual([]);
    expect(parseDurationGroups("g1")).toEqual([]);
    expect(parseDurationGroups(undefined)).toEqual([]);
  });

  it("saves the groups in length order, or any when none", () => {
    expect(serializeDurationGroups(["g5", "g2"])).toBe("g2,g5");
    expect(serializeDurationGroups([])).toBe("any");
  });

  it("toggles a group on and off", () => {
    expect(toggleDurationGroup("any", "g4")).toBe("g4");
    expect(toggleDurationGroup("g4", "g2")).toBe("g2,g4");
    expect(toggleDurationGroup("g2,g4", "g4")).toBe("g2");
    expect(toggleDurationGroup("g2", "g2")).toBe("any");
    expect(toggleDurationGroup("g1", "g3")).toBe("g3");
  });
});
