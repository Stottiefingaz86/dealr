import { CardReaderService } from "@live-dealr/card-reader";
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
import { InMemoryEventStore } from "./event-store";
import { TableRuntime, type TableListener } from "./table-runtime";

/** Prototype: auto-deal random shoe cards so rounds play without a physical reader. */
const AUTO_DEAL_MS = 550;

export class TableControllerService {
  private readonly runtime: TableRuntime;
  private readonly followers = new Set<string>();
  private autoDealTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly cardReader: CardReaderService) {
    this.runtime = new TableRuntime(new InMemoryEventStore(), DEFAULT_TABLE_ID);
  }

  async boot(): Promise<void> {
    this.runtime.open();
    await this.cardReader.connect(DEFAULT_TABLE_ID, DEFAULT_SHOE_ID);
    this.runtime.connectShoe(
      DEFAULT_SHOE_ID,
      this.cardReader.deviceId,
      this.cardReader.adapterKind,
    );
    this.cardReader.onDetection((detection) => {
      this.runtime.onCardDetected(detection);
    });
    // Whenever the table expects a shoe card, simulate one after a short delay.
    this.runtime.subscribe((_event, state) => {
      if (state.round?.nextCardRecipient) {
        this.scheduleAutoDeal();
      }
    });
    this.runtime.openBetting();
  }

  private scheduleAutoDeal(): void {
    if (this.autoDealTimer) {
      clearTimeout(this.autoDealTimer);
    }
    this.autoDealTimer = setTimeout(() => {
      this.autoDealTimer = null;
      const state = this.runtime.getState();
      if (!state.round?.nextCardRecipient || state.table.paused) {
        return;
      }
      const rank = RANKS[Math.floor(Math.random() * RANKS.length)]!;
      const suit = SUITS[Math.floor(Math.random() * SUITS.length)]!;
      try {
        this.detectCard(rank, suit);
      } catch {
        // Race with phase change — ignore
      }
    }, AUTO_DEAL_MS);
  }

  getState(): GameState {
    return this.runtime.getState();
  }

  getEvents(): GameEvent[] {
    return this.runtime.getEvents();
  }

  subscribe(listener: TableListener): () => void {
    return this.runtime.subscribe(listener);
  }

  addChip(playerId: string, value: number): GameState {
    this.runtime.addChip(playerId, value);
    return this.getState();
  }

  clearBet(playerId: string): GameState {
    this.runtime.clearBet(playerId);
    return this.getState();
  }

  closeBetting(): GameState {
    this.runtime.closeBetting();
    return this.getState();
  }

  tipDealer(playerId: string, amount: number): number {
    return this.runtime.tipDealer(playerId, amount);
  }

  deposit(playerId: string, amount: number): GameState {
    this.runtime.deposit(playerId, amount);
    return this.getState();
  }

  withdraw(playerId: string, amount: number): GameState {
    this.runtime.withdraw(playerId, amount);
    return this.getState();
  }

  placeAction(playerId: string, action: PlayerActionType): GameState {
    this.runtime.submitPlayerAction(playerId, action);
    return this.getState();
  }

  detectCard(rank: Rank, suit: Suit): GameState {
    this.cardReader.injectSimulatedCard(rank, suit);
    return this.getState();
  }

  followDealer(playerId: string): { following: boolean; followerCount: number } {
    this.followers.add(playerId);
    return this.followStatus();
  }

  unfollowDealer(playerId: string): { following: boolean; followerCount: number } {
    this.followers.delete(playerId);
    return this.followStatus();
  }

  followStatus(playerId = DEFAULT_PLAYER_ID) {
    return {
      following: this.followers.has(playerId),
      followerCount: 18420 + this.followers.size,
    };
  }
}
