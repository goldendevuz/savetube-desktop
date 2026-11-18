import { useEffect } from "react";

import { useAppSettingsStore } from "../../store/useAppSettingsStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useWatchWindowStore } from "../../store/useWatchWindowStore";
import { SETTINGS } from "../settings/schema";
import { minuteOfDayIn, zoneOrDefault } from "./timeZone";
import { videoPlaying } from "./useDailyLimit";
import { isOpen } from "./watchWindow";

const CHECK_MS = 2_000;

/** Stops the videos (not the music) and says why. Plays again as soon as the window opens, when the user presses play. */
function pauseVideos(): void {
  usePlayerStore.getState().setIsPlaying(false);
  for (const element of document.querySelectorAll<HTMLVideoElement>("video[data-watch-time]")) {
    if (!element.paused) element.pause();
  }
}

/** Watching hours: while the window is closed, a playing video is paused and a dialog explains. */
export function useWatchWindow() {
  const enabled = useAppSettingsStore((s) => s.values[SETTINGS.WATCH_WINDOW] === "true");

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const values = useAppSettingsStore.getState().values;
      const zone = zoneOrDefault(values[SETTINGS.TIME_ZONE]);
      const from = values[SETTINGS.WATCH_WINDOW_FROM] ?? "07:00";
      const to = values[SETTINGS.WATCH_WINDOW_TO] ?? "22:00";
      if (isOpen(from, to, minuteOfDayIn(zone, Date.now())) || !videoPlaying()) return;
      pauseVideos();
      useWatchWindowStore.getState().openDialog();
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}
