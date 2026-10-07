import type { GameEvent, GameState, PlayerActionType } from "@live-dealr/shared-types";

export const SOCKET_PATH = "/realtime";

export type ClientRole = "player" | "dealer" | "inspector";

export const ClientEvents = {
  joinTable: "table:join",
  leaveTable: "table:leave",
  playerAction: "player:action",
  startRound: "table:start-round",
  placeBet: "table:place-bet",
  addChip: "table:add-chip",
  clearBet: "table:clear-bet",
  closeBetting: "table:close-betting",
  pauseTable: "table:pause",
  resumeTable: "table:resume",
  followDealer: "dealer:follow",
  tipDealer: "dealer:tip",
  sendChat: "chat:send",
  sendReaction: "reaction:send",
  claimReward: "mission:claim",
  dealerGoLive: "dealer:go-live",
  dealerEndLive: "dealer:end-live",
} as const;

export const ServerEvents = {
  tableState: "table:state",
  tableEvent: "table:event",
  tableEvents: "table:events",
  error: "table:error",
  chatMessage: "chat:message",
  chatHistory: "chat:history",
  reaction: "reaction",
  mediaState: "media:state",
} as const;

export interface TableMediaSessionMessage {
  tableId: string;
  live: boolean;
  playbackUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface DealerGoLivePayload {
  tableId: string;
  playbackUrl?: string | null;
}

export interface JoinTablePayload {
  tableId: string;
  role: ClientRole;
  playerId?: string;
}

export interface PlayerActionPayload {
  tableId: string;
  playerId: string;
  action: PlayerActionType;
}

export interface PlaceBetPayload {
  tableId: string;
  playerId: string;
  amount: number;
}

export interface AddChipPayload {
  tableId: string;
  playerId: string;
  value: number;
}

export interface StartRoundPayload {
  tableId: string;
}

export interface TableErrorPayload {
  message: string;
}

export interface TableStateMessage {
  state: GameState;
}

export interface TableEventMessage {
  event: GameEvent;
}

export interface TableEventsSnapshot {
  events: GameEvent[];
}

export type ChatKind = "chat" | "system" | "follow" | "tip";

export interface ChatMessage {
  id: string;
  tableId: string;
  senderId: string;
  senderName: string;
  text: string;
  kind: ChatKind;
  timestamp: string;
}

export interface TipDealerPayload {
  tableId: string;
  playerId: string;
  amount: number;
}

export interface ClaimRewardPayload {
  tableId: string;
  playerId: string;
  missionId: string;
  missionTitle: string;
  /** Cashback to credit; 0 for cosmetic unlocks (still announced in chat) */
  amount: number;
  unlockLabel?: string;
}

export type ReactionKind = "emote" | "throw";

export interface ReactionMessage {
  id: string;
  tableId: string;
  senderId: string;
  senderName: string;
  kind: ReactionKind;
  emoji: string;
  fromSeat: number;
  /** Target seat for throws. */
  toSeat: number | null;
  timestamp: string;
}

export interface SendReactionPayload {
  tableId: string;
  senderId: string;
  kind: ReactionKind;
  emoji: string;
  toSeat?: number | null;
}

export interface SendChatPayload {
  tableId: string;
  senderId: string;
  senderName: string;
  text: string;
}

export { createRealtimeSocket } from "./client";
