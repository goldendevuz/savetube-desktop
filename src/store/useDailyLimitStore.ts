import { create } from "zustand";

import type { DailyTally } from "../lib/wellbeing/dailyLimit";

interface DailyLimitState {
  /** Today's running count, once the first tick has read or started it. */
  tally: DailyTally | null;
  /** Whether the "Time's up" dialog is showing. */
  dialogOpen: boolean;
  /** When "Keep watching" becomes available, in `Date.now()` time. */
  keepWatchingAt: number;
  setTally: (tally: DailyTally) => void;
  openDialog: (keepWatchingAt: number) => void;
  closeDialog: () => void;
}

export const useDailyLimitStore = create<DailyLimitState>((set) => ({
  tally: null,
  dialogOpen: false,
  keepWatchingAt: 0,
  setTally: (tally) => set({ tally }),
  openDialog: (keepWatchingAt) => set({ dialogOpen: true, keepWatchingAt }),
  closeDialog: () => set({ dialogOpen: false }),
}));
