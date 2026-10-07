import { DEFAULT_TABLE_ID } from "@live-dealr/shared-types";
import type { ChatKind, ChatMessage } from "@live-dealr/realtime";

const MAX_MESSAGES = 80;

export class ChatRoom {
  private readonly messages: ChatMessage[] = [];

  constructor() {
    this.push({
      tableId: DEFAULT_TABLE_ID,
      senderId: "dealer-isla",
      senderName: "Isla",
      text: "Place your bets. I'm live.",
      kind: "system",
    });
  }

  list(): ChatMessage[] {
    return [...this.messages];
  }

  push(input: {
    tableId: string;
    senderId: string;
    senderName: string;
    text: string;
    kind?: ChatKind;
  }): ChatMessage | null {
    const text = input.text.trim().slice(0, 160);
    if (!text) {
      return null;
    }
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      tableId: input.tableId,
      senderId: input.senderId,
      senderName: input.senderName.slice(0, 24),
      text,
      kind: input.kind ?? "chat",
      timestamp: new Date().toISOString(),
    };
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
    return message;
  }
}
