//! More rules the viewer can set for Home, the same on every device: keeping entertainment (movie and TV
//! clips, shows, anime) off the page, keeping games off it, and keeping only the languages the viewer reads. Both go by what a title says (the card
//! carries neither a category nor a language), so they are guesses: a video the guess cannot place is
//! never ruled out.

use super::music_video::normalized;
use crate::models::video::VideoSummary;

/// The languages the viewer can pick, in the order they are offered (the ones Uzbek speakers read).
pub const LANGUAGES: [&str; 10] = ["uz", "ru", "en", "tr", "ar", "fa", "kk", "tg", "ky", "ko"];

/// Phrases that mark a title as a movie or TV clip, matched anywhere in the lower-case title.
const MEDIA_PHRASES: &[&str] = &[
    "movie clip",
    "movieclips",
    "film clip",
    "movie scene",
    "film scene",
    "fight scene",
    "full movie",
    "full film",
    "official trailer",
    "movie trailer",
    "teaser trailer",
    "blu-ray",
    "bluray",
    "tv series",
    "web series",
    "star wars",
    "stand-up",
    "fan theories",
    "fan theory",
    "behind the scenes",
    "award show",
    "movie review",
    "film analysis",
    "из фильма",
    "отрывок из",
    "tarjima kino",
];

/// Words that mark a title as a movie or TV clip when they stand alone.
const MEDIA_WORDS: &[&str] = &[
    "clip",
    "clips",
    "movie",
    "movies",
    "film",
    "films",
    "trailer",
    "teaser",
    "kino",
    "serial",
    "treyler",
    "multfilm",
    "fragman",
    "фильм",
    "фильмы",
    "кино",
    "трейлер",
    "сериал",
    "сцена",
    "мультфильм",
    "فيلم",
    "مسلسل",
    "netflix",
    "anime",
    "marvel",
    "disney",
    "sitcom",
    "standup",
    "comedy",
    "drama",
    "horror",
    "sci-fi",
    "oscars",
    "аниме",
    "дорама",
];

/// Phrases that mark a title as a game video, matched anywhere in the lower-case title.
const GAMING_PHRASES: &[&str] = &[
    "let's play",
    "lets play",
    "call of duty",
    "league of legends",
    "apex legends",
    "game review",
    "retro gaming",
    "pc gaming",
    "mobile game",
    "indie game",
    "прохождение",
    "геймплей",
    "майнкрафт",
    "o'yin",
];

/// Words that mark a title as a game video when they stand alone.
const GAMING_WORDS: &[&str] = &[
    "gameplay",
    "gaming",
    "gamer",
    "gamers",
    "walkthrough",
    "speedrun",
    "speedruns",
    "esports",
    "minecraft",
    "fortnite",
    "gta",
    "valorant",
    "pokemon",
    "pokémon",
    "nintendo",
    "playstation",
    "ps4",
    "ps5",
    "xbox",
    "roblox",
    "fifa",
    "warzone",
    "cs2",
    "csgo",
    "dota",
    "pubg",
    "игра",
    "игры",
    "стрим",
];

/// Whether `video` looks like a game video, by its title.
#[must_use]
pub fn looks_like_gaming(video: &VideoSummary) -> bool {
    let title = normalized(&video.title);
    GAMING_PHRASES.iter().any(|phrase| title.contains(phrase))
        || title
            .split(|c: char| !c.is_alphanumeric())
            .any(|word| GAMING_WORDS.contains(&word))
}

/// Whether `video` looks like entertainment: a clip from a movie or TV show, a show, anime; by its title.
#[must_use]
pub fn looks_like_media_clip(video: &VideoSummary) -> bool {
    let title = normalized(&video.title);
    MEDIA_PHRASES.iter().any(|phrase| title.contains(phrase))
        || title
            .split(|c: char| !c.is_alphanumeric())
            .any(|word| MEDIA_WORDS.contains(&word))
}

const EN_WORDS: &[&str] = &[
    "the", "and", "of", "to", "in", "for", "with", "how", "you", "your", "is", "are", "this",
    "that", "what", "why", "best", "new", "vs", "top", "from", "about", "my", "we", "it", "on",
    "at", "by",
];
const UZ_WORDS: &[&str] = &[
    "va", "bilan", "uchun", "qanday", "yangi", "eng", "haqida", "nima", "kerak", "uzbek", "dars",
    "darslik", "sara", "kuni", "bugun", "yaxshi", "qilish", "uzbekcha", "tilida",
];
const TR_WORDS: &[&str] = &["ve", "bir", "için", "nasıl", "ile", "çok", "daha"];

