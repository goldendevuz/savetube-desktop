import { usePublishStats } from "../../lib/wellbeing/useCombinedStats";
import { useDailyLimit } from "../../lib/wellbeing/useDailyLimit";
import { useLimitStreak } from "../../lib/wellbeing/useLimitStreak";
import { useFocusModes } from "../../lib/useFocusModes";
import { useWellbeingReminders } from "../../lib/wellbeing/useWellbeingReminders";
import { DailyLimitDialog } from "./DailyLimitDialog";

/** Mounted once, in the main window. */
export function WellbeingController() {
  useWellbeingReminders();
  useFocusModes();
  useDailyLimit();
  useLimitStreak();
  usePublishStats();
  return <DailyLimitDialog />;
}
