import { useEffect, useState } from "react";

import { getString } from "../../lib/i18n/index";
import { spentTimeLabel } from "../../lib/recap/recapFormat";
import { SETTINGS } from "../../lib/settings/schema";
import {
  MINUTE_CHOICES,
  WAIT_MS,
  changeNeedsWait,
  aggregate,
  latestDay,
  parseShared,
  validMinutes,
  type DailyLimitSettings,
} from "../../lib/wellbeing/dailyLimit";
import { epochDayIn, msUntilMidnightIn, zoneOrDefault } from "../../lib/wellbeing/timeZone";
import { setSettingValue, useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useDailyLimitStore } from "../../store/useDailyLimitStore";
import { DailyLimitDevices } from "./DailyLimitDevices";
import { Button } from "../ui/Button";
import { InfoDialog } from "../ui/InfoDialog";
import { Select } from "../ui/Select";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { SettingItem } from "./SettingItem";

const MS_PER_MINUTE = 60_000;

function write(next: DailyLimitSettings) {
  void setSettingValue(SETTINGS.DAILY_LIMIT, String(next.enabled));
  void setSettingValue(SETTINGS.DAILY_LIMIT_MINUTES, String(next.minutes));
  void setSettingValue(SETTINGS.DAILY_LIMIT_MUSIC, String(next.countMusic));
}

/** Turning the limit off or lowering it after it ran out today asks for a short wait first. */
function WaitDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [deadline] = useState(() => Date.now() + WAIT_MS);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <InfoDialog
      title={getString("daily_limit_wait_title")}
      closeLabel={getString("close")}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {getString("close")}
          </Button>
          <Button disabled={secondsLeft > 0} onClick={onConfirm}>
            {secondsLeft > 0 ? getString("daily_limit_wait_countdown", secondsLeft) : getString("daily_limit_wait_confirm")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-chrome-neutral-200">{getString("daily_limit_wait_body")}</p>
    </InfoDialog>
  );
}

/** "Resets in 5 h 12 min": when the clock passes midnight and today's count starts again. */
function ResetsIn({ zone }: { zone: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="px-1 pb-1 text-xs tabular-nums text-chrome-neutral-400">
      {getString("daily_limit_resets_in", spentTimeLabel(msUntilMidnightIn(zone, now)))}
    </p>
  );
}

/** The daily limit switch, and while it is on, how long it allows and whether music counts. */
export function DailyLimitRows() {
  const values = useAppSettingsStore((s) => s.values);
  const liveTally = useDailyLimitStore((s) => s.tally);
  const current: DailyLimitSettings = {
    enabled: values[SETTINGS.DAILY_LIMIT] === "true",
    minutes: validMinutes(Number(values[SETTINGS.DAILY_LIMIT_MINUTES])),
    countMusic: values[SETTINGS.DAILY_LIMIT_MUSIC] === "true",
  };
  const [pending, setPending] = useState<DailyLimitSettings | null>(null);
  const latest = latestDay(parseShared(values[SETTINGS.DAILY_TALLY]));

  const change = (next: DailyLimitSettings) => {
    const tally = liveTally ?? (latest === null ? null : aggregate(parseShared(values[SETTINGS.DAILY_TALLY]), latest));
    if (changeNeedsWait(current, next, tally, epochDayIn(zoneOrDefault(values[SETTINGS.TIME_ZONE]), Date.now()))) setPending(next);
    else write(next);
  };

  return (
    <>
      <SettingItem title={getString("daily_limit_title")} description={getString("daily_limit_subtitle")}>
        <ToggleSwitch checked={current.enabled} onChange={(enabled) => change({ ...current, enabled })} />
      </SettingItem>
      {current.enabled && (
        <SettingItem title={getString("daily_limit_time_title")} description={getString("daily_limit_time_description")}>
          <Select
            value={String(current.minutes)}
            onChange={(minutes) => change({ ...current, minutes: Number(minutes) })}
            options={MINUTE_CHOICES.map((minutes) => ({
              value: String(minutes),
              label: spentTimeLabel(minutes * MS_PER_MINUTE),
            }))}
          />
        </SettingItem>
      )}
      {current.enabled && (
        <SettingItem title={getString("daily_limit_music_title")} description={getString("daily_limit_music_subtitle")}>
          <ToggleSwitch checked={current.countMusic} onChange={(countMusic) => change({ ...current, countMusic })} />
        </SettingItem>
      )}
      {current.enabled && <ResetsIn zone={zoneOrDefault(values[SETTINGS.TIME_ZONE])} />}
      {current.enabled && <DailyLimitDevices />}
      {current.enabled && <p className="px-1 pb-2 text-xs text-chrome-neutral-400">{getString("daily_limit_footer")}</p>}
      {pending && (
        <WaitDialog
          onCancel={() => setPending(null)}
          onConfirm={() => {
            write(pending);
            setPending(null);
          }}
        />
      )}
    </>
  );
}
