import { create } from "zustand";

interface SessionState {
  /** Playing time since the last break of five minutes or more, in ms. */
  sessionMs: number;
  setSessionMs: (ms: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionMs: 0,
  setSessionMs: (sessionMs) => set({ sessionMs }),
}));
