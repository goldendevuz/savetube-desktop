import { useEffect, useState } from "react";

import { getString } from "../../lib/i18n/index";
import { SETTINGS } from "../../lib/settings/schema";
import { usePreference } from "../../lib/usePreference";
import { GOAL_MAX_LENGTH, encodeGoal, goalFor, parseGoal, writeGoal } from "../../lib/wellbeing/dailyGoal";
import { epochDayIn, zoneOrDefault } from "../../lib/wellbeing/timeZone";
import { setSettingValue } from "../../store/useAppSettingsStore";
import { Button } from "../ui/Button";

/** One thing to get done today, written by the user and ticked off when done. */
export function GoalCard() {
  const [raw] = usePreference(SETTINGS.DAILY_GOAL, "");
  const [zoneChoice] = usePreference(SETTINGS.TIME_ZONE, "Asia/Tashkent");
  const today = epochDayIn(zoneOrDefault(zoneChoice), Date.now());
  const goal = goalFor(parseGoal(raw), today);
  const [draft, setDraft] = useState(goal?.t ?? "");

  // another device changed the goal, or the day turned over
  useEffect(() => setDraft(goal?.t ?? ""), [goal?.t]);

  const save = (text: string, done: boolean) => {
    const trimmed = text.trim();
    void setSettingValue(SETTINGS.DAILY_GOAL, encodeGoal(writeGoal(today, trimmed, trimmed ? done : false, Date.now())));
  };

  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="text-sm text-on-surface-variant">{getString("goal_title")}</div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          aria-label={getString("goal_done")}
          checked={goal?.done ?? false}
          disabled={!goal}
          onChange={(event) => goal && save(goal.t, event.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        <input
          value={draft}
          maxLength={GOAL_MAX_LENGTH}
          placeholder={getString("goal_placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft.trim() !== (goal?.t ?? "") && save(draft, goal?.done ?? false)}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className={`min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            goal?.done ? "line-through opacity-60" : ""
          }`}
        />
        {goal && (
          <Button variant="secondary" size="sm" onClick={() => save("", false)}>
            {getString("goal_clear")}
          </Button>
        )}
      </div>
      <div className="text-xs text-on-surface-variant">{getString("goal_hint")}</div>
    </div>
  );
}
