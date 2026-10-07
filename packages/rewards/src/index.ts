import type { GameEvent } from "@live-dealr/shared-types";

export type RewardSignal =
  | "ROUND_COMPLETED"
  | "SHOE_COMPLETED"
  | "DEALER_FOLLOWED"
  | "MISSION_COMPLETED"
  | "TABLE_EVENT_PARTICIPATED";

export interface RewardListener {
  onSignal(signal: RewardSignal, event?: GameEvent): void;
}

export function rewardSignalFromEvent(event: GameEvent): RewardSignal | null {
  if (event.type === "ROUND_COMPLETED") {
    return "ROUND_COMPLETED";
  }
  if (event.type === "SHOE_COMPLETED") {
    return "SHOE_COMPLETED";
  }
  return null;
}
