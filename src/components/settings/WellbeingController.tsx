import { usePublishStats } from "../../lib/wellbeing/useCombinedStats";
import { useDailyLimit } from "../../lib/wellbeing/useDailyLimit";
import { useLimitStreak } from "../../lib/wellbeing/useLimitStreak";
import { useWatchWindow } from "../../lib/wellbeing/useWatchWindow";
import { useWatchTracking } from "../../lib/wellbeing/useWatchTracking";
import { useFocusModes } from "../../lib/useFocusModes";
import { useWellbeingReminders } from "../../lib/wellbeing/useWellbeingReminders";
import { DailyLimitDialog } from "./DailyLimitDialog";
import { WatchWindowDialog } from "./WatchWindowDialog";

/** Mounted once, in the main window. */
export function WellbeingController() {
  useWellbeingReminders();
  useFocusModes();
  useDailyLimit();
  useWatchWindow();
  useLimitStreak();
  useWatchTracking();
  usePublishStats();
  return (
    <>
      <DailyLimitDialog />
      <WatchWindowDialog />
    </>
  );
}
