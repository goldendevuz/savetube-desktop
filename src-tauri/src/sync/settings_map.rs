//! Desktop settings ⇄ the canonical setting keys on the wire (`FLOW-SYNC/1` §6.4).
//!
//! Flow for Android only understands its own canonical names (`autoplay`, `return_youtube_dislikes`,
//! …) with typed values, so a shared setting is renamed and typed on the way out and mapped back
//! on the way in. Settings only the desktop has travel under a `desktop.` prefix, which Android
//! ignores and another desktop maps back. Older desktop builds sent raw desktop keys, which are
//! still accepted. The SponsorBlock actions, one JSON setting here, travel as Android's nine
//! per-category settings.
//!
//! `default_video_codec` is deliberately not synced: an AV1 or VP9 preference that suits one device
//! freezes video on a desktop or phone without that hardware decoder. `skip_silence` stays out
//! because the desktop has no such setting.

use std::collections::BTreeMap;

use serde_json::{Value, json};

use crate::sync::canonical::{Hlc, SettingEntry};
use crate::sync::mapping::iso_to_ms;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Bool,
    Number,
    /// A whole number, sent without a decimal point (Android reads it as a `Long`).
    Whole,
    Text,
}

struct Shared {
    canonical: &'static str,
    desktop: &'static str,
    kind: Kind,
}

const fn shared(canonical: &'static str, desktop: &'static str, kind: Kind) -> Shared {
    Shared {
        canonical,
        desktop,
        kind,
    }
}

/// Settings both platforms have, mirroring Android's `SettingsMapper.WHITELIST`.
const SHARED: &[Shared] = &[
    shared("autoplay", "autoplay_enabled", Kind::Bool),
    shared("queue_autoplay", "queue_autoplay_enabled", Kind::Bool),
    shared("default_quality_wifi", "default_quality_wifi", Kind::Text),
    shared("playback_speed", "playback_speed", Kind::Number),
    shared("sponsorblock_enabled", "sponsorblock_enabled", Kind::Bool),
    shared(
        "sponsorblock_submit_enabled",
        "sb_submit_enabled",
        Kind::Bool,
    ),
    shared("dearrow_enabled", "dearrow_enabled", Kind::Bool),
    shared("dearrow_badge_enabled", "dearrow_badge_enabled", Kind::Bool),
    shared("subtitles_enabled", "subtitles_enabled", Kind::Bool),
    shared("trending_region", "trending_region", Kind::Text),
    shared("hide_watched_videos", "hide_watched_videos", Kind::Bool),
    shared("comments_enabled", "comments_enabled", Kind::Bool),
    shared("return_youtube_dislikes", "rytd_enabled", Kind::Bool),
    shared("video_loop", "video_loop_enabled", Kind::Bool),
    shared("stable_volume", "stable_volume_enabled", Kind::Bool),
    shared(
        "subscriptions_show_videos",
        "subscription_show_videos",
        Kind::Bool,
    ),
    shared(
        "subscriptions_show_shorts",
        "subscription_show_shorts",
        Kind::Bool,
    ),
    shared(
        "subscriptions_show_live",
        "subscription_show_live",
        Kind::Bool,
    ),
    shared("shorts_quality_wifi", "shorts_quality_wifi", Kind::Text),
    shared("music_audio_quality", "music_audio_quality", Kind::Text),
    shared(
        "preferred_audio_language",
        "preferred_audio_language",
        Kind::Text,
    ),
    shared(
        "preferred_subtitle_language",
        "preferred_subtitle_language",
        Kind::Text,
    ),
    // The whole equalizer as Android's `EqStateJson`, carried as one JSON string.
    shared("equalizer", "eq_state_json", Kind::Text),
    // What Home and Shorts show; both apps have these, so a choice made on one reaches the other.
    shared(
        "shorts_content_enabled",
        "shorts_content_enabled",
        Kind::Bool,
    ),
    shared("shorts_shelf_enabled", "shorts_shelf_enabled", Kind::Bool),
    shared(
        "home_shorts_shelf_enabled",
        "home_shorts_shelf_enabled",
        Kind::Bool,
    ),
    shared("home_min_views", "home_min_views", Kind::Whole),
    shared("home_duration_group", "home_duration_group", Kind::Text),
    shared("home_feed_scope", "home_feed_scope", Kind::Text),
    shared("home_min_subscribers", "home_min_subscribers", Kind::Whole),
    shared(
        "home_hide_music_videos",
        "home_hide_music_videos",
        Kind::Bool,
    ),
    shared("home_hide_media_clips", "home_hide_media_clips", Kind::Bool),
    shared("home_hide_gaming", "home_hide_gaming", Kind::Bool),
    shared("home_languages", "home_languages", Kind::Text),
    shared("home_pin_fresh_subs", "home_pin_fresh_subs", Kind::Bool),
    shared("daily_limit", "daily_limit", Kind::Bool),
    shared("daily_limit_minutes", "daily_limit_minutes", Kind::Whole),
    shared("daily_limit_music", "daily_limit_music", Kind::Bool),
    shared("time_zone", "time_zone", Kind::Text),
    // Each device's count of today, one JSON text. Merged on arrival, see `merge_daily_time`.
    shared("daily_time", DAILY_TALLY_KEY, Kind::Text),
    // Each device's published watch statistics, one JSON text. Merged on arrival, see `merge_watch_stats`.
    shared("watch_stats", WATCH_STATS_KEY, Kind::Text),
];

