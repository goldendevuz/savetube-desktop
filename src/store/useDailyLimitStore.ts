import { create } from "zustand";

import { aggregate, latestDay, type DailyTally, type SharedTally } from "../lib/wellbeing/dailyLimit";

interface DailyLimitState {
  /** Every device's count, as last read or counted. */
  shared: SharedTally;
  /** This device's id in `shared`, once it is known. */
  ownId: string;
  /** The newest day's count, all devices together: what the limit checks. */
  tally: DailyTally | null;
  /** Whether the "Time's up" dialog is showing. */
  dialogOpen: boolean;
  /** When "Keep watching" becomes available, in `Date.now()` time. */
  keepWatchingAt: number;
  setShared: (shared: SharedTally) => void;
  setOwnId: (id: string) => void;
  openDialog: (keepWatchingAt: number) => void;
  closeDialog: () => void;
}

export const useDailyLimitStore = create<DailyLimitState>((set) => ({
  shared: {},
  ownId: "",
  tally: null,
  dialogOpen: false,
  keepWatchingAt: 0,
  setShared: (shared) => {
    const day = latestDay(shared);
    set({ shared, tally: day === null ? null : aggregate(shared, day) });
  },
  setOwnId: (ownId) => set({ ownId }),
  openDialog: (keepWatchingAt) => set({ dialogOpen: true, keepWatchingAt }),
  closeDialog: () => set({ dialogOpen: false }),
}));
