//! Which candidates Home may show, and placing late arrivals below what the viewer sees, from Flow
//! for Android's `HomeFeedFilters`.

use std::collections::HashSet;

use super::card::{Card, age_of};

pub const FRESH_SUB_WINDOW_MS: u64 = 72 * 3_600_000;
const HOME_MAX_SUGGESTION_AGE_MS: u64 = 365 * 86_400_000;
const STORED_SUBS_WINDOW_MS: u64 = 14 * 86_400_000;
const STORED_SUBS_MAX: usize = 60;
/// No channel twice within this many cards, across pages and late arrivals.
pub const RECENT_CHANNEL_WINDOW: usize = 20;

/// Cards that are videos of known length, not watched, recent enough and not hidden.
pub fn keep_showable<'a>(
    cards: impl IntoIterator<Item = Card> + 'a,
    watched: &'a HashSet<String>,
    hidden: &'a dyn Fn(&Card) -> bool,
    now_ms: u64,
    recent_only: bool,
) -> impl Iterator<Item = Card> + 'a {
    cards.into_iter().filter(move |card| {
        card.is_valid()
            && !watched.contains(card.id())
            && (!recent_only || is_recent_suggestion(card, now_ms))
            && !hidden(card)
    })
}

/// The subscription store's uploads Home can show: videos of known length from the last two weeks,
/// newest first.
#[must_use]
pub fn stored_subscription_videos(store: &[Card], now_ms: u64) -> Vec<Card> {
    let mut videos: Vec<Card> = store
        .iter()
        .filter(|card| card.is_valid())
        .filter(|card| {
            card.age_ms(now_ms)
                .is_some_and(|age| age <= STORED_SUBS_WINDOW_MS)
        })
        .cloned()
        .collect();
    videos.sort_by_key(|card| std::cmp::Reverse(card.published_at_ms));
    videos.truncate(STORED_SUBS_MAX);
    videos
}

/// Fresh-sub slots for a viewer following `sub_count` channels.
#[must_use]
pub fn dynamic_fresh_sub_slots(sub_count: usize) -> usize {
    match sub_count {
        n if n >= 120 => 5,
        n if n >= 40 => 4,
        n if n >= 5 => 3,
        _ => 2,
    }
}

/// Published in the last three days, by its time or by its text.
#[must_use]
pub fn is_fresh_subscribed(card: &Card, now_ms: u64) -> bool {
    if card
        .age_ms(now_ms)
        .is_some_and(|age| age <= FRESH_SUB_WINDOW_MS)
    {
        return true;
    }
    age_of(&card.upload_text()).is_some_and(|age| age <= FRESH_SUB_WINDOW_MS)
}

/// Not older than a year; a card that names no age only counts when it is live.
#[must_use]
pub fn is_recent_suggestion(card: &Card, now_ms: u64) -> bool {
    is_within(card, now_ms, HOME_MAX_SUGGESTION_AGE_MS)
}

/// Published at most `max_age_ms` ago, by its exact time when known, else by its text; a card that
/// names no age only counts when it is live.
#[must_use]
pub fn is_within(card: &Card, now_ms: u64, max_age_ms: u64) -> bool {
    let text = card.upload_text();
    if text.trim().is_empty() || text == "unknown" {
        return card.video.is_live;
    }
    card.age_ms(now_ms)
        .or_else(|| age_of(&text))
        .is_some_and(|age| age <= max_age_ms)
}

/// `feed` with `late` cards placed below `last_visible`, one after every `spacing` cards already
/// there, never within `channel_window` cards of their own channel nor, when `is_grouped` holds,
/// next to another grouped card. A card with no such place is left out.
#[must_use]
pub fn insert_below_viewport(
    feed: &[Card],
    late: &[Card],
    last_visible: usize,
    spacing: usize,
    channel_window: usize,
    is_grouped: &dyn Fn(&Card) -> bool,
) -> Vec<Card> {
    let on_screen: HashSet<&str> = feed.iter().map(Card::id).collect();
    let mut seen: HashSet<&str> = HashSet::new();
    let mut pending: Vec<&Card> = late
        .iter()
        .filter(|card| !on_screen.contains(card.id()) && seen.insert(card.id()))
        .collect();
    if pending.is_empty() {
        return feed.to_vec();
    }
    let split = (last_visible + 1).min(feed.len());
    let below = &feed[split..];
    let mut merged: Vec<Card> = feed[..split].to_vec();
    let nearby = |merged: &[Card], card: &Card, next: usize| {
        let channel = card.channel_id();
        let channel_near = !channel.is_empty()
            && (merged
                .iter()
                .rev()
                .take(channel_window)
                .any(|c| c.channel_id() == channel)
                || below[next..(next + channel_window).min(below.len())]
                    .iter()
                    .any(|c| c.channel_id() == channel));
        let grouped_near = is_grouped(card)
            && (merged.last().is_some_and(is_grouped) || below.get(next).is_some_and(is_grouped));
        channel_near || grouped_near
    };
    let place_one = |merged: &mut Vec<Card>, pending: &mut Vec<&Card>, next: usize| {
        if let Some(index) = pending.iter().position(|card| !nearby(merged, card, next)) {
            merged.push(pending.remove(index).clone());
        }
    };
    for (index, card) in below.iter().enumerate() {
        merged.push(card.clone());
        if (index + 1) % spacing == 0 {
            place_one(&mut merged, &mut pending, index + 1);
        }
    }
    while pending
        .iter()
        .any(|card| !nearby(&merged, card, below.len()))
    {
        place_one(&mut merged, &mut pending, below.len());
    }
    merged
}

