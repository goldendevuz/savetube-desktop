import { getString } from "../../lib/i18n/index";
import { spentTimeLabel } from "../../lib/recap/recapFormat";
import { SETTINGS } from "../../lib/settings/schema";
import { usePreference } from "../../lib/usePreference";
import { parseHours, summarizeHours } from "../../lib/wellbeing/watchHours";

const HOUR_LABELS = [0, 6, 12, 18, 23];

/** The 24 hours of the day, the bar of each as tall as the time played then, over the last 28 days. */
export function HoursCard() {
  const [raw] = usePreference(SETTINGS.WATCH_HOURS, "");
  const { byHour, total, peakHour } = summarizeHours(parseHours(raw));
  const peak = Math.max(...byHour, 1);

  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="text-sm text-on-surface-variant">{getString("hours_title")}</div>
      {peakHour === null ? (
        <div className="text-sm text-on-surface-variant">{getString("hours_none")}</div>
      ) : (
        <>
          <div className="text-lg font-semibold text-on-surface">
            {getString("hours_peak", `${peakHour}:00–${(peakHour + 1) % 24}:00`)}
          </div>
          <div className="flex h-20 items-end gap-[3px]" aria-hidden>
            {byHour.map((ms, hour) => (
              <div
                key={hour}
                title={`${hour}:00 · ${spentTimeLabel(ms)}`}
                className={`flex-1 rounded-sm ${hour === peakHour ? "bg-primary" : "bg-primary/40"}`}
                style={{ height: `${Math.max(4, Math.round((ms / peak) * 100))}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs tabular-nums text-on-surface-variant">
            {HOUR_LABELS.map((hour) => (
              <span key={hour}>{hour}:00</span>
            ))}
          </div>
          <div className="text-xs tabular-nums text-on-surface-variant">{getString("hours_total", spentTimeLabel(total))}</div>
        </>
      )}
    </div>
  );
}
