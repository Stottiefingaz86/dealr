import type { Card, Rank, Suit } from "./card";
import type {
  CardRecipient,
  DealerInstruction,
  GameState,
  HandOutcome,
  PlayerActionType,
  Settlement,
  ShoeStatus,
  TablePhase,
} from "./game";

export const GAME_EVENT_TYPES = [
  "TABLE_OPENED",
  "SHOE_CONNECTED",
  "SHOE_STARTED",
  "ROUND_STARTED",
  "BETTING_OPENED",
  "BET_PLACED",
  "BETTING_CLOSED",
  "CARD_DETECTED",
  "CARD_ASSIGNED",
  "PLAYER_ACTION_REQUIRED",
  "PLAYER_ACTION_RECEIVED",
  "DEALER_ACTION_REQUIRED",
  "HAND_COMPLETED",
  "ROUND_SETTLED",
  "ROUND_COMPLETED",
  "SHOE_COMPLETED",
  "TABLE_PAUSED",
  "TABLE_RESUMED",
  "GAME_STATE_UPDATED",
] as const;

export type GameEventType = (typeof GAME_EVENT_TYPES)[number];

interface GameEventBase<TType extends GameEventType, TPayload> {
  id: string;
  tableId: string;
  roundId: string | null;
  sequence: number;
  timestamp: string;
  type: TType;
  payload: TPayload;
}

export type TableOpenedEvent = GameEventBase<"TABLE_OPENED", { tableId: string; name: string }>;
export type ShoeConnectedEvent = GameEventBase<
  "SHOE_CONNECTED",
  { shoeId: string; deviceId: string; adapter: "simulator" | "physical" }
>;
export type ShoeStartedEvent = GameEventBase<"SHOE_STARTED", { shoeId: string; status: ShoeStatus }>;
export type RoundStartedEvent = GameEventBase<"ROUND_STARTED", { roundId: string; shoeId: string }>;
export type BettingOpenedEvent = GameEventBase<"BETTING_OPENED", { minBet: number; maxBet: number }>;
export type BetPlacedEvent = GameEventBase<
  "BET_PLACED",
  { playerId: string; betId: string; amount: number }
>;
export type BettingClosedEvent = GameEventBase<"BETTING_CLOSED", { roundId: string }>;
export type CardDetectedEvent = GameEventBase<
  "CARD_DETECTED",
  {
    shoeId: string;
    rank: Rank;
    suit: Suit;
    cardId: string;
    shoeSequence: number;
  }
>;
export type CardAssignedEvent = GameEventBase<
  "CARD_ASSIGNED",
  {
    card: Card;
    recipient: CardRecipient;
    handId: string;
    hole: boolean;
  }
>;
export type PlayerActionRequiredEvent = GameEventBase<
  "PLAYER_ACTION_REQUIRED",
  { playerId: string; handId: string; actions: PlayerActionType[] }
>;
export type PlayerActionReceivedEvent = GameEventBase<
  "PLAYER_ACTION_RECEIVED",
  { playerId: string; handId: string; action: PlayerActionType }
>;
export type DealerActionRequiredEvent = GameEventBase<
  "DEALER_ACTION_REQUIRED",
  { instruction: DealerInstruction }
>;
export type HandCompletedEvent = GameEventBase<
  "HAND_COMPLETED",
  { handId: string; owner: CardRecipient; total: number; isBust: boolean; isBlackjack: boolean }
>;
export type RoundSettledEvent = GameEventBase<"ROUND_SETTLED", { settlements: Settlement[] }>;
export type RoundCompletedEvent = GameEventBase<
  "ROUND_COMPLETED",
  { roundId: string; outcomes: HandOutcome[] }
>;
export type ShoeCompletedEvent = GameEventBase<"SHOE_COMPLETED", { shoeId: string }>;
export type TablePausedEvent = GameEventBase<"TABLE_PAUSED", { reason: string }>;
export type TableResumedEvent = GameEventBase<"TABLE_RESUMED", { phase: TablePhase }>;
export type GameStateUpdatedEvent = GameEventBase<"GAME_STATE_UPDATED", { state: GameState }>;

export type GameEvent =
  | TableOpenedEvent
  | ShoeConnectedEvent
  | ShoeStartedEvent
  | RoundStartedEvent
  | BettingOpenedEvent
  | BetPlacedEvent
  | BettingClosedEvent
  | CardDetectedEvent
  | CardAssignedEvent
  | PlayerActionRequiredEvent
  | PlayerActionReceivedEvent
  | DealerActionRequiredEvent
  | HandCompletedEvent
  | RoundSettledEvent
  | RoundCompletedEvent
  | ShoeCompletedEvent
  | TablePausedEvent
  | TableResumedEvent
  | GameStateUpdatedEvent;

export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