#[cfg(test)]
pub(super) mod tests {
    use super::*;
    use crate::models::video::VideoSummary;

    pub fn card(id: &str, channel: &str, published_text: &str) -> Card {
        Card {
            video: VideoSummary {
                id: id.into(),
                title: format!("Video {id}"),
                channel_name: format!("Channel {channel}"),
                channel_id: Some(channel.into()),
                thumbnail_url: None,
                duration_seconds: Some(600),
                published_text: Some(published_text.into()),
                view_count_text: None,
                channel_avatar_url: None,
                is_live: false,
                ..Default::default()
            },
            published_at_ms: 0,
        }
    }

    #[test]
    fn late_cards_go_below_the_viewport_away_from_their_channel() {
        let feed: Vec<Card> = (0..8)
            .map(|i| card(&format!("f{i}"), &format!("c{i}"), "1 day ago"))
            .collect();
        let late = vec![
            card("l1", "c3", "1 day ago"),
            card("l2", "new", "1 day ago"),
        ];
        let merged = insert_below_viewport(&feed, &late, 1, 2, 3, &|_| false);
        let ids: Vec<&str> = merged.iter().map(Card::id).collect();
        assert_eq!(&ids[..2], ["f0", "f1"]);
        assert!(ids.contains(&"l2"));
        let l1 = ids.iter().position(|id| *id == "l1");
        if let Some(at) = l1 {
            let f3 = ids.iter().position(|id| *id == "f3").unwrap();
            assert!(at.abs_diff(f3) > 3, "{ids:?}");
        }
    }

    #[test]
    fn a_year_old_upload_is_not_suggested() {
        assert!(is_recent_suggestion(&card("a", "c", "11 months ago"), 0));
        assert!(!is_recent_suggestion(&card("a", "c", "2 years ago"), 0));
        assert!(!is_recent_suggestion(&card("a", "c", ""), 0));
    }

    #[test]
    fn an_exact_time_wins_over_the_rounded_text() {
        let day = 86_400_000;
        let mut upload = card("a", "c", "1 day ago");
        assert!(is_within(&upload, 0, day));
        upload.published_at_ms = 1;
        assert!(!is_within(&upload, 1 + 47 * 3_600_000, day));
        assert!(is_within(&upload, 1 + 23 * 3_600_000, day));
    }
}

/// A video length range in seconds: from (included) to (excluded, `None` for no upper limit).
pub type DurationRange = (u64, Option<u64>);

/// The eight video length groups of the SaveTube CRM's G1–G8 filter: key, from, to.
const DURATION_GROUPS: [(&str, u64, Option<u64>); 8] = [
    ("g1", 1, Some(60)),
    ("g2", 60, Some(300)),
    ("g3", 300, Some(600)),
    ("g4", 600, Some(1_200)),
    ("g5", 1_200, Some(2_400)),
    ("g6", 2_400, Some(3_600)),
    ("g7", 3_600, Some(7_200)),
    ("g8", 7_200, None),
];

/// The length range of a group key ("g1" to "g8"); `None` for "any" or anything unknown.
#[must_use]
pub fn duration_range(key: &str) -> Option<DurationRange> {
    let key = key.trim().to_ascii_lowercase();
    DURATION_GROUPS
        .iter()
        .find(|(group, _, _)| *group == key)
        .map(|&(_, from, to)| (from, to))
}

/// The length ranges of a saved choice: group keys joined by commas ("g2,g4,g5"), or "any". Unknown keys
/// are skipped; `None` when no key is a group.
#[must_use]
pub fn duration_ranges(setting: &str) -> Option<Vec<DurationRange>> {
    let ranges: Vec<DurationRange> = setting.split(',').filter_map(duration_range).collect();
    (!ranges.is_empty()).then_some(ranges)
}

/// A video whose length is outside every group the viewer chose.
#[must_use]
pub fn is_outside_duration_ranges(
    video: &crate::models::video::VideoSummary,
    ranges: &[DurationRange],
) -> bool {
    !ranges.is_empty()
        && ranges
            .iter()
            .all(|range| is_outside_duration_range(video, *range))
}