/// The language a title is written in, one of [`LANGUAGES`], or `None` when it cannot be told (no letters,
/// two scripts mixed, or a Latin title with no telling word).
#[must_use]
pub fn guess_language(text: &str) -> Option<&'static str> {
    let text = normalized(text);
    let (mut cyrillic, mut arabic, mut hangul, mut latin) = (0_u32, 0_u32, 0_u32, 0_u32);
    for c in text.chars().filter(|c| c.is_alphabetic()) {
        match c {
            '\u{0400}'..='\u{04FF}' => cyrillic += 1,
            '\u{0600}'..='\u{06FF}' | '\u{0750}'..='\u{077F}' => arabic += 1,
            '\u{AC00}'..='\u{D7AF}' | '\u{1100}'..='\u{11FF}' => hangul += 1,
            c if c.is_ascii_alphabetic() || ('\u{00C0}'..='\u{024F}').contains(&c) => latin += 1,
            _ => {}
        }
    }
    let total = cyrillic + arabic + hangul + latin;
    let dominant = |count: u32| total > 0 && count * 10 >= total * 6;
    if dominant(hangul) {
        Some("ko")
    } else if dominant(arabic) {
        Some(if text.contains(['پ', 'چ', 'ژ', 'گ', 'ک', 'ی']) {
            "fa"
        } else {
            "ar"
        })
    } else if dominant(cyrillic) {
        Some(cyrillic_language(&text))
    } else if dominant(latin) {
        latin_language(&text)
    } else {
        None
    }
}

/// Which Cyrillic language, going by the letters only that language uses; Russian when none is telling.
fn cyrillic_language(text: &str) -> &'static str {
    if text.contains('ў') {
        "uz"
    } else if text.contains(['ӣ', 'ӯ', 'ҷ']) {
        "tg"
    } else if text.contains(['ә', 'ұ', 'һ', 'і']) {
        "kk"
    } else if text.contains(['ү', 'ө', 'ң']) {
        "ky"
    } else if text.contains(['қ', 'ғ', 'ҳ']) {
        "uz"
    } else {
        "ru"
    }
}

/// Uzbek, Turkish or English, by telling letters and words; `None` when none stands out or two tie.
fn latin_language(text: &str) -> Option<&'static str> {
    let words: Vec<&str> = text
        .split(|c: char| !c.is_alphanumeric() && c != '\'')
        .map(|word| word.trim_matches('\''))
        .filter(|word| !word.is_empty())
        .collect();
    let count = |list: &[&str]| words.iter().filter(|word| list.contains(word)).count();
    let uz_marks = words
        .iter()
        .filter(|word| (word.contains("o'") || word.contains("g'")) && **word != "o'clock")
        .count();
    let tr_marks = if text.contains(['ğ', 'ı', 'ş']) {
        2
    } else {
        0
    };
    let scores = [
        ("uz", count(UZ_WORDS) + uz_marks),
        ("tr", count(TR_WORDS) + tr_marks),
        ("en", count(EN_WORDS)),
    ];
    let best = scores.iter().map(|(_, score)| *score).max()?;
    let mut leaders = scores.iter().filter(|(_, score)| *score == best);
    match (leaders.next(), leaders.next()) {
        (Some((language, _)), None) if best > 0 => Some(language),
        _ => None,
    }
}

/// The languages in a saved choice: codes joined by commas ("uz,ru,en"), in the order they are offered.
/// "any", empty and unknown codes give none.
#[must_use]
pub fn parse_languages(setting: &str) -> Vec<String> {
    let chosen: Vec<String> = setting
        .split(',')
        .map(|code| code.trim().to_lowercase())
        .collect();
    LANGUAGES
        .iter()
        .filter(|code| chosen.iter().any(|picked| picked == *code))
        .map(|code| (*code).to_owned())
        .collect()
}

/// The rules the viewer set, read once per Home load.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ContentRules {
    /// Entertainment (movie and TV clips, shows, anime) is kept off Home.
    pub hide_media_clips: bool,
    /// Game videos are kept off Home.
    pub hide_gaming: bool,
    /// The only languages Home shows; empty for every language.
    pub languages: Vec<String>,
}

impl ContentRules {
    /// Whether a rule rules `video` out.
    #[must_use]
    pub fn hides(&self, video: &VideoSummary) -> bool {
        (self.hide_media_clips && looks_like_media_clip(video))
            || (self.hide_gaming && looks_like_gaming(video))
            || (!self.languages.is_empty()
                && guess_language(&video.title)
                    .is_some_and(|language| !self.languages.iter().any(|code| code == language)))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ContentRules, guess_language, looks_like_gaming, looks_like_media_clip, parse_languages,
    };
    use crate::models::video::VideoSummary;

