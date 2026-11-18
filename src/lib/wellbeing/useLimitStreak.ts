import { useEffect } from "react";

import { getSetting } from "../api/db";
import { showDownloadNotification } from "../api/downloads";
import { getString } from "../i18n/index";
import { SETTINGS } from "../settings/schema";
import { setSettingValue, useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useDailyLimitStore } from "../../store/useDailyLimitStore";
import { encodeStreak, newMilestone, parseStreak, recordDay } from "./limitStreak";
import { epochDayIn, zoneOrDefault } from "./timeZone";

const CHECK_EVERY_MS = 30_000;

async function update(): Promise<void> {
  const values = useAppSettingsStore.getState().values;
  const today = epochDayIn(zoneOrDefault(values[SETTINGS.TIME_ZONE]), Date.now());
  const tally = useDailyLimitStore.getState().tally;
  const saved = parseStreak(await getSetting(SETTINGS.LIMIT_STREAK));

  let next = recordDay(saved, today, false);
  // the limit ran out (or "Keep watching" was used) on the day of the count, which can be yesterday just after midnight
  if (tally && (tally.reached || tally.extraMs > 0) && tally.day >= next.s && tally.day <= today) {
    next = recordDay(next, tally.day, true);
  }
  const milestone = newMilestone(next, today);
  if (milestone !== null) {
    next = { ...next, a: milestone };
    void showDownloadNotification(getString("streak_milestone_title", milestone), getString("streak_milestone_body", milestone)).catch(
      (error) => console.warn("Failed to post the streak badge", error),
    );
  }
  if (next !== saved) await setSettingValue(SETTINGS.LIMIT_STREAK, encodeStreak(next));
}

/** Keeps the daily limit streak up to date while the limit is on, and announces a new badge once. */
export function useLimitStreak() {
  const enabled = useAppSettingsStore((s) => s.values[SETTINGS.DAILY_LIMIT] === "true");

  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const run = () => {
      if (busy) return;
      busy = true;
      void update()
        .catch((error) => console.warn("Streak update failed", error))
        .finally(() => {
          busy = false;
        });
    };
    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}
