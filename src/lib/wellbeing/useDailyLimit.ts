import { useEffect } from "react";

import { setSettingValue, useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useDailyLimitStore } from "../../store/useDailyLimitStore";
import { useMusicPlayerStore } from "../../store/useMusicPlayerStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { showDownloadNotification } from "../api/downloads";
import { getString } from "../i18n/index";
import { SETTINGS } from "../settings/schema";
import {
  WAIT_MS,
  addPlayed,
  emptyTally,
  isUsedUp,
  localEpochDay,
  rollover,
  shouldWarn,
  validMinutes,
  type DailyTally,
} from "./dailyLimit";

const TICK_MS = 1_000;
/** A longer gap between ticks means the computer slept: that time was not spent watching. */
const MAX_COUNTED_GAP_MS = 3_000;
/** The count is saved this often while it changes, and at once when something happens. */
const SAVE_EVERY_MS = 10_000;

/** Reads the saved count; anything unreadable is a fresh day. */
export function parseTally(raw: string | undefined): DailyTally | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DailyTally>;
    if (typeof value.day !== "number" || typeof value.playedMs !== "number") return null;
    return {
      day: value.day,
      playedMs: Math.max(0, value.playedMs),
      extraMs: Math.max(0, Number(value.extraMs ?? 0)),
      warned: value.warned === true,
      reached: value.reached === true,
    };
  } catch {
    return null;
  }
}

export function saveTally(tally: DailyTally): void {
  useDailyLimitStore.getState().setTally(tally);
  void setSettingValue(SETTINGS.DAILY_TALLY, JSON.stringify(tally));
}

/** Whether a video is playing: the video player, or a Short (its video element carries `data-watch-time`). */
function videoPlaying(): boolean {
  if (usePlayerStore.getState().isPlaying) return true;
  for (const element of document.querySelectorAll<HTMLVideoElement>("video[data-watch-time]")) {
    if (!element.paused && !element.ended && element.readyState > 2) return true;
  }
  return false;
}

function musicPlaying(): boolean {
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

/** The daily limit: counts the time that plays, warns five minutes before the end, and pauses at the end. */
export function useDailyLimit() {
  const enabled = useAppSettingsStore((s) => s.values[SETTINGS.DAILY_LIMIT] === "true");

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let lastSaved = 0;
    let dirty = false;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(now - last, MAX_COUNTED_GAP_MS);
      last = now;

      const values = useAppSettingsStore.getState().values;
      const minutes = validMinutes(Number(values[SETTINGS.DAILY_LIMIT_MINUTES]));
      const countMusic = values[SETTINGS.DAILY_LIMIT_MUSIC] === "true";
      const state = useDailyLimitStore.getState();
      const today = localEpochDay(now);
      let tally = rollover(state.tally ?? parseTally(values[SETTINGS.DAILY_TALLY]), today);
      if (tally !== state.tally) {
        state.setTally(tally);
        dirty = true;
      }

      const counting = videoPlaying() || (countMusic && musicPlaying());
      if (counting) {
        tally = addPlayed(tally, elapsed);
        dirty = true;
      }

      let urgent = false;
      if (shouldWarn(minutes, tally)) {
        tally = { ...tally, warned: true };
        urgent = true;
        notify();
      }
      if (counting && isUsedUp(minutes, tally)) {
        tally = { ...tally, reached: true };
        urgent = true;
        pauseAllPlayback();
        if (!state.dialogOpen) state.openDialog(now + WAIT_MS);
      }

      if (dirty && (urgent || now - lastSaved >= SAVE_EVERY_MS)) {
        saveTally(tally);
        lastSaved = now;
        dirty = false;
      } else if (dirty) {
        state.setTally(tally);
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [enabled]);
}

/** A tally for today with nothing counted, for a fresh start. */
export function freshTally(now = Date.now()): DailyTally {
  return emptyTally(localEpochDay(now));
}
