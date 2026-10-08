import { create } from "zustand";
import {
  DEFAULT_TABLE_LAYOUT,
  normalizeTableLayout,
  setLayoutSpot,
  type LayoutSpotId,
  type TableLayout,
  type TableSpot,
} from "@live-dealr/environments";
import type { ChatMessage, ReactionMessage } from "@live-dealr/realtime";
import {
  advance,
  claim,
  EMPTY_BOOK,
  MISSIONS,
  type MissionBook,
  type MissionSignal,
} from "./missions";
import {
  DEFAULT_ENVIRONMENT_SETTINGS,
  type GameEvent,
  type GameState,
  type PlayerEnvironmentSettings,
} from "@live-dealr/shared-types";

interface PlayerStore {
  connected: boolean;
  state: GameState | null;
  events: GameEvent[];
  chat: ChatMessage[];
  /** Recent live reactions from the room (emotes / throws), newest last. */
  reactions: ReactionMessage[];
  following: boolean;
  settings: PlayerEnvironmentSettings;
  tableLayout: TableLayout;
  panel: "none" | "chat" | "rewards" | "dealer" | "settings" | "wallet";
  missions: MissionBook;
  /** Reward ids (emote / throwable) the player has unlocked */
  unlocks: string[];
  signalMission: (signal: MissionSignal) => void;
  claimMission: (id: string) => void;
  setConnected: (value: boolean) => void;
  setState: (state: GameState) => void;
  appendEvent: (event: GameEvent) => void;
  setEvents: (events: GameEvent[]) => void;
  setChat: (messages: ChatMessage[]) => void;
  appendChat: (message: ChatMessage) => void;
  pushReaction: (reaction: ReactionMessage) => void;
  setFollowing: (value: boolean) => void;
  setPanel: (panel: PlayerStore["panel"]) => void;
  updateSettings: (settings: Partial<PlayerEnvironmentSettings>) => void;
  setTableLayout: (layout: TableLayout) => void;
  updateSpot: (id: LayoutSpotId, spot: Partial<TableSpot>) => void;
}

const UNLOCKS_KEY = "dealr.unlocks";

function loadUnlocks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(UNLOCKS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveUnlocks(unlocks: string[]): void {
  try {
    window.localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
  } catch {
    // ignore
  }
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  connected: false,
  state: null,
  events: [],
  chat: [],
  reactions: [],
  following: false,
  settings: DEFAULT_ENVIRONMENT_SETTINGS,
  tableLayout: DEFAULT_TABLE_LAYOUT,
  panel: "none",
  missions: EMPTY_BOOK,
  unlocks: loadUnlocks(),
  signalMission: (signal) => set((current) => ({ missions: advance(current.missions, signal) })),
  claimMission: (id) =>
    set((current) => {
      const mission = MISSIONS.find((m) => m.id === id);
      const missions = claim(current.missions, id);
      if (missions === current.missions || !mission) return current;
      const unlocks =
        mission.reward.kind === "cashback" || current.unlocks.includes(mission.reward.id)
          ? current.unlocks
          : [...current.unlocks, mission.reward.id];
      saveUnlocks(unlocks);
      return { missions, unlocks };
    }),
  setConnected: (connected) => set({ connected }),
  setState: (state) => set({ state }),
  appendEvent: (event) =>
    set((current) => {
      if (current.events.some((item) => item.id === event.id)) return current;
      const next = [...current.events, event];
      // Cap so long sessions don't slow the table effect scanners.
      return { events: next.length > 80 ? next.slice(-80) : next };
    }),
  setEvents: (events) => set({ events }),
  setChat: (chat) => set({ chat }),
  appendChat: (message) =>
    set((current) => {
      if (current.chat.some((item) => item.id === message.id)) {
        return current;
      }
      const withoutEcho = current.chat.filter(
        (item) =>
          !(
            item.id.startsWith("local-") &&
            item.senderId === message.senderId &&
            item.text === message.text
          ),
      );
      return { chat: [...withoutEcho, message].slice(-80) };
    }),
  pushReaction: (reaction) =>
    set((current) => ({ reactions: [...current.reactions, reaction].slice(-24) })),
  setFollowing: (following) => set({ following }),
  setPanel: (panel) => set({ panel }),
  updateSettings: (settings) =>
    set((current) => ({ settings: { ...current.settings, ...settings } })),
  setTableLayout: (layout) => set({ tableLayout: normalizeTableLayout(layout) }),
  updateSpot: (id, spot) =>
    set((current) => ({
      tableLayout: setLayoutSpot(current.tableLayout, id, spot),
    })),
}));
