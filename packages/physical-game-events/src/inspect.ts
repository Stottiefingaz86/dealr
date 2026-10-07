import { formatCard, type GameEvent } from "@live-dealr/shared-types";

export function formatEventForInspector(event: GameEvent): string {
  const seq = String(event.sequence).padStart(3, "0");
  const extra = describePayload(event);
  return extra ? `${seq} ${event.type} ${extra}` : `${seq} ${event.type}`;
}

function describePayload(event: GameEvent): string {
  switch (event.type) {
    case "CARD_DETECTED":
      return formatCard({ rank: event.payload.rank, suit: event.payload.suit });
    case "CARD_ASSIGNED":
      return `${event.payload.recipient.toUpperCase()}${event.payload.hole ? " HOLE" : ""} ${formatCard(event.payload.card)}`;
    case "PLAYER_ACTION_RECEIVED":
      return event.payload.action.toUpperCase();
    case "PLAYER_ACTION_REQUIRED":
      return event.payload.actions.map((action) => action.toUpperCase()).join("/");
    case "BET_PLACED":
      return String(event.payload.amount);
    case "ROUND_SETTLED":
      return event.payload.settlements.map((item) => item.outcome.toUpperCase()).join(", ");
    case "HAND_COMPLETED":
      return `${event.payload.owner.toUpperCase()} ${event.payload.total}`;
    default:
      return "";
  }
}
