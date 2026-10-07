import type { GameEvent } from "@live-dealr/shared-types";

export class InMemoryEventStore {
  private readonly events: GameEvent[] = [];

  append(event: GameEvent): void {
    this.events.push(event);
  }

  list(tableId: string): GameEvent[] {
    return this.events.filter((event) => event.tableId === tableId);
  }
}