/// Player, content and extension preferences only the desktop has. Download paths, proxy
/// credentials, cache sizes, private ids and Deep Flow runtime state are deliberately absent.
const DESKTOP_ONLY: &[&str] = &[
    "autoplay_countdown_seconds",
    "allow_volume_boost",
    "remember_playback_speed",
    "speed_per_channel",
    "music_at_normal_speed",
    "custom_speeds_enabled",
    "custom_speed_presets",
    "long_press_playback_speed",
    "speed_slider_enabled",
    "double_tap_seek_seconds",
    "subtitle_font_scale",
    "subtitle_bold",
    "mini_player_show_skip_controls",
    "mini_player_show_next_prev_controls",
    "mini_player_continue_watching_enabled",
    "mini_player_size",
    "paid_promotion_label",
    "idle_progress_strip_enabled",
    "frame_step_buttons_enabled",
    "show_fullscreen_title",
    "player_button_next_previous",
    "player_button_volume",
    "player_button_chapters",
    "player_button_queue",
    "player_button_live_chat",
    "player_button_comments",
    "player_button_sponsorblock",
    "player_button_quality",
    "player_button_captions",
    "player_button_play_on",
    "player_button_theater",
    "player_button_fullscreen",
    "adaptive_player_size_enabled",
    "auto_pip_enabled",
    "manual_pip_button_enabled",
    "lyrics_provider_order",
    "lyrics_provider_enabled_states",
    "music_player_background",
    "video_title_max_lines",
    "video_hover_preview_mode",
    "download_dialog_style",
    "home_feed_enabled",
    "show_app_logo_icon",
    "channel_shorts_tab_when_hidden",
    "hide_watched_home_feed",
    "hide_watched_subscriptions",
    "hide_watched_shorts",
    "watched_threshold",
    "subs_show_checked_video_count",
    "continue_watching_enabled",
    "home_subscriptions_enabled",
    "refresh_home_on_reselect",
    "home_max_video_age",
    "hide_seen_videos",
    "show_related_videos",
    "disable_shorts_player",
    "shorts_navigation_enabled",
    "shorts_playback_mode",
    "shorts_auto_scroll_seconds",
    "music_navigation_enabled",
    "music_content_enabled",
    "categories_nav_tab_enabled",
    "hide_thumbnails",
    "blur_thumbnails",
    "hide_top_bar",
    "disable_end_cards",
    "black_white_mode",
    "hide_subscriptions_nav",
    "subscription_refresh_on_startup",
    "subscription_collaborations_enabled",
    "subs_sort_mode",
    "notif_shorts_enabled",
    "hide_unplayable_subscriptions",
    "show_region_picker_in_explore",
    "deep_flow_expire_hours",
    "deep_flow_save_history",
    "sponsorblock_server",
    "sponsorblock_colors",
];

