import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { InfoDialog } from "../ui/InfoDialog";
import { useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useDailyLimitStore } from "../../store/useDailyLimitStore";
import { getString } from "../../lib/i18n/index";
import { spentTimeLabel } from "../../lib/recap/recapFormat";
import { SETTINGS } from "../../lib/settings/schema";
import { extend, validMinutes } from "../../lib/wellbeing/dailyLimit";
import { saveTally } from "../../lib/wellbeing/useDailyLimit";

/** Shown when the daily limit runs out: today's time, Close, and Keep watching once the wait has passed. */
export function DailyLimitDialog() {
  const open = useDailyLimitStore((s) => s.dialogOpen);
  const keepWatchingAt = useDailyLimitStore((s) => s.keepWatchingAt);
  const tally = useDailyLimitStore((s) => s.tally);
  const minutes = validMinutes(Number(useAppSettingsStore((s) => s.values[SETTINGS.DAILY_LIMIT_MINUTES])));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [open, keepWatchingAt]);

  if (!open || tally === null) return null;

  const secondsLeft = Math.max(0, Math.ceil((keepWatchingAt - now) / 1000));
  const close = () => useDailyLimitStore.getState().closeDialog();
  const keepWatching = () => {
    saveTally(extend(minutes, tally));
    close();
  };

  return (
    <InfoDialog
      title={getString("daily_limit_reached_title")}
      closeLabel={getString("close")}
      onClose={close}
      footer={
        <>
          <Button variant="outline" disabled={secondsLeft > 0} onClick={keepWatching}>
            {secondsLeft > 0
              ? getString("times_up_keep_watching_wait", secondsLeft)
              : getString("times_up_keep_watching")}
          </Button>
          <Button onClick={close}>{getString("close")}</Button>
        </>
      }
    >
      <p className="text-sm text-chrome-neutral-200">
        {getString("times_up_body", spentTimeLabel(tally.playedMs), spentTimeLabel(minutes * 60_000))}
      </p>
      <p className="mt-3 text-xs text-chrome-neutral-400">{getString("times_up_keep_watching_note")}</p>
    </InfoDialog>
  );
}
