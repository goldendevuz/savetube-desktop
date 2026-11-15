import type { VideoSummary } from "../types/video";

/*
 * The "Hide entertainment" and "Hide gaming" rules, kept the same as the ones Home's feed uses in Rust
 * (src-tauri/src/services/home_feed/content_rules.rs). Change the lists in both places.
 */

type Titled = Pick<VideoSummary, "title">;

const MEDIA_PHRASES = [
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
const MEDIA_WORDS = new Set([
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
]);
const GAMING_PHRASES = [
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
const GAMING_WORDS = new Set([
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
]);

const normalized = (text: string) => text.toLowerCase().replace(/[\u02bb\u02bc\u2019\u2018`\u00b4]/g, "'");
const words = (title: string) => title.split(/[^\p{L}\p{N}]+/u);

/** Whether a video looks like entertainment: a movie or TV clip, a show, anime; by its title. */
export function looksLikeEntertainment(video: Titled): boolean {
  const title = normalized(video.title ?? "");
  return MEDIA_PHRASES.some((phrase) => title.includes(phrase)) || words(title).some((word) => MEDIA_WORDS.has(word));
}

/** Whether a video looks like a game video, by its title. */
export function looksLikeGaming(video: Titled): boolean {
  const title = normalized(video.title ?? "");
  return GAMING_PHRASES.some((phrase) => title.includes(phrase)) || words(title).some((word) => GAMING_WORDS.has(word));
}
