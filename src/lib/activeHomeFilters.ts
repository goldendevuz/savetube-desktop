import { getString } from "./i18n/index";
import { SETTINGS, type SettingKey } from "./settings/schema";
import { parseDurationGroups } from "./durationGroups";
import { parseHomeLanguages } from "./homeLanguages";

/** The Home settings that can leave the feed empty, read from the settings values. */
export type HomeFilterValues = Partial<Record<SettingKey, string | undefined>>;

const LENGTH_LABELS: Record<string, Parameters<typeof getString>[0]> = {
  g2: "settings_home_duration_g2",
  g3: "settings_home_duration_g3",
  g4: "settings_home_duration_g4",
  g5: "settings_home_duration_g5",
  g6: "settings_home_duration_g6",
  g7: "settings_home_duration_g7",
  g8: "settings_home_duration_g8",
};

/** A whole number as a viewer reads it, with thousands separators. */
function count(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * The Home settings that are on and hide videos, in plain words, for the page shown when Home has nothing
 * to show: a viewer who set a strict filter and forgot it can see what to loosen. The old "g1" length
 * choice is not one of the options any more and is read as "any length".
 */
export function activeHomeFilters(values: HomeFilterValues): string[] {
  const filters: string[] = [];
  const views = count(values[SETTINGS.HOME_MIN_VIEWS]);
  if (views > 0) filters.push(getString("home_filter_min_views", views.toLocaleString("en-US")));
  const subscribers = count(values[SETTINGS.HOME_MIN_SUBSCRIBERS]);
  if (subscribers > 0) filters.push(getString("home_filter_min_subscribers", subscribers.toLocaleString("en-US")));
  const lengths = parseDurationGroups(values[SETTINGS.HOME_DURATION_GROUP]).flatMap((key) => {
    const label = LENGTH_LABELS[key];
    return label ? [getString(label)] : [];
  });
  if (lengths.length > 0) filters.push(getString("home_filter_length", lengths.join(", ")));
  if (values[SETTINGS.HOME_HIDE_MUSIC_VIDEOS] === "true") filters.push(getString("home_filter_music"));
  if (values[SETTINGS.HOME_HIDE_MEDIA_CLIPS] !== "false") filters.push(getString("home_filter_media"));
  if (values[SETTINGS.HOME_HIDE_GAMING] === "true") filters.push(getString("home_filter_gaming"));
  const languages = parseHomeLanguages(values[SETTINGS.HOME_LANGUAGES]).map((code) =>
    getString(`language_name_${code}` as const),
  );
  if (languages.length > 0) filters.push(getString("home_filter_languages", languages.join(", ")));
  const scope = values[SETTINGS.HOME_FEED_SCOPE];
  if (scope === "subscribed") filters.push(getString("home_filter_scope_subscribed"));
  if (scope === "unsubscribed") filters.push(getString("home_filter_scope_unsubscribed"));
  if (values[SETTINGS.HIDE_SEEN_VIDEOS] === "true") filters.push(getString("home_filter_seen"));
  return filters;
}
