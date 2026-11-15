import type { VideoSummary } from "../types/video";

/*
 * The "Hide music videos" rule, kept the same as the one Home's feed uses in Rust
 * (src-tauri/src/services/home_feed/music_video.rs). Change the lists in both places.
 */

/** Phrases that mark a title as a song or its video, matched anywhere in the lower-case title. */
const TITLE_MARKERS = [
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
  "клип",
  "текст песни",
  "слова песни",
  "песн",
  "музык",
  "ремикс",
  "кавер",
  "караоке",
  "саундтрек",
  "klip",
  "qo'shiq",
  "qo'shig",
  "qoshiq",
  "musiqa",
  "ashula",
  "tarona",
  "konsert",
  "şarkı",
  "müzik",
  "sözleri",
  "♪",
  "♫",
  "🎵",
  "🎶",
];

/** Words that mark a title as a song when they stand alone (so "ost" is not found inside "post"). */
const TITLE_WORDS = new Set([
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
]);

/** Parts of a channel name that only publish music. */
const CHANNEL_MARKERS = ["vevo", "music", "musiqa", "музык", "müzik"];

/** The lower-case form text is matched in: the different apostrophes Uzbek is typed with become "'". */
function normalized(text: string): string {
  return text.toLowerCase().replace(/[\u02bb\u02bc\u2019\u2018`\u00b4]/g, "'");
}

/** Whether a video looks like a music video or a song upload, by its title and channel. */
export function looksLikeMusicVideo(video: Pick<VideoSummary, "title" | "channelName">): boolean {
  const channel = normalized(video.channelName ?? "");
  if (channel.endsWith(" - topic") || CHANNEL_MARKERS.some((marker) => channel.includes(marker))) return true;
  const title = normalized(video.title ?? "");
  if (TITLE_MARKERS.some((marker) => title.includes(marker))) return true;
  return title.split(/[^\p{L}\p{N}]+/u).some((word) => TITLE_WORDS.has(word));
}
