/** The video length groups Home can be limited to, shortest first. "g1" (up to a minute) is no longer offered. */
export const DURATION_GROUP_KEYS = ["g2", "g3", "g4", "g5", "g6", "g7", "g8"] as const;

/** The groups in a saved choice: keys joined by commas ("g2,g4"). "any", empty and unknown keys give none. */
export function parseDurationGroups(value: string | undefined | null): string[] {
  const chosen = new Set((value ?? "").toLowerCase().split(",").map((key) => key.trim()));
  return DURATION_GROUP_KEYS.filter((key) => chosen.has(key));
}

/** The saved choice for a list of groups: "any" when there is none. */
export function serializeDurationGroups(groups: readonly string[]): string {
  const kept = DURATION_GROUP_KEYS.filter((key) => groups.includes(key));
  return kept.length > 0 ? kept.join(",") : "any";
}

/** The saved choice after the viewer turns one group on or off. */
export function toggleDurationGroup(value: string | undefined | null, key: string): string {
  const groups = parseDurationGroups(value);
  return serializeDurationGroups(groups.includes(key) ? groups.filter((g) => g !== key) : [...groups, key]);
}
