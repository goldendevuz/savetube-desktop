import { getString } from "../../lib/i18n/index";
import { SETTINGS } from "../../lib/settings/schema";
import { useBoolPref, usePreference } from "../../lib/usePreference";
import { MILESTONES, currentStreak, nextMilestone, parseStreak } from "../../lib/wellbeing/limitStreak";
import { epochDayIn, zoneOrDefault } from "../../lib/wellbeing/timeZone";
import { SettingItem } from "./SettingItem";

/** Days in a row the daily limit held, the best run, and the badges earned. */
export function StreakCard() {
  const [limitOn] = useBoolPref(SETTINGS.DAILY_LIMIT, false);
  const [raw] = usePreference(SETTINGS.LIMIT_STREAK, "");
  const [zoneChoice] = usePreference(SETTINGS.TIME_ZONE, "Asia/Tashkent");

  if (!limitOn) return <SettingItem title={getString("streak_title")} description={getString("streak_needs_limit")}>{null}</SettingItem>;

  const streak = parseStreak(raw);
  const days = currentStreak(streak, epochDayIn(zoneOrDefault(zoneChoice), Date.now()));
  const best = Math.max(streak?.best ?? 0, days);
  const next = nextMilestone(days);
  const previous = [...MILESTONES].reverse().find((m) => m <= days) ?? 0;
  const progress = next === null ? 1 : (days - previous) / (next - previous);

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="text-sm text-on-surface-variant">{getString("streak_title")}</div>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-on-surface">{days}</span>
        <span className="text-sm text-on-surface-variant">{getString("streak_unit")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm tabular-nums text-on-surface-variant">
        <span>{getString("streak_best", best)}</span>
        <span>{next === null ? getString("streak_all") : getString("streak_next", next)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {MILESTONES.map((m) => (
          <span
            key={m}
            className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${
              best >= m ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
