import { getString } from "./i18n/index";
import {
  SPONSORBLOCK_CATEGORIES,
  type SponsorBlockCategory,
} from "../store/useSettingsStore";

export interface SponsorBlockCategoryMeta {
  /** Full label used in settings rows. */
  name: string;
  /** Compact label used in charts and legends. */
  short: string;
  description: string;
}

export const SB_CATEGORY_META: Record<SponsorBlockCategory, SponsorBlockCategoryMeta> = {
  sponsor: {
    get name() { return getString("sponsorblock_category_sponsor"); },
    get short() { return getString("sponsorblock_category_sponsor"); },
    get description() { return getString("sponsorblock_category_sponsor_desc"); },
  },
  intro: {
    get name() { return getString("sponsorblock_category_intro"); },
    get short() { return getString("sponsorblock_category_intro_short"); },
    get description() { return getString("sponsorblock_category_intro_desc"); },
  },
  outro: {
    get name() { return getString("sponsorblock_category_outro"); },
    get short() { return getString("sponsorblock_category_outro_short"); },
    get description() { return getString("sponsorblock_category_outro_desc"); },
  },
  selfpromo: {
    get name() { return getString("sponsorblock_category_selfpromo"); },
    get short() { return getString("sponsorblock_category_selfpromo_short"); },
    get description() { return getString("sponsorblock_category_selfpromo_desc"); },
  },
  interaction: {
    get name() { return getString("sponsorblock_category_interaction"); },
    get short() { return getString("sponsorblock_category_interaction_short"); },
    get description() { return getString("sponsorblock_category_interaction_desc"); },
  },
  music_offtopic: {
    get name() { return getString("sponsorblock_category_music_offtopic"); },
    get short() { return getString("sponsorblock_category_music_offtopic_short"); },
    get description() { return getString("sponsorblock_category_music_offtopic_desc"); },
  },
  filler: {
    get name() { return getString("sponsorblock_category_filler"); },
    get short() { return getString("sponsorblock_category_filler_short"); },
    get description() { return getString("sponsorblock_category_filler_desc"); },
  },
  preview: {
    get name() { return getString("sponsorblock_category_preview"); },
    get short() { return getString("sponsorblock_category_preview_short"); },
    get description() { return getString("sponsorblock_category_preview_desc"); },
  },
  exclusive_access: {
    get name() { return getString("sponsorblock_category_exclusive_access"); },
    get short() { return getString("sponsorblock_category_exclusive_access_short"); },
    get description() { return getString("sponsorblock_category_exclusive_access_desc"); },
  },
  hook: {
    get name() { return getString("sponsorblock_category_hook"); },
    get short() { return getString("sponsorblock_category_hook_short"); },
    get description() { return getString("sponsorblock_category_hook_desc"); },
  },
  poi_highlight: {
    get name() { return getString("sponsorblock_category_highlight"); },
    get short() { return getString("sponsorblock_category_highlight"); },
    get description() { return getString("sponsorblock_category_highlight_desc"); },
  },
};

export function sponsorBlockCategoryLabel(category: string): string {
  return SB_CATEGORY_META[category as SponsorBlockCategory]?.name ?? category;
}

// A highlight is a single point, which the submit dialog cannot make.
export const SB_SUBMIT_CATEGORIES = SPONSORBLOCK_CATEGORIES.filter((category) => category !== "poi_highlight").map((category) => ({
  value: category,
  label: SB_CATEGORY_META[category].name,
}));
