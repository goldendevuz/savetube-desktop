import { describe, expect, it } from "vitest";
import { looksLikeEntertainment, looksLikeGaming } from "./hideContentRules";

const video = (title: string) => ({ title });

describe("hide content rules", () => {
  it("catches movie clips, shows and anime", () => {
    expect(looksLikeEntertainment(video("Hulk Vs Surtur Demon (4K Blu-ray) Fight Scenes | Marvel Movie Clips"))).toBe(true);
    expect(looksLikeEntertainment(video("Best anime of 2026"))).toBe(true);
    expect(looksLikeEntertainment(video("Лучшие моменты из фильма"))).toBe(true);
    expect(looksLikeEntertainment(video("Rust ownership explained"))).toBe(false);
  });

  it("catches game videos", () => {
    expect(looksLikeGaming(video("Minecraft survival gameplay #12"))).toBe(true);
    expect(looksLikeGaming(video("Прохождение Call of Duty"))).toBe(true);
    expect(looksLikeGaming(video("Yangi o\u02bbyin sharhi"))).toBe(true);
    expect(looksLikeGaming(video("Game theory in economics"))).toBe(false);
  });
});
