import { useEffect } from "react";

import { getSetting } from "../api/db";
import { setSettingValue, useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useDailyLimitStore } from "../../store/useDailyLimitStore";
import { useMusicPlayerStore } from "../../store/useMusicPlayerStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { showDownloadNotification } from "../api/downloads";
import { getString } from "../i18n/index";
import { IS_LINUX_RUNTIME, IS_MACOS_RUNTIME } from "../platform";
import { SETTINGS } from "../settings/schema";
import {
  WAIT_MS,
  addPlayed,
  encodeShared,
  extend,
  isUsedUp,
  mergeShared,
  parseShared,
  rollover,
  shouldWarn,
  validMinutes,
  withOwn,
} from "./dailyLimit";
import { epochDayIn, zoneOrDefault } from "./timeZone";

const TICK_MS = 1_000;
/** A longer gap between ticks means the computer slept: that time was not spent watching. */
const MAX_COUNTED_GAP_MS = 3_000;
/** The count is saved this often while it changes, and at once when something happens. */
const SAVE_EVERY_MS = 10_000;
/** The saved count is read back this often, to pick up what another device sent. */
const REFRESH_EVERY_MS = 15_000;

/** What this computer is called in the list of devices. */
export function deviceLabel(): string {
  if (IS_MACOS_RUNTIME) return "Mac";
  if (IS_LINUX_RUNTIME) return "Linux PC";
  return "Windows PC";
}

/** This device's id in the shared count: made once, kept in this device's own settings, never synced. */
export async function ensureOwnId(): Promise<string> {
  const known = useDailyLimitStore.getState().ownId;
  if (known) return known;
  let id = await getSetting(SETTINGS.DAILY_LIMIT_DEVICE);
  if (!id) {
    id = globalThis.crypto.randomUUID().slice(0, 8);
    await setSettingValue(SETTINGS.DAILY_LIMIT_DEVICE, id);
  }
  useDailyLimitStore.getState().setOwnId(id);
  return id;
}

/**
 * Saves the shared count with what was saved meanwhile merged in. Another device's count arrives by sync into the
 * saved text, so it is read back here every time and never lost to this device's copy.
 */
export async function persistShared(): Promise<void> {
  const store = useDailyLimitStore.getState();
  const saved = parseShared(await getSetting(SETTINGS.DAILY_TALLY));
  const merged = mergeShared(saved, store.shared);
  useDailyLimitStore.getState().setShared(merged);
  const text = encodeShared(merged);
  if (text !== encodeShared(saved)) await setSettingValue(SETTINGS.DAILY_TALLY, text);
}

/** Keep watching: exactly fifteen more minutes from now, for the limit of all devices together. */
export async function keepWatching(minutes: number): Promise<void> {
  const ownId = await ensureOwnId();
  await persistShared();
  const { shared, tally } = useDailyLimitStore.getState();
  if (!tally) return;
  useDailyLimitStore.getState().setShared(withOwn(shared, ownId, deviceLabel(), extend(minutes, tally)));
  await persistShared();
}

/** Whether a video is playing: the video player, or a Short (its video element carries `data-watch-time`). */
export function videoPlaying(): boolean {
  if (usePlayerStore.getState().isPlaying) return true;
  for (const element of document.querySelectorAll<HTMLVideoElement>("video[data-watch-time]")) {
    if (!element.paused && !element.ended && element.readyState > 2) return true;
  }
  return false;
}

export function musicPlaying(): boolean {
  return useMusicPlayerStore.getState().isPlaying;
}

/** Stops everything that plays, so nothing carries on behind the dialog. */
export function pauseAllPlayback(): void {
  usePlayerStore.getState().setIsPlaying(false);
  if (useMusicPlayerStore.getState().isPlaying) useMusicPlayerStore.getState().pause();
  for (const element of document.querySelectorAll<HTMLMediaElement>("video[data-watch-time], audio")) {
    if (!element.paused) element.pause();
  }
}

function notify(): void {
  void showDownloadNotification(getString("daily_limit_warning_title"), getString("daily_limit_warning_body")).catch(
    (error) => console.warn("Failed to post the daily limit warning", error),
  );
}

/** The daily limit: counts the time that plays on this device, adds the other devices' time, warns five minutes before the end, and pauses at the end. */
export function useDailyLimit() {
  const enabled = useAppSettingsStore((s) => s.values[SETTINGS.DAILY_LIMIT] === "true");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let ownId = "";
    let ready = false;
    let last = Date.now();
    let lastSaved = 0;
    let lastRefresh = Date.now();
    let dirty = false;
    let busy = false;

    void (async () => {
      ownId = await ensureOwnId();
      const saved = parseShared(await getSetting(SETTINGS.DAILY_TALLY));
      const store = useDailyLimitStore.getState();
      store.setShared(mergeShared(saved, store.shared));
      if (!cancelled) ready = true;
    })();

    const tick = async () => {
      const now = Date.now();
      const elapsed = Math.min(now - last, MAX_COUNTED_GAP_MS);
      last = now;
      if (!ready) return;

      if (now - lastRefresh >= REFRESH_EVERY_MS) {
        lastRefresh = now;
        const saved = parseShared(await getSetting(SETTINGS.DAILY_TALLY));
        const known = useDailyLimitStore.getState();
        known.setShared(mergeShared(saved, known.shared));
      }

      const values = useAppSettingsStore.getState().values;
      const minutes = validMinutes(Number(values[SETTINGS.DAILY_LIMIT_MINUTES]));
      const countMusic = values[SETTINGS.DAILY_LIMIT_MUSIC] === "true";
      const state = useDailyLimitStore.getState();
      const base = rollover(state.tally, epochDayIn(zoneOrDefault(values[SETTINGS.TIME_ZONE]), now));
      if (base !== state.tally) dirty = true;

      const counting = videoPlaying() || (countMusic && musicPlaying());
      let view = counting ? addPlayed(base, elapsed) : base;
      if (counting) dirty = true;

      let urgent = false;
      if (shouldWarn(minutes, view)) {
        view = { ...view, warned: true };
        urgent = true;
        notify();
      }
      if (counting && isUsedUp(minutes, view)) {
        view = { ...view, reached: true };
        urgent = true;
        pauseAllPlayback();
        if (!state.dialogOpen) state.openDialog(now + WAIT_MS);
      }

      if (dirty || urgent) {
        useDailyLimitStore.getState().setShared(withOwn(state.shared, ownId, deviceLabel(), view));
      }
      if (urgent || (dirty && now - lastSaved >= SAVE_EVERY_MS)) {
        await persistShared();
        lastSaved = now;
        dirty = false;
      }
    };

    const timer = setInterval(() => {
      if (busy) return;
      busy = true;
      void tick()
        .catch((error) => console.warn("Daily limit tick failed", error))
        .finally(() => {
          busy = false;
        });
    }, TICK_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);
}