    fn video(title: &str) -> VideoSummary {
        VideoSummary {
            title: title.to_owned(),
            ..Default::default()
        }
    }

    #[test]
    fn catches_movie_and_tv_clips() {
        assert!(looks_like_media_clip(&video(
            "Hulk Vs Surtur Demon (4K Blu-ray) Fight Scenes | Marvel Movie Clips"
        )));
        assert!(looks_like_media_clip(&video("Official Trailer 2026")));
        assert!(looks_like_media_clip(&video("Лучшие моменты из фильма")));
        assert!(looks_like_media_clip(&video("Yangi kino tarjima")));
        assert!(looks_like_media_clip(&video("Yeni fragman")));
    }

    #[test]
    fn leaves_other_videos_alone() {
        assert!(!looks_like_media_clip(&video(
            "5 Cybersecurity Certificates You Need"
        )));
        assert!(!looks_like_media_clip(&video("Rust ownership explained")));
        assert!(!looks_like_media_clip(&video("A paperclipped note")));
    }

    #[test]
    fn tells_the_languages_apart() {
        assert_eq!(
            guess_language("Your Life as Every Rank in Cyber"),
            Some("en")
        );
        assert_eq!(guess_language("Eng sara taronalar (2026)"), Some("uz"));
        assert_eq!(guess_language("O'zbek tilida dars"), Some("uz"));
        assert_eq!(
            guess_language("Nasıl yapılır? Çok kolay ve hızlı"),
            Some("tr")
        );
        assert_eq!(guess_language("Лучшие песни 2026"), Some("ru"));
        assert_eq!(guess_language("Ўзбек тилида дарс"), Some("uz"));
        assert_eq!(guess_language("Қазақ тілінде сабақ"), Some("kk"));
        assert_eq!(guess_language("Тоҷикӣ суруд"), Some("tg"));
        assert_eq!(guess_language("أفضل الأناشيد"), Some("ar"));
        assert_eq!(guess_language("بهترین آهنگ‌ها گچ"), Some("fa"));
        assert_eq!(guess_language("최고의 노래"), Some("ko"));
    }

    #[test]
    fn a_title_that_cannot_be_placed_is_unknown() {
        assert_eq!(guess_language("2026"), None);
        assert_eq!(guess_language("Hulk Surtur Demon"), None);
        assert_eq!(guess_language("Привet world mixed"), None);
    }

    #[test]
    fn a_saved_list_keeps_known_codes_in_order() {
        assert!(parse_languages("any").is_empty());
        assert!(parse_languages("").is_empty());
        assert_eq!(parse_languages("en, uz,xx,UZ"), vec!["uz", "en"]);
    }

    #[test]
    fn only_the_chosen_languages_stay() {
        let rules = ContentRules {
            hide_media_clips: false,
            hide_gaming: false,
            languages: parse_languages("uz,en"),
        };
        assert!(!rules.hides(&video("Best of the year")));
        assert!(!rules.hides(&video("Yangi dars bilan")));
        assert!(rules.hides(&video("Лучшие песни 2026")));
        assert!(!rules.hides(&video("2026")));
        assert!(!ContentRules::default().hides(&video("Лучшие песни 2026")));
    }

    #[test]
    fn media_clips_are_ruled_out_only_when_on() {
        let on = ContentRules {
            hide_media_clips: true,
            hide_gaming: false,
            languages: vec![],
        };
        assert!(on.hides(&video("Marvel Movie Clips")));
        assert!(!ContentRules::default().hides(&video("Marvel Movie Clips")));
    }

    #[test]
    fn catches_games_and_entertainment_topics() {
        assert!(looks_like_gaming(&video("Minecraft survival gameplay #12")));
        assert!(looks_like_gaming(&video("Прохождение Call of Duty")));
        assert!(looks_like_gaming(&video("Yangi o'yin sharhi")));
        assert!(!looks_like_gaming(&video("Rust ownership explained")));
        assert!(!looks_like_gaming(&video("Game theory in economics")));
        assert!(looks_like_media_clip(&video("Best anime of 2026")));
        assert!(looks_like_media_clip(&video("Stand-up comedy special")));
        assert!(looks_like_media_clip(&video("Marvel fan theories")));
    }

    #[test]
    fn the_gaming_rule_is_on_only_when_set() {
        let rules = ContentRules {
            hide_gaming: true,
            ..Default::default()
        };
        assert!(rules.hides(&video("Fortnite highlights")));
        assert!(!ContentRules::default().hides(&video("Fortnite highlights")));
    }
}