/// The desktop keeps every SponsorBlock category's action in one JSON setting; Android keeps one
/// setting per category (`sponsorblock_action_<category>`), which both apps read.
pub const SB_ACTIONS_KEY: &str = "sponsorblock_categories";
const SB_ACTION_PREFIX: &str = "sponsorblock_action_";
const SB_CATEGORIES: [&str; 11] = [
    "sponsor",
    "intro",
    "outro",
    "selfpromo",
    "interaction",
    "music_offtopic",
    "filler",
    "preview",
    "exclusive_access",
    "hook",
    "poi_highlight",
];
/// Desktop action to Android's `SponsorBlockAction` name.
const SB_ACTIONS: [(&str, &str); 7] = [
    ("skip", "SKIP"),
    ("skip_once", "SKIP_ONCE"),
    ("skip_button", "SKIP_BUTTON"),
    ("mute", "MUTE"),
    ("notify", "SHOW_TOAST"),
    ("ignore", "IGNORE"),
    ("disabled", "DISABLED"),
];

/// The desktop setting holding every device's count of today.
pub const DAILY_TALLY_KEY: &str = "daily_tally";
/// Its name on the wire, the same on Android.
pub const DAILY_TIME_WIRE: &str = "daily_time";
/// Counts of days further back than this, from the newest, are dropped.
const DAILY_KEEP_DAYS: i64 = 7;

/// What one device counted on one day.
#[derive(Debug, Clone, PartialEq, Eq)]
struct DeviceCount {
    /// What the device is called in the lists ("Windows PC", "SM-A515F"); may be empty.
    name: String,
    day: i64,
    played_ms: u64,
    extra_ms: u64,
    reached: bool,
    warned: bool,
}

fn parse_daily_time(raw: &str) -> BTreeMap<String, DeviceCount> {
    let Ok(Value::Object(devices)) = serde_json::from_str::<Value>(raw) else {
        return BTreeMap::new();
    };
    devices
        .iter()
        .filter_map(|(id, value)| {
            let entry = value.as_object()?;
            let day = entry.get("d")?.as_i64()?;
            let number = |key: &str| entry.get(key).and_then(Value::as_u64).unwrap_or(0);
            let flag = |key: &str| entry.get(key).and_then(Value::as_bool).unwrap_or(false);
            Some((
                id.clone(),
                DeviceCount {
                    name: entry
                        .get("n")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    day,
                    played_ms: number("p"),
                    extra_ms: number("x"),
                    reached: flag("r"),
                    warned: flag("w"),
                },
            ))
        })
        .collect()
}

fn encode_daily_time(devices: &BTreeMap<String, DeviceCount>) -> String {
    let newest = devices.values().map(|c| c.day).max().unwrap_or(0);
    let map: serde_json::Map<String, Value> = devices
        .iter()
        .filter(|(_, c)| c.day >= newest - DAILY_KEEP_DAYS)
        .map(|(id, c)| {
            (
                id.clone(),
                json!({ "n": c.name, "d": c.day, "p": c.played_ms, "x": c.extra_ms, "r": c.reached, "w": c.warned }),
            )
        })
        .collect();
    Value::Object(map).to_string()
}

/// One device's count from two copies: the later day wins; on the same day the larger count and either flag.
fn merge_device_count(a: DeviceCount, b: DeviceCount) -> DeviceCount {
    if a.day != b.day {
        return if a.day > b.day { a } else { b };
    }
    DeviceCount {
        name: if a.name.is_empty() { b.name } else { a.name },
        day: a.day,
        played_ms: a.played_ms.max(b.played_ms),
        extra_ms: a.extra_ms.max(b.extra_ms),
        reached: a.reached || b.reached,
        warned: a.warned || b.warned,
    }
}

