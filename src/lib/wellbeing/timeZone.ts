/**
 * The time zone the daily limit and the bedtime reminder keep their days and clock in. It is a setting, "Asia/Tashkent"
 * unless changed, so a day starts at the same moment on every device whatever their own clocks say.
 */
export const DEFAULT_TIME_ZONE = "Asia/Tashkent";

/** Names of UTC and its aliases: the list leaves them out, the clock of a place is what is wanted. */
const UTC_NAMES = new Set(["UTC", "Etc/UTC", "Etc/UCT", "UCT", "Etc/Universal", "Universal", "Etc/Zulu", "Zulu", "Etc/GMT", "GMT", "Etc/Greenwich", "Greenwich"]);

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidZone(zone: string | null | undefined): zone is string {
  if (!zone || UTC_NAMES.has(zone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The zone that was chosen, or the default when none was or it is not one this system knows. */
export function zoneOrDefault(zone: string | null | undefined): string {
  return isValidZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

/** Every zone to choose from, by name, without UTC. */
export function selectableZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const names = supported ? supported("timeZone") : [DEFAULT_TIME_ZONE];
  const zones = names.filter((name) => !UTC_NAMES.has(name));
  return zones.includes(DEFAULT_TIME_ZONE) ? zones : [DEFAULT_TIME_ZONE, ...zones];
}

function formatter(zone: string): Intl.DateTimeFormat {
  let known = formatters.get(zone);
  if (!known) {
    known = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(zone, known);
  }
  return known;
}

/** The wall clock of `zone` at `ms`, read as if it were UTC: the number to subtract the real time from for the offset. */
function wallClockAsUtc(zone: string, ms: number): number {
  const parts: Record<string, number> = {};
  for (const part of formatter(zone).formatToParts(new Date(ms))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
}

/** How far `zone` is ahead of UTC at `ms`, in ms. */
export function offsetMs(zone: string, ms: number): number {
  return wallClockAsUtc(zone, ms) - Math.floor(ms / 1000) * 1000;
}

/** The calendar day of `ms` in `zone`, as a number of days: it changes when `zone`'s clock passes midnight. */
export function epochDayIn(zone: string, ms: number): number {
  return Math.floor(wallClockAsUtc(zone, ms) / DAY_MS);
}

/** The next moment after `nowMs` when `zone`'s clock reads `minutesOfDay` (0 to 1439). */
export function nextWallClockAt(zone: string, minutesOfDay: number, nowMs: number): number {
  const wallNow = wallClockAsUtc(zone, nowMs);
  let wallTarget = Math.floor(wallNow / DAY_MS) * DAY_MS + minutesOfDay * 60_000;
  if (wallTarget <= wallNow) wallTarget += DAY_MS;
  const guess = nowMs + (wallTarget - wallNow);
  // The offset at the target decides, in case a clock change falls between now and then.
  return wallTarget - offsetMs(zone, guess);
}

/** "Asia/Tashkent (UTC+05:00)". */
export function zoneLabel(zone: string, ms: number = Date.now()): string {
  const minutes = Math.round(offsetMs(zone, ms) / 60_000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${zone} (UTC${sign}${hh}:${mm})`;
}
