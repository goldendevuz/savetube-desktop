/** The languages Home can be limited to, in the order they are offered (the ones Uzbek speakers read). */
export const HOME_LANGUAGE_CODES = ["uz", "ru", "en", "tr", "ar", "fa", "kk", "tg", "ky", "ko"] as const;

export type HomeLanguageCode = (typeof HOME_LANGUAGE_CODES)[number];

/** The languages in a saved choice: codes joined by commas ("uz,ru,en"). "any", empty and unknown codes give none. */
export function parseHomeLanguages(value: string | undefined | null): HomeLanguageCode[] {
  const chosen = new Set((value ?? "").toLowerCase().split(",").map((code) => code.trim()));
  return HOME_LANGUAGE_CODES.filter((code) => chosen.has(code));
}

/** The saved choice for a list of languages: "any" when there is none. */
export function serializeHomeLanguages(codes: readonly string[]): string {
  const kept = HOME_LANGUAGE_CODES.filter((code) => codes.includes(code));
  return kept.length > 0 ? kept.join(",") : "any";
}

/** The saved choice after the viewer turns one language on or off. */
export function toggleHomeLanguage(value: string | undefined | null, code: string): string {
  const codes: string[] = parseHomeLanguages(value);
  return serializeHomeLanguages(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]);
}
