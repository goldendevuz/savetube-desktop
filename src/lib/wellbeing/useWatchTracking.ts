import { useEffect } from "react";

import { getSetting } from "../api/db";
import { SETTINGS } from "../settings/schema";
import { setSettingValue, useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useSessionStore } from "../../store/useSessionStore";
import { musicPlaying, videoPlaying } from "./useDailyLimit";
import { epochDayIn, hourIn, zoneOrDefault } from "./timeZone";
import { addHours, encodeHours, parseHours } from "./watchHours";

const TICK_MS = 1_000;
/** A longer gap between ticks means the computer slept: that time was not spent watching. */
const MAX_COUNTED_GAP_MS = 3_000;
const SAVE_EVERY_MS = 30_000;
/** Not playing for this long ends the session. */
export const SESSION_BREAK_MS = 5 * 60_000;

/**
 * Follows the playing time of this device: the hours of the day it falls in (for the "when you watch" card) and the
 * current session, which ends after five minutes without playing (for the timer in the player).
 */
export function useWatchTracking() {
  useEffect(() => {
    let last = Date.now();
    let lastSaved = Date.now();
    let sessionMs = 0;
    let idleMs = 0;
    let pending: { day: number; hour: number; ms: number }[] = [];
    let busy = false;

    const flush = async () => {
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      let ledger = parseHours(await getSetting(SETTINGS.WATCH_HOURS));
      for (const entry of batch) ledger = addHours(ledger, entry.day, entry.hour, entry.ms);
      await setSettingValue(SETTINGS.WATCH_HOURS, encodeHours(ledger));
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = Math.min(now - last, MAX_COUNTED_GAP_MS);
      last = now;
      const playing = videoPlaying() || musicPlaying();
      if (playing) {
        const zone = zoneOrDefault(useAppSettingsStore.getState().values[SETTINGS.TIME_ZONE]);
        const day = epochDayIn(zone, now);
        const hour = hourIn(zone, now);
        const tail = pending[pending.length - 1];
        if (tail && tail.day === day && tail.hour === hour) tail.ms += elapsed;
        else pending.push({ day, hour, ms: elapsed });
        sessionMs += elapsed;
        idleMs = 0;
      } else {
        idleMs += elapsed;
        if (idleMs >= SESSION_BREAK_MS) sessionMs = 0;
      }
      const shown = useSessionStore.getState();
      if (Math.floor(shown.sessionMs / 60_000) !== Math.floor(sessionMs / 60_000) || (shown.sessionMs === 0) !== (sessionMs === 0)) {
        shown.setSessionMs(sessionMs);
      }
      if (pending.length && now - lastSaved >= SAVE_EVERY_MS && !busy) {
        busy = true;
        lastSaved = now;
        void flush()
          .catch((error) => console.warn("Saving watch hours failed", error))
          .finally(() => {
            busy = false;
          });
      }
    };

    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      void flush().catch(() => undefined);
    };
  }, []);
}
