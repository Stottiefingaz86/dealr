/**
 * In-browser table host — the same TableRuntime + auto-deal + BotCrowd loop that
 * Nest runs on localhost, so a static Vercel deploy plays identically without an API.
 */

import { InMemoryEventStore } from "@live-dealr/table-controller/event-store";
import { TableRuntime } from "@live-dealr/table-controller/runtime";
import { BotCrowd, type CrowdReaction } from "@live-dealr/websocket/bot-crowd";
import {
  DEFAULT_PLAYER_ID,
  DEFAULT_SHOE_ID,
  DEFAULT_TABLE_ID,
  RANKS,
  SUITS,
  type GameEvent,
  type GameState,
  type PlayerActionType,
  type Rank,
  type Suit,
} from "@live-dealr/shared-types";
import type { ChatMessage, ReactionMessage } from "@live-dealr/realtime";

const AUTO_DEAL_MS = 550;

export type DemoSinks = {
  onState: (state: GameState) => void;
  onEvent: (event: GameEvent) => void;
  onChat: (message: ChatMessage) => void;
  onReaction: (reaction: ReactionMessage) => void;
};

export class DemoTable {
  private readonly runtime: TableRuntime;
  private readonly crowd: BotCrowd;
  private autoDealTimer: ReturnType<typeof setTimeout> | null = null;
  private unsub: (() => void) | null = null;
  private started = false;

  constructor(private readonly sinks: DemoSinks) {
    this.runtime = new TableRuntime(new InMemoryEventStore(), DEFAULT_TABLE_ID);
    this.crowd = new BotCrowd({
      say: (bot, text) => {
        this.sinks.onChat({
          id: `demo-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tableId: DEFAULT_TABLE_ID,
          senderId: bot.id,
          senderName: bot.displayName,
          text,
          kind: "chat",
          timestamp: new Date().toISOString(),
        });
      },
      react: (reaction: CrowdReaction) => {
        this.sinks.onReaction({
          id: `demo-rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tableId: DEFAULT_TABLE_ID,
          senderId: reaction.senderId,
          senderName: reaction.senderName,
          kind: reaction.kind,
          emoji: reaction.emoji,
          fromSeat: reaction.fromSeat,
          toSeat: reaction.toSeat,
          timestamp: new Date().toISOString(),
        });
      },
      dealerPost: (text) => {
        const state = this.runtime.getState();
        this.sinks.onChat({
          id: `demo-dealer-${Date.now()}`,
          tableId: DEFAULT_TABLE_ID,
          senderId: state.dealer.id,
          senderName: state.dealer.profile.displayName.split(" ")[0] ?? "Isla",
          text,
          kind: "system",
          timestamp: new Date().toISOString(),
        });
      },
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.runtime.open();
    this.runtime.connectShoe(DEFAULT_SHOE_ID, "demo-shoe", "simulator");
    this.unsub = this.runtime.subscribe((event, state) => {
      if (event.type !== "GAME_STATE_UPDATED") {
        this.sinks.onEvent(event);
        this.crowd.observe(event, state);
      }
      this.sinks.onState(state);
      if (state.round?.nextCardRecipient) {
        this.scheduleAutoDeal();
      }
    });
    this.crowd.start(this.runtime.getState());
    this.runtime.openBetting();
    this.sinks.onState(this.runtime.getState());
  }

  stop(): void {
    this.crowd.stop();
    this.unsub?.();
    this.unsub = null;
    if (this.autoDealTimer) clearTimeout(this.autoDealTimer);
    this.started = false;
  }

  private scheduleAutoDeal(): void {
    if (this.autoDealTimer) clearTimeout(this.autoDealTimer);
    this.autoDealTimer = setTimeout(() => {
      this.autoDealTimer = null;
      const state = this.runtime.getState();
      if (!state.round?.nextCardRecipient || state.table.paused) return;
      const rank = RANKS[Math.floor(Math.random() * RANKS.length)] as Rank;
      const suit = SUITS[Math.floor(Math.random() * SUITS.length)] as Suit;
      try {
        this.runtime.onCardDetected({
          tableId: DEFAULT_TABLE_ID,
          shoeId: DEFAULT_SHOE_ID,
          rank,
          suit,
          detectedAt: new Date().toISOString(),
          deviceId: "demo-shoe",
        });
      } catch {
        // Race with phase change
      }
    }, AUTO_DEAL_MS);
  }

  addChip(value: number): void {
    this.runtime.addChip(DEFAULT_PLAYER_ID, value);
  }

  clearBet(): void {
    this.runtime.clearBet(DEFAULT_PLAYER_ID);
  }

  /** Lock chips and deal now (skip the rest of the betting clock). */
  confirmBet(): void {
    const me = this.runtime.getState().players.find((p) => p.id === DEFAULT_PLAYER_ID);
    if (!me || me.currentBet < 1) return;
    this.runtime.closeBetting();
  }

  sendAction(action: PlayerActionType): void {
    this.runtime.submitPlayerAction(DEFAULT_PLAYER_ID, action);
  }

  tip(amount: number): void {
    const paid = this.runtime.tipDealer(DEFAULT_PLAYER_ID, amount);
    const state = this.runtime.getState();
    this.sinks.onChat({
      id: `demo-tip-${Date.now()}`,
      tableId: DEFAULT_TABLE_ID,
      senderId: DEFAULT_PLAYER_ID,
      senderName: "You",
      text: `tipped ${state.dealer.profile.displayName} $${paid}`,
      kind: "tip",
      timestamp: new Date().toISOString(),
    });
  }

  claimReward(payload: {
    missionId: string;
    missionTitle: string;
    amount: number;
    unlockLabel?: string;
  }): void {
    if (payload.amount > 0) {
      this.runtime.deposit(DEFAULT_PLAYER_ID, payload.amount);
    }
    this.sinks.onChat({
      id: `demo-claim-${Date.now()}`,
      tableId: DEFAULT_TABLE_ID,
      senderId: DEFAULT_PLAYER_ID,
      senderName: "You",
      text:
        payload.amount > 0
          ? `completed "${payload.missionTitle}" · $${payload.amount} cashback`
          : `completed "${payload.missionTitle}" · unlocked ${payload.unlockLabel ?? "a reward"}`,
      kind: "tip",
      timestamp: new Date().toISOString(),
    });
  }

  sendReaction(kind: "emote" | "throw", emoji: string, toSeat: number | null): void {
    const me = this.runtime.getState().players.find((p) => p.id === DEFAULT_PLAYER_ID);
    this.sinks.onReaction({
      id: `demo-me-${Date.now()}`,
      tableId: DEFAULT_TABLE_ID,
      senderId: DEFAULT_PLAYER_ID,
      senderName: "You",
      kind,
      emoji,
      fromSeat: me?.seat ?? 1,
      toSeat,
      timestamp: new Date().toISOString(),
    });
  }
}
