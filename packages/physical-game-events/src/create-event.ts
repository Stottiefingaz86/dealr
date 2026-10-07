import type { GameEvent, GameEventOf, GameEventType } from "@live-dealr/shared-types";

export interface CreateGameEventInput<T extends GameEventType> {
  tableId: string;
  roundId: string | null;
  sequence: number;
  type: T;
  payload: GameEventOf<T>["payload"];
  timestamp?: string;
  id?: string;
}

export function createGameEvent<T extends GameEventType>(
  input: CreateGameEventInput<T>,
): GameEventOf<T> {
  return {
    id: input.id ?? crypto.randomUUID(),
    tableId: input.tableId,
    roundId: input.roundId,
    sequence: input.sequence,
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type,
    payload: input.payload,
  } as GameEventOf<T>;
}

export function isGameEvent(value: unknown): value is GameEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<GameEvent>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.tableId === "string" &&
    typeof candidate.sequence === "number" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.type === "string"
  );
}