/// The stored counts of every device with the counts a peer sent merged in. Every device only changes its own
/// entry, so merging never adds time twice. `None` when the merge changes nothing.
#[must_use]
pub fn merge_daily_time(current: Option<&str>, incoming: &[&str]) -> Option<String> {
    let mut devices = current.map(parse_daily_time).unwrap_or_default();
    let before = encode_daily_time(&devices);
    for raw in incoming {
        for (id, count) in parse_daily_time(raw) {
            devices
                .entry(id)
                .and_modify(|own| *own = merge_device_count(own.clone(), count.clone()))
                .or_insert(count);
        }
    }
    let after = encode_daily_time(&devices);
    (after != before).then_some(after)
}

/// The desktop setting holding every device's published watch statistics; its wire name is the same.
pub const WATCH_STATS_KEY: &str = "watch_stats";
/// A device that has not published for this long (ms), counted from the newest publication, is dropped.
const STATS_KEEP_MS: u64 = 45 * 24 * 60 * 60 * 1000;

fn parse_watch_stats(raw: &str) -> BTreeMap<String, Value> {
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::Object(devices)) => devices
            .into_iter()
            .filter(|(_, entry)| entry.get("u").and_then(Value::as_u64).is_some())
            .collect(),
        _ => BTreeMap::new(),
    }
}

fn encode_watch_stats(devices: &BTreeMap<String, Value>) -> String {
    let newest = devices
        .values()
        .filter_map(|entry| entry.get("u").and_then(Value::as_u64))
        .max()
        .unwrap_or(0);
    let map: serde_json::Map<String, Value> = devices
        .iter()
        .filter(|(_, entry)| {
            entry.get("u").and_then(Value::as_u64).unwrap_or(0) + STATS_KEEP_MS >= newest
        })
        .map(|(id, entry)| (id.clone(), entry.clone()))
        .collect();
    Value::Object(map).to_string()
}

/// The stored statistics of every device with the ones a peer sent merged in. A device only ever publishes its
/// own entry, so for each device the newest publication (the larger `u`, in ms) stands. `None` when the merge
/// changes nothing.
#[must_use]
pub fn merge_watch_stats(current: Option<&str>, incoming: &[&str]) -> Option<String> {
    let mut devices = current.map(parse_watch_stats).unwrap_or_default();
    let before = encode_watch_stats(&devices);
    let published = |entry: &Value| entry.get("u").and_then(Value::as_u64).unwrap_or(0);
    for raw in incoming {
        for (id, entry) in parse_watch_stats(raw) {
            let newer = devices
                .get(&id)
                .is_none_or(|known| published(&entry) > published(known));
            if newer {
                devices.insert(id, entry);
            }
        }
    }
    let after = encode_watch_stats(&devices);
    (after != before).then_some(after)
}

const DESKTOP_PREFIX: &str = "desktop.";

/// Every desktop settings key that takes part in sync.
pub fn desktop_keys() -> impl Iterator<Item = &'static str> {
    SHARED
        .iter()
        .map(|s| s.desktop)
        .chain(DESKTOP_ONLY.iter().copied())
        .chain(std::iter::once(SB_ACTIONS_KEY))
}

/// The wire entries for a stored desktop setting, stamped with the time the row last changed: one
/// for most settings, one per category for the SponsorBlock actions.
#[must_use]
pub fn local_entry(
    desktop_key: &str,
    stored: &str,
    updated_at: &str,
    device_id: &str,
) -> Vec<SettingEntry> {
    let hlc = Hlc::new(iso_to_ms(updated_at), 0, device_id);
    let entry = |(key, value): (String, Value)| SettingEntry {
        key,
        value,
        hlc: hlc.clone(),
    };
    if desktop_key == SB_ACTIONS_KEY {
        return sb_actions_to_wire(stored).into_iter().map(entry).collect();
    }
    to_wire(desktop_key, stored)
        .map(entry)
        .into_iter()
        .collect()
}

