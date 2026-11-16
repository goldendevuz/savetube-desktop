import { getString } from "../../lib/i18n/index";
import { spentTimeLabel } from "../../lib/recap/recapFormat";
import { percentLabel, useTopChannels } from "../../lib/wellbeing/useTopChannels";
import { Button } from "../ui/Button";

/** The channels this month's watching went to, with a bar each, and the share that was Shorts. */
export function TopChannelsCard() {
  const { data, failed, retry } = useTopChannels();

  if (failed) {
    return (
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm text-on-surface-variant">{getString("watch_time_failed")}</span>
        <Button variant="secondary" size="sm" onClick={retry}>{getString("retry")}</Button>
      </div>
    );
  }
  if (!data) return <div className="h-40 animate-pulse" />;

  const longest = data.channels[0]?.durationMs ?? 0;
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="text-sm text-on-surface-variant">{getString("top_channels_month_title")}</div>
      {data.channels.length === 0 ? (
        <div className="py-4 text-sm text-on-surface-variant">{getString("no_watch_data")}</div>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.channels.map((channel, index) => (
            <li key={channel.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-on-surface">
                  <span className="me-2 tabular-nums text-on-surface-variant">{index + 1}</span>
                  {channel.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-on-surface-variant">{spentTimeLabel(channel.durationMs)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${longest > 0 ? Math.max(4, Math.round((channel.durationMs / longest) * 100)) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {data.shortsShare !== null && (
        <p className="text-xs text-on-surface-variant">{getString("shorts_share_label", percentLabel(data.shortsShare))}</p>
      )}
    </div>
  );
}
