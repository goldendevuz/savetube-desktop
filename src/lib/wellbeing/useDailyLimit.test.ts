import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notifications = vi.hoisted(() => [] as string[]);
const settings = vi.hoisted(() => ({ values: {} as Record<string, string> }));
const db = vi.hoisted(() => ({ rows: {} as Record<string, string> }));
const player = vi.hoisted(() => ({ video: false, music: false, videoPauses: 0, musicPauses: 0 }));

vi.mock("../api/downloads", () => ({
  showDownloadNotification: async (title: string) => {
    notifications.push(title);
  },
}));
vi.mock("../api/db", () => ({
  getSetting: async (key: string) => db.rows[key] ?? null,
}));
vi.mock("../../store/useAppSettingsStore", () => {
  const useAppSettingsStore = Object.assign((select: (state: typeof settings) => unknown) => select(settings), {
    getState: () => settings,
  });
  return {
    useAppSettingsStore,
    setSettingValue: async (key: string, value: string) => {
      db.rows[key] = value;
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

const { useDailyLimit, keepWatching } = await import("./useDailyLimit");
const { useDailyLimitStore } = await import("../../store/useDailyLimitStore");
const { SETTINGS } = await import("../settings/schema");
const { EXTENSION_MS, encodeShared, parseShared, remainingMs } = await import("./dailyLimit");
const { epochDayIn } = await import("./timeZone");

const MINUTE = 60_000;
let host: HTMLDivElement;
let root: Root;

function Limit() {
  useDailyLimit();
  return null;
}

async function mount() {
  await act(async () => {
    root.render(createElement(Limit));
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function tally() {
  const t = useDailyLimitStore.getState().tally;
  if (!t) throw new Error("no count yet");
  return t;
}

function saved() {
  return parseShared(db.rows[SETTINGS.DAILY_TALLY]);
}

const today = () => epochDayIn("Asia/Tashkent", Date.now());

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 10, 16, 7, 0))); // 12:00 in Tashkent
  notifications.length = 0;
  db.rows = { [SETTINGS.DAILY_LIMIT_DEVICE]: "me" };
  settings.values = {
    [SETTINGS.DAILY_LIMIT]: "true",
    [SETTINGS.DAILY_LIMIT_MINUTES]: "30",
    [SETTINGS.DAILY_LIMIT_MUSIC]: "false",
  };
  player.video = false;
  player.music = false;
  player.videoPauses = 0;
  player.musicPauses = 0;
  useDailyLimitStore.setState({ shared: {}, ownId: "", tally: null, dialogOpen: false, keepWatchingAt: 0 });
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the daily limit", () => {
  it("does nothing while it is off", async () => {
    settings.values[SETTINGS.DAILY_LIMIT] = "false";
    player.video = true;
    await mount();
    await advance(10 * MINUTE);
    expect(useDailyLimitStore.getState().tally).toBeNull();
    expect(db.rows[SETTINGS.DAILY_TALLY]).toBeUndefined();
  });

  it("counts only the time something plays, as this device's own share", async () => {
    await mount();
    await advance(5 * MINUTE);
    expect(useDailyLimitStore.getState().tally?.playedMs ?? 0).toBe(0);
    player.video = true;
    await advance(10 * MINUTE);
    expect(tally().playedMs).toBeGreaterThanOrEqual(10 * MINUTE - 2000);
    expect(tally().playedMs).toBeLessThanOrEqual(10 * MINUTE + 2000);
    expect(saved().me?.p).toBeGreaterThan(9 * MINUTE);
    expect(saved().me?.n).toMatch(/PC|Mac/);
  });

  it("counts music only when asked to", async () => {
    player.music = true;
    await mount();
    await advance(5 * MINUTE);
    expect(useDailyLimitStore.getState().tally?.playedMs ?? 0).toBe(0);
    settings.values[SETTINGS.DAILY_LIMIT_MUSIC] = "true";
    await advance(5 * MINUTE);
    expect(tally().playedMs).toBeGreaterThan(4 * MINUTE);
  });

  it("warns once, five minutes before the end", async () => {
    player.video = true;
    await mount();
    await advance(24 * MINUTE);
    expect(notifications).toEqual([]);
    await advance(2 * MINUTE);
    expect(notifications).toHaveLength(1);
    expect(tally().warned).toBe(true);
    await advance(2 * MINUTE);
    expect(notifications).toHaveLength(1);
  });

  it("pauses everything and shows the dialog when the time is up", async () => {
    player.video = true;
    await mount();
    await advance(31 * MINUTE);
    expect(player.video).toBe(false);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
    expect(tally().reached).toBe(true);
    expect(saved().me?.r).toBe(true);
  });

  it("pauses music too when music counts", async () => {
    settings.values[SETTINGS.DAILY_LIMIT_MUSIC] = "true";
    player.music = true;
    await mount();
    await advance(31 * MINUTE);
    expect(player.music).toBe(false);
    expect(player.musicPauses).toBe(1);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
  });

  it("adds the time another device counted today to the limit", async () => {
    db.rows[SETTINGS.DAILY_TALLY] = encodeShared({
      phone: { n: "SM-A515F", d: today(), p: 20 * MINUTE, x: 0, r: false, w: false },
    });
    player.video = true;
    await mount();
    await advance(5 * MINUTE);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(false);
    expect(tally().playedMs).toBeGreaterThan(24 * MINUTE);
    await advance(6 * MINUTE);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
    // This device only booked its own time; the phone's entry is untouched.
    expect(saved().me!.p).toBeLessThan(12 * MINUTE);
    expect(saved().phone!.p).toBe(20 * MINUTE);
  });

  it("picks up a count that another device sends while this one is open", async () => {
    await mount();
    await advance(MINUTE);
    db.rows[SETTINGS.DAILY_TALLY] = encodeShared({
      phone: { n: "SM-A515F", d: today(), p: 7 * MINUTE, x: 0, r: false, w: false },
    });
    await advance(20_000);
    expect(tally().playedMs).toBe(7 * MINUTE);
  });

  it("never loses another device's entry when it saves its own", async () => {
    player.video = true;
    await mount();
    await advance(5_000);
    db.rows[SETTINGS.DAILY_TALLY] = encodeShared({
      ...saved(),
      phone: { n: "SM-A515F", d: today(), p: 3 * MINUTE, x: 0, r: false, w: false },
    });
    await advance(30_000);
    expect(saved().phone?.p).toBe(3 * MINUTE);
    expect(saved().me?.p).toBeGreaterThan(30_000);
  });

  it("gives fifteen more minutes with Keep watching, to the limit of all devices", async () => {
    player.video = true;
    await mount();
    await advance(31 * MINUTE);
    act(() => useDailyLimitStore.getState().closeDialog());
    await act(async () => {
      await keepWatching(30);
    });
    expect(remainingMs(30, tally())).toBe(EXTENSION_MS);
    expect(saved().me?.x).toBeGreaterThanOrEqual(EXTENSION_MS);
    player.video = true;
    await advance(10 * MINUTE);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(false);
    await advance(6 * MINUTE);
    expect(useDailyLimitStore.getState().dialogOpen).toBe(true);
  });

  it("starts a new day from nothing", async () => {
    player.video = true;
    await mount();
    await advance(10 * MINUTE);
    expect(tally().playedMs).toBeGreaterThan(0);
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 17, 4, 0))); // 09:00 in Tashkent the next day
    await advance(2000);
    expect(tally().day).toBe(today());
    expect(tally().playedMs).toBeLessThan(5000);
    expect(tally().reached).toBe(false);
  });

  it("does not count the time a sleeping computer was away", async () => {
    player.video = true;
    await mount();
    await advance(MINUTE);
    const before = tally().playedMs;
    vi.setSystemTime(Date.now() + 3 * 60 * MINUTE);
    await advance(1000);
    expect(tally().playedMs - before).toBeLessThan(5000);
  });
});
