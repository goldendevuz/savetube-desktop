import { useEffect } from "react";

import { useAppSettingsStore } from "../store/useAppSettingsStore";
import { SETTINGS, type SettingKey } from "./settings/schema";

const FLAGS: [SettingKey, string][] = [
  [SETTINGS.HIDE_THUMBNAILS, "hideThumbnails"],
  [SETTINGS.BLUR_THUMBNAILS, "blurThumbnails"],
  [SETTINGS.BLACK_WHITE_MODE, "blackWhite"],
];

/** Puts the picture options on <html> so one stylesheet can act on every thumbnail at once. */
export function useFocusModes() {
  const values = useAppSettingsStore((state) => state.values);
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, name] of FLAGS) {
      if (values[key] === "true") root.dataset[name] = "";
      else delete root.dataset[name];
    }
  }, [values]);
}