/// A video whose length is outside the group the viewer chose. Live streams, upcoming videos and
/// videos with no readable length are never ruled out: they have no length, or it is not known.
#[must_use]
pub fn is_outside_duration_range(
    video: &crate::models::video::VideoSummary,
    (from, to): DurationRange,
) -> bool {
    if video.is_live || video.is_upcoming {
        return false;
    }
    video
        .duration_seconds
        .filter(|seconds| *seconds > 0)
        .is_some_and(|seconds| seconds < from || to.is_some_and(|to| seconds >= to))
}

#[cfg(test)]
mod duration_range_tests {
    use super::{duration_range, is_outside_duration_range};
    use crate::models::video::VideoSummary;

    fn video(seconds: Option<u64>) -> VideoSummary {
        VideoSummary {
            duration_seconds: seconds,
            ..Default::default()
        }
    }

    #[test]
    fn groups_match_the_crm_boundaries() {
        let outside = |key: &str, seconds: u64| {
            is_outside_duration_range(&video(Some(seconds)), duration_range(key).unwrap())
        };
        assert!(!outside("g1", 1) && !outside("g1", 59) && outside("g1", 60));
        assert!(
            outside("g2", 59) && !outside("g2", 60) && !outside("g2", 299) && outside("g2", 300)
        );
        assert!(!outside("g3", 599) && outside("g3", 600));
        assert!(!outside("g4", 1_199) && outside("g4", 1_200));
        assert!(!outside("g5", 2_399) && outside("g5", 2_400));
        assert!(!outside("g6", 3_599) && outside("g6", 3_600));
        assert!(!outside("g7", 7_199) && outside("g7", 7_200));
        assert!(outside("g8", 7_199) && !outside("g8", 7_200) && !outside("g8", 36_000));
    }

    #[test]
    fn several_groups_keep_a_video_that_fits_any_of_them() {
        let ranges = super::duration_ranges("g2,g4").unwrap();
        let outside = |seconds| super::is_outside_duration_ranges(&video(Some(seconds)), &ranges);
        assert!(!outside(120) && !outside(900));
        assert!(outside(400) && outside(5_000));
        assert!(!super::is_outside_duration_ranges(&video(Some(400)), &[]));
    }

    #[test]
    fn a_saved_list_skips_unknown_keys_and_any() {
        assert!(super::duration_ranges("any").is_none());
        assert!(super::duration_ranges("").is_none());
        assert_eq!(super::duration_ranges("g3").unwrap().len(), 1);
        assert_eq!(super::duration_ranges("g3, g9 ,G5").unwrap().len(), 2);
    }

    #[test]
    fn any_and_unknown_keys_are_not_a_group() {
        assert!(duration_range("any").is_none());
        assert!(duration_range("").is_none());
        assert!(duration_range("g9").is_none());
        assert!(duration_range(" G3 ").is_some());
    }

    #[test]
    fn keeps_videos_with_no_known_length_and_live_ones() {
        let range = duration_range("g4").unwrap();
        assert!(!is_outside_duration_range(&video(None), range));
        assert!(!is_outside_duration_range(&video(Some(0)), range));
        let mut live = video(Some(30));
        live.is_live = true;
        assert!(!is_outside_duration_range(&live, range));
        let mut upcoming = video(Some(30));
        upcoming.is_upcoming = true;
        assert!(!is_outside_duration_range(&upcoming, range));
    }
}

/// A video the viewer's minimum view count rules out. Live streams and videos with no readable
/// count are never ruled out: their numbers are not views, or are not known.
#[must_use]
pub fn is_below_min_views(video: &crate::models::video::VideoSummary, min_views: u64) -> bool {
    !video.is_live && !video.is_upcoming && video.view_count.is_some_and(|views| views < min_views)
}

#[cfg(test)]
mod min_views_tests {
    use super::is_below_min_views;
    use crate::models::video::VideoSummary;

    fn video(views: Option<u64>) -> VideoSummary {
        VideoSummary {
            view_count: views,
            ..Default::default()
        }
    }

    #[test]
    fn rules_out_videos_under_the_minimum() {
        assert!(is_below_min_views(&video(Some(999)), 1000));
        assert!(!is_below_min_views(&video(Some(1000)), 1000));
        assert!(!is_below_min_views(&video(Some(5_000_000)), 1000));
    }

    #[test]
    fn keeps_videos_whose_count_is_unknown() {
        assert!(!is_below_min_views(&video(None), 1000));
    }

    #[test]
    fn keeps_live_and_upcoming_videos() {
        let mut live = video(Some(12));
        live.is_live = true;
        assert!(!is_below_min_views(&live, 1000));
        let mut upcoming = video(Some(0));
        upcoming.is_upcoming = true;
        assert!(!is_below_min_views(&upcoming, 1000));
    }
}
