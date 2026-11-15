import { describe, expect, it } from "vitest";
import { looksLikeMusicVideo } from "./hideMusicRule";

const video = (title: string, channelName = "Channel") => ({ title, channelName });

describe("looksLikeMusicVideo", () => {
  it("catches songs, lyrics and nasheeds in several languages", () => {
    expect(looksLikeMusicVideo(video("Ummi Summa Ummi Nasheed(Lyrics) / Dar Al-Maqama"))).toBe(true);
    expect(looksLikeMusicVideo(video("Darbuna Darbun ( Slowed + Reverb )"))).toBe(true);
    expect(looksLikeMusicVideo(video("Wedding Nasheed - Muhammad Al Muqit"))).toBe(true);
    expect(looksLikeMusicVideo(video("Любовь | текст песни"))).toBe(true);
    expect(looksLikeMusicVideo(video("Yangi qo\u02bbshiq 2026"))).toBe(true);
    expect(looksLikeMusicVideo(video("Yeni şarkı sözleri"))).toBe(true);
    expect(looksLikeMusicVideo(video("Anything", "Artist - Topic"))).toBe(true);
    expect(looksLikeMusicVideo(video("Anything", "Sony Music"))).toBe(true);
  });

  it("leaves other videos alone", () => {
    expect(looksLikeMusicVideo(video("5 Cybersecurity Certificates You Need", "UnixGuy"))).toBe(false);
    expect(looksLikeMusicVideo(video("My first post about Rust", "Dev"))).toBe(false);
    expect(looksLikeMusicVideo(video("Songbird migration in spring", "Nature"))).toBe(false);
  });
});
