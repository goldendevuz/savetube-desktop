import { useDailyLimit } from "../../lib/wellbeing/useDailyLimit";
import { useWellbeingReminders } from "../../lib/wellbeing/useWellbeingReminders";
import { DailyLimitDialog } from "./DailyLimitDialog";

/** Mounted once, in the main window. */
export function WellbeingController() {
  useWellbeingReminders();
  useDailyLimit();
  return <DailyLimitDialog />;
}