/// Whether a wire key is one of Android's per-category SponsorBlock actions.
#[must_use]
pub fn is_sb_action(wire_key: &str) -> bool {
    wire_key
        .strip_prefix(SB_ACTION_PREFIX)
        .is_some_and(|category| SB_CATEGORIES.contains(&category))
}

/// The desktop's stored SponsorBlock actions as Android's per-category settings. Categories with
/// no action, or one Android doesn't have, are left out.
fn sb_actions_to_wire(stored: &str) -> Vec<(String, Value)> {
    let Ok(Value::Object(actions)) = serde_json::from_str::<Value>(stored) else {
        return Vec::new();
    };
    SB_CATEGORIES
        .iter()
        .filter_map(|category| {
            let action = actions.get(*category)?.as_str()?;
            let (_, android) = SB_ACTIONS.iter().find(|(desktop, _)| *desktop == action)?;
            Some((
                format!("{SB_ACTION_PREFIX}{category}"),
                Value::String((*android).to_string()),
            ))
        })
        .collect()
}

/// The desktop's SponsorBlock actions setting, with the categories of `incoming` wire entries
/// written over `current`. `None` when no entry names a known category and action.
#[must_use]
pub fn sb_actions_from_wire<'a>(
    current: Option<&str>,
    incoming: impl IntoIterator<Item = &'a SettingEntry>,
) -> Option<(&'static str, String)> {
    let mut actions = match current.map(serde_json::from_str::<Value>) {
        Some(Ok(Value::Object(map))) => map,
        _ => serde_json::Map::new(),
    };
    let mut changed = false;
    for entry in incoming {
        let Some(category) = entry.key.strip_prefix(SB_ACTION_PREFIX) else {
            continue;
        };
        let desktop = entry.value.as_str().and_then(|android| {
            SB_ACTIONS
                .iter()
                .find(|(_, name)| *name == android)
                .map(|(desktop, _)| *desktop)
        });
        if let Some(desktop) = desktop.filter(|_| SB_CATEGORIES.contains(&category)) {
            actions.insert(category.to_string(), Value::String(desktop.to_string()));
            changed = true;
        }
    }
    changed.then(|| (SB_ACTIONS_KEY, Value::Object(actions).to_string()))
}

/// The wire key and typed value for a stored desktop setting. `None` for a key that doesn't sync.
#[must_use]
pub fn to_wire(desktop_key: &str, stored: &str) -> Option<(String, Value)> {
    if let Some(s) = SHARED.iter().find(|s| s.desktop == desktop_key) {
        // Android has no 8K setting and reads a label it doesn't know as Auto.
        let stored = if desktop_key == "default_quality_wifi" && stored == "4320p" {
            "2160p"
        } else {
            stored
        };
        return Some((s.canonical.to_string(), typed(s.kind, stored)));
    }
    DESKTOP_ONLY.contains(&desktop_key).then(|| {
        (
            format!("{DESKTOP_PREFIX}{desktop_key}"),
            Value::String(stored.to_string()),
        )
    })
}

/// Normalize an incoming wire key to the form [`to_wire`] produces, accepting the raw desktop key
/// names older desktop builds sent. `None` for anything this desktop doesn't sync.
#[must_use]
pub fn normalize_wire_key(key: &str) -> Option<String> {
    if is_sb_action(key) {
        return Some(key.to_string());
    }
    if let Some(s) = SHARED
        .iter()
        .find(|s| s.canonical == key || s.desktop == key)
    {
        return Some(s.canonical.to_string());
    }
    let bare = key.strip_prefix(DESKTOP_PREFIX).unwrap_or(key);
    DESKTOP_ONLY
        .contains(&bare)
        .then(|| format!("{DESKTOP_PREFIX}{bare}"))
}

