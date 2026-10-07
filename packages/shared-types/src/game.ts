import type { Card } from "./card";
import type { DealerProfile } from "./dealer";

export type PlayerActionType = "hit" | "stand" | "double" | "split" | "insurance";

export type TablePhase =
  | "closed"
  | "open"
  | "paused"
  | "betting"
  | "dealing"
  | "player_action"
  | "dealer_action"
  | "settling"
  | "round_complete"
  | "shoe_complete";

export type ShoeStatus = "disconnected" | "connected" | "ready" | "in_play" | "completed";

export type CardRecipient = "player" | "dealer";

export type HandOutcome = "win" | "lose" | "push" | "blackjack" | "bust";

export type DealerInstructionKind =
  | "waiting_for_player"
  | "waiting_for_card"
  | "hit"
  | "stand"
  | "double"
  | "deal_player"
  | "deal_dealer"
  | "round_complete";

export interface Hand {
  id: string;
  owner: CardRecipient;
  cards: Card[];
  isStood: boolean;
  isDoubled: boolean;
  isSplit: boolean;
  isResolved: boolean;
  isBlackjack: boolean;
  isBust: boolean;
  isSoft: boolean;
  total: number;
  outcome?: HandOutcome;
  payout?: number;
}

export interface Bet {
  id: string;
  playerId: string;
  handId: string;
  amount: number;
  placedAt: string;
}

export interface PlayerAction {
  id: string;
  tableId: string;
  playerId: string;
  handId: string;
  action: PlayerActionType;
  createdAt: string;
}

export const CHIP_VALUES = [1, 5, 25, 100, 500] as const;
export type ChipValue = (typeof CHIP_VALUES)[number];

export interface Player {
  id: string;
  displayName: string;
  seat: number;
  demoCredits: number;
  chipStack: ChipValue[];
  hands: Hand[];
  activeHandIndex: number;
  currentBet: number;
}

export interface Dealer {
  id: string;
  profile: DealerProfile;
  hand: Hand;
}

export interface Shoe {
  id: string;
  tableId: string;
  status: ShoeStatus;
  cardsDealt: number;
  connectedAt?: string;
}

export interface Table {
  id: string;
  name: string;
  phase: TablePhase;
  paused: boolean;
}

export interface Round {
  id: string;
  tableId: string;
  shoeId: string;
  startedAt: string;
  completedAt?: string;
  nextCardRecipient: CardRecipient | null;
  bets: Bet[];
}

export interface Settlement {
  playerId: string;
  handId: string;
  outcome: HandOutcome;
  betAmount: number;
  payout: number;
  net: number;
}

export interface DealerInstruction {
  kind: DealerInstructionKind;
  label: string;
  detail?: string;
}

export interface GameState {
  table: Table;
  shoe: Shoe;
  round: Round | null;
  dealer: Dealer;
  players: Player[];
  availableActions: PlayerActionType[];
  dealerInstruction: DealerInstruction;
  lastSettlements: Settlement[];
  /** Betting window end */
  bettingClosesAt: string | null;
  /** Local player decision window end */
  actionClosesAt: string | null;
  /** Next round / between-hands end */
  nextRoundAt: string | null;
  /** Whose turn for player_action (null = none) */
  actingPlayerId: string | null;
  minBet: number;
  maxBet: number;
  sequence: number;
}
