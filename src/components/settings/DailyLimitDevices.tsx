import { getString } from "../../lib/i18n/index";
import { spentTimeLabel } from "../../lib/recap/recapFormat";
import { SETTINGS } from "../../lib/settings/schema";
import { deviceShares, remainingMs, validMinutes } from "../../lib/wellbeing/dailyLimit";
import { useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useDailyLimitStore } from "../../store/useDailyLimitStore";

/** Today's time on all devices together and against the limit, then each device's share of it. */
export function DailyLimitDevices() {
  const tally = useDailyLimitStore((s) => s.tally);
  const shared = useDailyLimitStore((s) => s.shared);
  const ownId = useDailyLimitStore((s) => s.ownId);
  const minutes = validMinutes(Number(useAppSettingsStore((s) => s.values[SETTINGS.DAILY_LIMIT_MINUTES])));
  if (!tally) return null;

  const allowedMs = minutes * 60_000 + tally.extraMs;
  const left = remainingMs(minutes, tally);
  const shares = deviceShares(shared, tally.day, ownId);
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="text-sm text-on-surface">
        {getString("daily_limit_today_total", spentTimeLabel(tally.playedMs), spentTimeLabel(allowedMs))}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-[var(--color-primary)]"
          style={{ width: `${allowedMs > 0 ? Math.min(100, Math.round((tally.playedMs / allowedMs) * 100)) : 0}%` }}
        />
      </div>
      <div className="text-xs text-on-surface-variant">
        {getString("daily_limit_left", spentTimeLabel(left))}
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {shares.map((device) => {
          const name = device.name || getString("daily_limit_device_unnamed");
          return (
            <li key={device.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-on-surface-variant">
                {device.own ? getString("daily_limit_device_own", name) : name}
              </span>
              <span className="shrink-0 tabular-nums text-on-surface">{spentTimeLabel(device.ms)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
