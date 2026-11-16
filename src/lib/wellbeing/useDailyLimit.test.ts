import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notifications = vi.hoisted(() => [] as string[]);
const settings = vi.hoisted(() => ({ values: {} as Record<string, string> }));
const saved = vi.hoisted(() => [] as Array<[string, string]>);
const player = vi.hoisted(() => ({ video: false, music: false, videoPauses: 0, musicPauses: 0 }));

vi.mock("../api/downloads", () => ({
  showDownloadNotification: async (title: string) => {
    notifications.push(title);
  },
}));
vi.mock("../../store/useAppSettingsStore", () => {
  const useAppSettingsStore = Object.assign((select: (state: typeof settings) => unknown) => select(settings), {
    getState: () => settings,
  });
  return {
    useAppSettingsStore,
    setSettingValue: async (key: string, value: string) => {
      saved.push([key, value]);
      settings.values[key] = value;
      return true;
    },
  };
});
vi.mock("../../store/usePlayerStore", () => ({
  usePlayerStore: {
    getState: () => ({
      isPlaying: player.video,
      setIsPlaying: (value: boolean) => {
        player.video = value;
        if (!value) player.videoPauses += 1;
      },
    }),
  },
}));
vi.mock("../../store/useMusicPlayerStore", () => ({
  useMusicPlayerStore: {
    getState: () => ({
      isPlaying: player.music,
      pause: () => {
        player.music = false;
        player.musicPauses += 1;
      },
    }),
  },
}));

const { useDailyLimit } = await import("./useDailyLimit");
const { useDailyLimitStore } = await import("../../store/useDailyLimitStore");
const { SETTINGS } = await import("../settings/schema");
const { EXTENSION_MS, extend, localEpochDay, remainingMs } = await import("./dailyLimit");

const MINUTE = 60_000;
let host: HTMLDivElement;
let root: Root;

function Limit() {
  useDailyLimit();
  return null;
}

function mount() {
  act(() => root.render(createElement(Limit)));
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function currentTally() {
  const tally = useDailyLimitStore.getState().tally;
  if (!tally) throw new Error("no tally yet");
  return tally;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 16, 12, 0));
  notifications.length = 0;
  saved.length = 0;
  settings.values = {
    [SETTINGS.DAILY_LIMIT]: "true",
    [SETTINGS.DAILY_LIMIT_MINUTES]: "30",
    [SETTINGS.DAILY_LIMIT_MUSIC]: "false",
  };
  player.video = false;
  player.music = false;
  player.videoPauses = 0;
  player.musicPauses = 0;
  useDailyLimitStore.setState({ tally: null, dialogOpen: false, keepWatchingAt: 0 });
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the daily limit", () => {
  it("does nothing while it is off", () => {
    settings.values[SETTINGS.DAILY_LIMIT] = "false";
    player.video = true;
    mount();
    advance(10 * MINUTE);
    expect(useDailyLimitStore.getState().tally).toBeNull();
    expect(saved).toEqual([]);
  });

  it("counts only the time something plays", () => {
    mount();
    advance(5 * MINUTE);
    expect(currentTally().playedMs).toBe(0);
    player.video = true;
    advance(10 * MINUTE);
    const played = currentTally().playedMs;
    expect(played).toBeGreaterThanOrEqual(10 * MINUTE - 2000);
    expect(played).toBeLessThanOrEqual(10 * MINUTE + 2000);
  });

  it("counts music only when asked to", () => {
    player.music = true;
    mount();
    advance(5 * MINUTE);
    expect(currentTally().playedMs).toBe(0);
    settings.values[SETTINGS.DAILY_LIMIT_MUSIC] = "true";
    advance(5 * MINUTE);
    expect(currentTally().playedMs).toBeGreaterThan(4 * MINUTE);
  });

  it("warns once, five minutes before the end", () => {
    player.video = true;
    mount();
    advance(24 * MINUTE);
    expect(notifications).toEqual([]);
    advance(2 * MINUTE);
    expect(notifications).toHaveLength(1);
    expect(currentTally().warned).toBe(true);
    advance(2 * MINUTE);
    expect(notifications).toHaveLength(1);
  });

  it("pauses everything and shows the dialog when the time is up", () => {
    player.video = true;
    mount();
    advance(31 * MINUTE);
    expect(player.video).toBe(false);
    expect(player.videoPauses).toBeGreaterThan(0);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
    expect(currentTally().reached).toBe(true);
    const tallySaves = saved.filter(([key]) => key === SETTINGS.DAILY_TALLY);
    const lastSave = tallySaves[tallySaves.length - 1];
    expect(JSON.parse(lastSave?.[1] ?? "{}").reached).toBe(true);
  });

  it("pauses music too when music counts", () => {
    settings.values[SETTINGS.DAILY_LIMIT_MUSIC] = "true";
    player.music = true;
    mount();
    advance(31 * MINUTE);
    expect(player.music).toBe(false);
    expect(player.musicPauses).toBe(1);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
  });

  it("gives fifteen more minutes with Keep watching, and stops again after them", () => {
    player.video = true;
    mount();
    advance(31 * MINUTE);
    act(() => {
      useDailyLimitStore.getState().closeDialog();
      useDailyLimitStore.getState().setTally(extend(30, currentTally()));
    });
    expect(remainingMs(30, currentTally())).toBe(EXTENSION_MS);
    player.video = true;
    advance(10 * MINUTE);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(false);
    advance(6 * MINUTE);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
    expect(player.video).toBe(false);
  });

  it("starts a new day from nothing", () => {
    player.video = true;
    mount();
    advance(10 * MINUTE);
    expect(currentTally().playedMs).toBeGreaterThan(0);
    vi.setSystemTime(new Date(2026, 10, 17, 9, 0));
    advance(2000);
    expect(currentTally().day).toBe(localEpochDay(Date.now()));
    expect(currentTally().playedMs).toBeLessThan(5000);
    expect(currentTally().reached).toBe(false);
  });

  it("does not count the time a sleeping computer was away", () => {
    player.video = true;
    mount();
    advance(MINUTE);
    const before = currentTally().playedMs;
    vi.setSystemTime(Date.now() + 3 * 60 * MINUTE);
    advance(1000);
    expect(currentTally().playedMs - before).toBeLessThan(5000);
  });

  it("reads the count saved earlier today", () => {
    const today = localEpochDay(Date.now());
    settings.values[SETTINGS.DAILY_TALLY] = JSON.stringify({
      day: today,
      playedMs: 20 * MINUTE,
      extraMs: 0,
      warned: false,
      reached: false,
    });
    player.video = true;
    mount();
    advance(1000);
    expect(currentTally().playedMs).toBeGreaterThanOrEqual(20 * MINUTE);
  });
});
