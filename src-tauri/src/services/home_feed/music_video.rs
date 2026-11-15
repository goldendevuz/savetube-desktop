//! A best guess at which videos are music videos, for the "Hide music videos" setting. YouTube's
//! own category is not on the cards Home reads, so this goes by what the title and channel say:
//! it catches the usual labels ("Official Video", "Lyrics", VEVO, "- Topic") and misses a song
//! whose title says nothing of the kind.

use crate::models::video::VideoSummary;

/// Phrases that mark a title as a song or its video, matched anywhere in the lower-case title (with the
/// apostrophes of "qo'shiq" written as `'`). The same list is used on every device and for every viewer who
/// turns on "Hide music videos": it is the rule, not a personal blocklist.
const TITLE_MARKERS: &[&str] = &[
    // English labels
    "official music video",
    "official video",
    "official audio",
    "official lyric",
    "official mv",
    "official clip",
    "lyric video",
    "lyrics",
    "music video",
    "mood video",
    "visualizer",
    "full album",
    "karaoke",
    "nightcore",
    "mashup",
    "medley",
    "nasheed",
    "nashid",
    "anasheed",
    "нашид",
    "lofi",
    "lo-fi",
    "(audio)",
    "[audio]",
    "(mv)",
    "[mv]",
    " m/v",
    "(feat.",
    "[feat.",
    "(ft.",
    "[ft.",
    " feat. ",
    " ft. ",
    // Russian: "клип", "текст песни", "слова песни", and the stems of "песня", "музыка", "ремикс", "кавер",
    // "караоке", "саундтрек"
    "клип",
    "текст песни",
    "слова песни",
    "песн",
    "музык",
    "ремикс",
    "кавер",
    "караоке",
    "саундтрек",
    // Uzbek: "klip", "qo'shiq", "musiqa", "ashula", "tarona" (taronalar), "konsert"
    "klip",
    "qo'shiq",
    "qo'shig",
    "qoshiq",
    "musiqa",
    "ashula",
    "tarona",
    "konsert",
    "consert",
    // Turkish: "şarkı", "müzik", "sözleri"
    "şarkı",
    "müzik",
    "sözleri",
    // Symbols songs carry in their titles
    "♪",
    "♫",
    "🎵",
    "🎶",
];

/// Words that mark a title as a song when they stand alone (so "ost" is not found inside "post").
const TITLE_WORDS: &[&str] = &[
    "song",
    "songs",
    "lyric",
    "remix",
    "acoustic",
    "instrumental",
    "soundtrack",
    "ost",
    "album",
    "concert",
    "slowed",
    "mp3",
];

/// Parts of a channel name that only publish music.
const CHANNEL_MARKERS: &[&str] = &["vevo", "music", "musiqa", "музык", "müzik"];

/// The lower-case form titles are matched in: the different apostrophes Uzbek is typed with become `'`.
pub(super) fn normalized(text: &str) -> String {
    text.to_lowercase()
        .replace(['ʻ', 'ʼ', '’', '‘', '`', '´'], "'")
}

/// Channel names that only publish music.
fn music_channel(channel: &str) -> bool {
    channel.ends_with(" - topic")
        || CHANNEL_MARKERS
            .iter()
            .any(|marker| channel.contains(marker))
}

/// Whether `video` looks like a music video or a song upload.
#[must_use]
pub fn looks_like_music_video(video: &VideoSummary) -> bool {
    let channel = normalized(&video.channel_name);
    if music_channel(&channel) {
        return true;
    }
    let title = normalized(&video.title);
    if TITLE_MARKERS.iter().any(|marker| title.contains(marker)) {
        return true;
    }
    title
        .split(|c: char| !c.is_alphanumeric())
        .any(|word| TITLE_WORDS.contains(&word))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn video(title: &str, channel: &str) -> VideoSummary {
        VideoSummary {
            id: "id".into(),
            title: title.into(),
            channel_name: channel.into(),
            ..Default::default()
        }
    }

    #[test]
    fn catches_the_usual_labels() {
        assert!(looks_like_music_video(&video(
            "Anvar - Jonim jonimey (Official Music Video)",
            "NevoMusic"
        )));
        assert!(looks_like_music_video(&video(
            "Autumn - NIKI (Lyrics)",
            "Kioumiusic"
        )));
        assert!(looks_like_music_video(&video(
            "Here In Your Dreams (ft. Liam Pearce) |",
            "BlushCrunch"
        )));
        assert!(looks_like_music_video(&video(
            "Asror Uz - Ko'rolmaysiz | Mood Video",
            "ASROR_UZ_"
        )));
        assert!(looks_like_music_video(&video("Kechqurun klip", "Jon")));
        assert!(looks_like_music_video(&video("Anything", "ArtistVEVO")));
        assert!(looks_like_music_video(&video(
            "Anything",
            "Some Artist - Topic"
        )));
    }

    #[test]
    fn leaves_other_videos_alone() {
        assert!(!looks_like_music_video(&video(
            "Did Gravity Ever Change? Science Finally...",
            "Anton Petrov"
        )));
        assert!(!looks_like_music_video(&video(
            "What is REST API (http)? Soap? GraphQL...",
            "Ulbi TV"
        )));
        assert!(!looks_like_music_video(&video(
            "Fireplace and rain sounds for sleep",
            "Cozy"
        )));
    }
    #[test]
    fn catches_songs_in_russian_uzbek_and_turkish() {
        assert!(looks_like_music_video(&video(
            "Дима Билан - Новая песня",
            "Дима"
        )));
        assert!(looks_like_music_video(&video(
            "Любовь | текст песни",
            "Канал"
        )));
        assert!(looks_like_music_video(&video(
            "Новый альбом и ремикс",
            "Канал"
        )));
        assert!(looks_like_music_video(&video("Yangi qo'shiq 2026", "Jon")));
        assert!(looks_like_music_video(&video("Yangi qoʻshiq", "Jon")));
        assert!(looks_like_music_video(&video("Eng yaxshi musiqa", "Jon")));
        assert!(looks_like_music_video(&video("Ashula tinglang", "Jon")));
        assert!(looks_like_music_video(&video(
            "Eng sara taronalar (2026)",
            "Jon"
        )));
        assert!(looks_like_music_video(&video(
            "Yeni şarkı sözleri",
            "Kanal"
        )));
        assert!(looks_like_music_video(&video("Rock müzik", "Kanal")));
    }

    #[test]
    fn catches_song_words_and_symbols() {
        assert!(looks_like_music_video(&video("Best song ever", "Jon")));
        assert!(looks_like_music_video(&video(
            "Anime OST compilation",
            "Jon"
        )));
        assert!(looks_like_music_video(&video(
            "Bohemian slowed edit",
            "Jon"
        )));
        assert!(looks_like_music_video(&video("Night drive 🎶", "Jon")));
        assert!(looks_like_music_video(&video(
            "Wedding Nasheed - Al Muqit",
            "Laa"
        )));
        assert!(looks_like_music_video(&video(
            "Arabic Nasheed Medley",
            "Jon"
        )));
        assert!(looks_like_music_video(&video("Anything", "Sony Music")));
        assert!(looks_like_music_video(&video("Anything", "Nevo Musiqa")));
    }

    #[test]
    fn a_word_is_not_found_inside_another_word() {
        assert!(!looks_like_music_video(&video(
            "My first post about Rust",
            "Dev"
        )));
        assert!(!looks_like_music_video(&video(
            "Songbird migration in spring",
            "Nature"
        )));
    }
}
