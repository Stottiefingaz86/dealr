import { create } from "zustand";
import type { GameEvent, GameState } from "@live-dealr/shared-types";

interface DealerStore {
  connected: boolean;
  state: GameState | null;
  events: GameEvent[];
  setConnected: (value: boolean) => void;
  setState: (state: GameState) => void;
  appendEvent: (event: GameEvent) => void;
  setEvents: (events: GameEvent[]) => void;
}

export const useDealerStore = create<DealerStore>((set) => ({
  connected: false,
  state: null,
  events: [],
  setConnected: (connected) => set({ connected }),
  setState: (state) => set({ state }),
  appendEvent: (event) =>
    set((current) => ({
      events: current.events.some((item) => item.id === event.id)
        ? current.events
        : [...current.events, event],
    })),
  setEvents: (events) => set({ events }),
}));