/// The desktop key and stored string for a normalized wire setting.
#[must_use]
pub fn from_wire(wire_key: &str, value: &Value) -> Option<(&'static str, String)> {
    let desktop = if let Some(s) = SHARED.iter().find(|s| s.canonical == wire_key) {
        s.desktop
    } else {
        let bare = wire_key.strip_prefix(DESKTOP_PREFIX)?;
        DESKTOP_ONLY.iter().copied().find(|k| *k == bare)?
    };
    let stored = match value {
        Value::String(s) => s.clone(),
        Value::Null => return None,
        other => other.to_string(),
    };
    Some((desktop, stored))
}

fn typed(kind: Kind, stored: &str) -> Value {
    match kind {
        Kind::Bool => match stored.trim() {
            "true" | "1" => Value::Bool(true),
            "false" | "0" => Value::Bool(false),
            _ => Value::String(stored.to_string()),
        },
        Kind::Number => stored
            .trim()
            .parse::<f64>()
            .ok()
            .and_then(serde_json::Number::from_f64)
            .map_or_else(|| Value::String(stored.to_string()), Value::Number),
        Kind::Whole => stored.trim().parse::<i64>().map_or_else(
            |_| Value::String(stored.to_string()),
            |whole| Value::Number(whole.into()),
        ),
        Kind::Text => Value::String(stored.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_whole_number_setting_travels_without_a_decimal_point() {
        assert_eq!(
            to_wire("home_min_views", "1000000"),
            Some(("home_min_views".to_string(), json!(1_000_000)))
        );
    }

    #[test]
    fn queue_autoplay_uses_androids_name_both_ways() {
        assert_eq!(
            to_wire("queue_autoplay_enabled", "false"),
            Some(("queue_autoplay".to_string(), json!(false)))
        );
        assert_eq!(
            from_wire("queue_autoplay", &json!(false)),
            Some(("queue_autoplay_enabled", "false".to_string()))
        );
    }

    #[test]
    fn every_android_sponsorblock_action_and_category_crosses_both_ways() {
        let stored = serde_json::json!({
            "sponsor": "skip_once",
            "intro": "skip_button",
            "outro": "disabled",
            "hook": "notify",
            "poi_highlight": "skip_button",
        })
        .to_string();
        let wire = sb_actions_to_wire(&stored);
        let sent = |key: &str| wire.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone());
        assert_eq!(
            sent("sponsorblock_action_sponsor"),
            Some(json!("SKIP_ONCE"))
        );
        assert_eq!(
            sent("sponsorblock_action_intro"),
            Some(json!("SKIP_BUTTON"))
        );
        assert_eq!(sent("sponsorblock_action_outro"), Some(json!("DISABLED")));
        assert_eq!(sent("sponsorblock_action_hook"), Some(json!("SHOW_TOAST")));
        assert_eq!(
            sent("sponsorblock_action_poi_highlight"),
            Some(json!("SKIP_BUTTON"))
        );

        assert!(is_sb_action("sponsorblock_action_hook"));
        assert!(is_sb_action("sponsorblock_action_poi_highlight"));
        let hlc = Hlc::new(0, 0, "device");
        let incoming: Vec<SettingEntry> = wire
            .into_iter()
            .map(|(key, value)| SettingEntry {
                key,
                value,
                hlc: hlc.clone(),
            })
            .collect();
        let (key, back) = sb_actions_from_wire(None, &incoming).unwrap();
        assert_eq!(key, SB_ACTIONS_KEY);
        assert_eq!(
            serde_json::from_str::<Value>(&back).unwrap(),
            serde_json::from_str::<Value>(&stored).unwrap()
        );
    }

    #[test]
    fn the_autoplay_delay_stays_among_desktops() {
        let (key, _) = to_wire("autoplay_countdown_seconds", "5").unwrap();
        assert_eq!(key, "desktop.autoplay_countdown_seconds");
    }

    #[test]
    fn counts_of_two_devices_merge_without_adding_time_twice() {
        let phone = r#"{"phone":{"d":10,"p":1800000,"x":0,"r":false,"w":false}}"#;
        let laptop = r#"{"laptop":{"d":10,"p":600000,"x":900000,"r":true,"w":true}}"#;
        let merged = merge_daily_time(Some(phone), &[laptop]).unwrap();
        let parsed = parse_daily_time(&merged);
        assert_eq!(parsed["phone"].played_ms, 1_800_000);
        assert_eq!(parsed["laptop"].played_ms, 600_000);
        assert!(parsed["laptop"].reached && parsed["laptop"].warned);
        // The same counts again change nothing.
        assert_eq!(merge_daily_time(Some(&merged), &[phone, laptop]), None);
    }

    #[test]
    fn a_device_keeps_its_larger_count_and_a_later_day_replaces_an_earlier_one() {
        let ours = r#"{"phone":{"d":10,"p":3000000,"x":0,"r":false,"w":false}}"#;
        let older = r#"{"phone":{"d":10,"p":1000000,"x":0,"r":false,"w":false}}"#;
        assert_eq!(merge_daily_time(Some(ours), &[older]), None);
        let next_day = r#"{"phone":{"d":11,"p":60000,"x":0,"r":false,"w":false}}"#;
        let merged = merge_daily_time(Some(ours), &[next_day]).unwrap();
        let parsed = parse_daily_time(&merged);
        assert_eq!(
            (parsed["phone"].day, parsed["phone"].played_ms),
            (11, 60_000)
        );
    }

    #[test]
    fn an_old_or_damaged_value_is_replaced_by_what_a_peer_sent() {
        let peer = r#"{"phone":{"d":10,"p":5,"x":0,"r":false,"w":false}}"#;
        let legacy = r#"{"day":10,"playedMs":0,"extraMs":0,"warned":false,"reached":false}"#;
        assert!(merge_daily_time(Some(legacy), &[peer]).is_some());
        assert!(merge_daily_time(None, &["not json"]).is_none());
        assert!(merge_daily_time(None, &[peer]).is_some());
    }

    #[test]
    fn the_count_travels_under_its_wire_name() {
        assert_eq!(
            to_wire(DAILY_TALLY_KEY, "{}"),
            Some((DAILY_TIME_WIRE.to_string(), json!("{}")))
        );
        assert_eq!(
            normalize_wire_key(DAILY_TIME_WIRE).as_deref(),
            Some(DAILY_TIME_WIRE)
        );
    }

    #[test]
    fn the_newest_publication_of_each_device_stands() {
        let ours = r#"{"phone":{"u":2000,"n":"Phone"},"laptop":{"u":5000,"n":"Laptop"}}"#;
        let theirs = r#"{"phone":{"u":3000,"n":"Phone2"},"laptop":{"u":4000,"n":"Old"}}"#;
        let merged = merge_watch_stats(Some(ours), &[theirs]).unwrap();
        let parsed = parse_watch_stats(&merged);
        assert_eq!(parsed["phone"]["n"], "Phone2");
        assert_eq!(parsed["laptop"]["n"], "Laptop");
        assert_eq!(merge_watch_stats(Some(&merged), &[ours, theirs]), None);
    }

    #[test]
    fn a_device_not_heard_from_for_weeks_is_dropped_and_damaged_text_is_ignored() {
        let ancient = r#"{"gone":{"u":1000},"here":{"u":9999999999}}"#;
        let merged = merge_watch_stats(None, &[ancient]).unwrap();
        let parsed = parse_watch_stats(&merged);
        assert!(parsed.contains_key("here") && !parsed.contains_key("gone"));
        assert!(merge_watch_stats(None, &["not json", "[]", r#"{"x":{"no":1}}"#]).is_none());
    }

    #[test]
    fn the_statistics_travel_under_their_own_name() {
        assert_eq!(
            to_wire(WATCH_STATS_KEY, "{}"),
            Some((WATCH_STATS_KEY.to_string(), json!("{}")))
        );
        assert_eq!(
            normalize_wire_key("watch_stats").as_deref(),
            Some("watch_stats")
        );
    }
}
