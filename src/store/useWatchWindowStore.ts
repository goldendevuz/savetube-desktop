import { create } from "zustand";

interface WatchWindowState {
  /** Whether the "Outside your watching hours" dialog is showing. */
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useWatchWindowStore = create<WatchWindowState>((set) => ({
  dialogOpen: false,
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),
}));
