import { getString } from "../../lib/i18n/index";
import { spentTimeLabel } from "../../lib/recap/recapFormat";
import { SETTINGS } from "../../lib/settings/schema";
import { minuteOfDayIn, zoneOrDefault } from "../../lib/wellbeing/timeZone";
import { minutesUntilOpen } from "../../lib/wellbeing/watchWindow";
import { useAppSettingsStore } from "../../store/useAppSettingsStore";
import { useWatchWindowStore } from "../../store/useWatchWindowStore";
import { Button } from "../ui/Button";
import { InfoDialog } from "../ui/InfoDialog";

/** Shown when a video is played outside the watching hours: what the hours are and when they open. */
export function WatchWindowDialog() {
  const open = useWatchWindowStore((s) => s.dialogOpen);
  const values = useAppSettingsStore((s) => s.values);
  if (!open) return null;

  const from = values[SETTINGS.WATCH_WINDOW_FROM] ?? "07:00";
  const to = values[SETTINGS.WATCH_WINDOW_TO] ?? "22:00";
  const zone = zoneOrDefault(values[SETTINGS.TIME_ZONE]);
  const wait = minutesUntilOpen(from, to, minuteOfDayIn(zone, Date.now())) * 60_000;
  const close = () => useWatchWindowStore.getState().closeDialog();

  return (
    <InfoDialog
      title={getString("watch_window_closed_title")}
      closeLabel={getString("close")}
      onClose={close}
      footer={<Button onClick={close}>{getString("close")}</Button>}
    >
      <p className="text-sm text-chrome-neutral-200">
        {getString("watch_window_closed_body", from, to, spentTimeLabel(wait))}
      </p>
      <p className="mt-3 text-xs text-chrome-neutral-400">{getString("watch_window_closed_note")}</p>
    </InfoDialog>
  );
}
