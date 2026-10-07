import {
  createEmptyHand,
  getAvailableActions,
  refreshHand,
  revealHand,
  settleHand,
  shouldDealerDraw,
  withCard,
} from "@live-dealr/blackjack-engine";
import { getDemoDealer } from "@live-dealr/dealer-profiles";
import { createGameEvent } from "@live-dealr/physical-game-events";
import { rewardSignalFromEvent } from "@live-dealr/rewards";
import {
  CHIP_VALUES,
  DEFAULT_PLAYER_ID,
  DEFAULT_SHOE_ID,
  DEFAULT_TABLE_ID,
  type Card,
  type CardRecipient,
  type ChipValue,
  type DealerInstruction,
  type GameEvent,
  type GameState,
  type Hand,
  type Player,
  type PlayerActionType,
  type Rank,
  type Suit,
} from "@live-dealr/shared-types";
import type { PhysicalCardDetection } from "@live-dealr/card-reader";
import { InMemoryEventStore } from "./event-store";

export type TableListener = (event: GameEvent, state: GameState) => void;

type DealTarget =
  | { kind: "dealer"; hole?: boolean }
  | { kind: "player"; playerId: string };

const STARTING_CREDITS = 1000;
const MIN_BET = 1;
const MAX_BET = 5000;
const BETTING_SECONDS = 15;
const LOCAL_ACTION_SECONDS = 12;
/** Other players get a short decision window — orb countdown on their pad. */
const BOT_ACTION_SECONDS = 6;
const BETWEEN_ROUNDS_MS = 4500;

const TABLEMATES: Array<{ id: string; displayName: string; seat: number }> = [
  { id: "bot-maya", displayName: "Maya", seat: 2 },
  { id: "bot-theo", displayName: "Theo", seat: 3 },
  { id: "bot-kai", displayName: "Kai", seat: 4 },
  { id: "bot-reno", displayName: "Reno", seat: 5 },
];

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function isBot(playerId: string): boolean {
  return playerId.startsWith("bot-");
}

export type TableMode = "demo" | "live";

export class TableRuntime {
  private state: GameState;
  private sequence = 0;
  private readonly listeners = new Set<TableListener>();
  private dealQueue: DealTarget[] = [];
  private awaiting: DealTarget | null = null;
  private pendingDouble = false;
  private lastActionId: string | null = null;
  private bettingTimer: ReturnType<typeof setTimeout> | null = null;
  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRoundTimer: ReturnType<typeof setTimeout> | null = null;
  private botBetTimers: Array<ReturnType<typeof setTimeout>> = [];
  private botActionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Players still to act this round (seat order). */
  private actionQueue: string[] = [];
  private readonly mode: TableMode;

  constructor(
    private readonly store: InMemoryEventStore,
    tableId = DEFAULT_TABLE_ID,
    mode: TableMode = "demo",
  ) {
    this.mode = mode;
    this.state = this.createInitialState(tableId);
  }

  getState(): GameState {
    return cloneState(this.state);
  }

  getEvents(): GameEvent[] {
    return this.store.list(this.state.table.id);
  }

  subscribe(listener: TableListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Seat a human at a free chair (1–5). Live tables start empty;
   * reclaiming the same playerId returns their existing seat.
   * Pass `preferredSeat` to sit at a specific open chair.
   */
  claimSeat(
    displayName: string,
    playerId = crypto.randomUUID(),
    avatarUrl?: string,
    preferredSeat?: number,
  ): Player {
    const existing = this.state.players.find((p) => p.id === playerId);
    if (existing) {
      existing.displayName = displayName.trim() || existing.displayName;
      if (avatarUrl !== undefined) existing.avatarUrl = avatarUrl || undefined;
      if (
        preferredSeat != null &&
        preferredSeat !== existing.seat &&
        (this.state.table.phase === "betting" ||
          this.state.table.phase === "open" ||
          this.state.table.phase === "closed")
      ) {
        return this.moveToSeat(playerId, preferredSeat);
      }
      this.publishState();
      return structuredClone(existing);
    }
    if (this.state.players.filter((p) => !isBot(p.id)).length >= 5) {
      throw new Error("Table is full (5 players max)");
    }
    const taken = new Set(this.state.players.map((p) => p.seat));
    let seat = 0;
    if (
      preferredSeat != null &&
      preferredSeat >= 1 &&
      preferredSeat <= 5 &&
      !taken.has(preferredSeat)
    ) {
      seat = preferredSeat;
    } else {
      for (let i = 1; i <= 5; i++) {
        if (!taken.has(i)) {
          seat = i;
          break;
        }
      }
    }
    if (!seat) {
      // Replace a bot if any remain (demo → live transition)
      const bot = this.state.players.find((p) => isBot(p.id));
      if (bot) {
        bot.id = playerId;
        bot.displayName = displayName.trim() || "Player";
        bot.avatarUrl = avatarUrl || undefined;
        bot.demoCredits = STARTING_CREDITS;
        bot.chipStack = [];
        bot.hands = [];
        bot.activeHandIndex = 0;
        bot.currentBet = 0;
        if (preferredSeat != null && preferredSeat >= 1 && preferredSeat <= 5) {
          const occupied = this.state.players.some(
            (p) => p.seat === preferredSeat && p.id !== bot.id && !isBot(p.id),
          );
          if (!occupied) bot.seat = preferredSeat;
        }
        this.publishState();
        return structuredClone(bot);
      }
      throw new Error("Table is full (5 players max)");
    }
    const player: Player = {
      id: playerId,
      displayName: displayName.trim() || "Player",
      seat,
      demoCredits: STARTING_CREDITS,
      chipStack: [],
      hands: [],
      activeHandIndex: 0,
      currentBet: 0,
      avatarUrl: avatarUrl || undefined,
    };
    this.state.players = [...this.state.players, player].sort((a, b) => a.seat - b.seat);
    this.publishState();
    return structuredClone(player);
  }

  /** Move to an empty seat while bets are open (clears any chips first). */
  moveToSeat(playerId: string, seat: number): Player {
    if (seat < 1 || seat > 5) {
      throw new Error("Invalid seat");
    }
    const phase = this.state.table.phase;
    if (phase !== "betting" && phase !== "open" && phase !== "closed") {
      throw new Error("Can only change seats between hands");
    }
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("You are not seated");
    }
    if (player.seat === seat) {
      return structuredClone(player);
    }
    const occupant = this.state.players.find((p) => p.seat === seat && p.id !== playerId);
    if (occupant && !isBot(occupant.id)) {
      throw new Error("That seat is taken");
    }
    if (occupant && isBot(occupant.id)) {
      this.state.players = this.state.players.filter((p) => p.id !== occupant.id);
    }
    if (player.currentBet > 0 || player.chipStack.length > 0) {
      player.chipStack = [];
      player.currentBet = 0;
    }
    player.seat = seat;
    this.state.players = [...this.state.players].sort((a, b) => a.seat - b.seat);
    this.publishState();
    return structuredClone(player);
  }

  releaseSeat(playerId: string): void {
    if (isBot(playerId)) return;
    const before = this.state.players.length;
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    if (this.state.players.length !== before) {
      this.publishState();
    }
  }

  open(): void {
    this.emit("TABLE_OPENED", {
      tableId: this.state.table.id,
      name: this.state.table.name,
    });
    this.state.table.phase = "open";
    this.refreshInstruction();
    this.publishState();
  }

  connectShoe(shoeId: string, deviceId: string, adapter: "simulator" | "physical"): void {
    this.state.shoe.id = shoeId;
    this.state.shoe.status = "connected";
    this.state.shoe.connectedAt = new Date().toISOString();
    this.emit("SHOE_CONNECTED", { shoeId, deviceId, adapter });
    this.emit("SHOE_STARTED", { shoeId, status: "ready" });
    this.state.shoe.status = "ready";
    this.refreshInstruction();
    this.publishState();
  }

  openBetting(): void {
    if (this.state.table.paused) {
      throw new Error("Table is paused");
    }
    this.clearTimers();
    for (const player of this.state.players) {
      player.chipStack = [];
      player.currentBet = 0;
      player.hands = [];
      player.activeHandIndex = 0;
    }
    this.state.dealer.hand = createEmptyHand("dealer-idle", "dealer");
    this.state.round = null;
    this.state.lastSettlements = [];
    this.state.actingPlayerId = null;
    this.state.actionClosesAt = null;
    this.state.nextRoundAt = null;
    this.state.table.phase = "betting";
    this.state.bettingClosesAt = new Date(Date.now() + BETTING_SECONDS * 1000).toISOString();
    this.awaiting = null;
    this.dealQueue = [];
    this.actionQueue = [];
    this.emit("BETTING_OPENED", { minBet: MIN_BET, maxBet: MAX_BET });
    this.refreshInstruction();
    this.publishState();
    if (this.mode === "demo") {
      this.scheduleBotBets();
    }
    this.bettingTimer = setTimeout(() => {
      this.closeBetting();
    }, BETTING_SECONDS * 1000);
  }

  addChip(playerId: string, value: number): void {
    if (this.state.table.phase !== "betting") {
      throw new Error("Betting is closed");
    }
    if (!CHIP_VALUES.includes(value as ChipValue)) {
      throw new Error("Invalid chip");
    }
    const player = this.requirePlayer(playerId);
    const nextBet = player.currentBet + value;
    if (nextBet > player.demoCredits) {
      throw new Error("Insufficient balance");
    }
    if (nextBet > MAX_BET) {
      throw new Error("Maximum bet exceeded");
    }
    player.chipStack = [...player.chipStack, value as ChipValue];
    player.currentBet = nextBet;
    this.publishState();
  }

  clearBet(playerId: string): void {
    if (this.state.table.phase !== "betting") {
      throw new Error("Betting is closed");
    }
    const player = this.requirePlayer(playerId);
    player.chipStack = [];
    player.currentBet = 0;
    this.publishState();
  }

  closeBetting(): void {
    if (this.state.table.phase !== "betting") {
      return;
    }
    this.clearTimers();
    const active = this.state.players.filter((p) => p.currentBet >= MIN_BET);
    if (active.length === 0) {
      this.openBetting();
      return;
    }
    this.beginDeal(active);
  }

  tipDealer(playerId: string, amount: number): number {
    const tip = Math.round(amount);
    if (!Number.isFinite(tip) || tip <= 0) {
      throw new Error("Invalid tip");
    }
    const player = this.requirePlayer(playerId);
    if (player.demoCredits < tip) {
      throw new Error("Not enough balance to tip");
    }
    player.demoCredits -= tip;
    this.publishState();
    return tip;
  }

  deposit(playerId: string, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid deposit");
    }
    this.requirePlayer(playerId).demoCredits += Math.round(amount);
    this.publishState();
  }

  withdraw(playerId: string, amount: number): void {
    const player = this.requirePlayer(playerId);
    if (!Number.isFinite(amount) || amount <= 0 || amount > player.demoCredits - player.currentBet) {
      throw new Error("Invalid withdrawal");
    }
    player.demoCredits -= Math.round(amount);
    this.publishState();
  }

  private scheduleBotBets(): void {
    for (const bot of this.state.players.filter((p) => isBot(p.id))) {
      const delay = 1200 + Math.random() * 9000;
      const timer = setTimeout(() => {
        if (this.state.table.phase !== "betting") {
          return;
        }
        const picks = this.pickBotChips(bot);
        for (const value of picks) {
          try {
            this.addChip(bot.id, value);
          } catch {
            break;
          }
        }
      }, delay);
      this.botBetTimers.push(timer);
    }
  }

  private pickBotChips(bot: Player): ChipValue[] {
    const budgets: ChipValue[][] = [
      [25],
      [5, 25],
      [25, 25],
      [100],
      [5, 5, 25],
      [1, 25],
    ];
    const choice = budgets[Math.floor(Math.random() * budgets.length)]!;
    const total = choice.reduce((a, b) => a + b, 0);
    if (total > bot.demoCredits) {
      return [5];
    }
    return choice;
  }

  private beginDeal(active: Player[]): void {
    const roundId = crypto.randomUUID();
    const dealerHand = createEmptyHand(crypto.randomUUID(), "dealer");
    const bets = [];

    for (const player of active) {
      const hand = createEmptyHand(crypto.randomUUID(), "player");
      player.demoCredits -= player.currentBet;
      player.activeHandIndex = 0;
      player.hands = [hand];
      bets.push({
        id: crypto.randomUUID(),
        playerId: player.id,
        handId: hand.id,
        amount: player.currentBet,
        placedAt: new Date().toISOString(),
      });
    }

    // Clear sitting-out players' stacks visually until next round
    for (const player of this.state.players) {
      if (player.currentBet < MIN_BET) {
        player.chipStack = [];
        player.hands = [];
      }
    }

    this.state.round = {
      id: roundId,
      tableId: this.state.table.id,
      shoeId: this.state.shoe.id,
      startedAt: new Date().toISOString(),
      nextCardRecipient: "player",
      bets,
    };
    this.state.bettingClosesAt = null;
    this.state.lastSettlements = [];
    this.pendingDouble = false;
    this.lastActionId = null;
    this.state.shoe.status = "in_play";
    this.state.dealer.hand = dealerHand;

    this.emit("BETTING_CLOSED", { roundId });
    for (const bet of bets) {
      this.emit("BET_PLACED", {
        playerId: bet.playerId,
        betId: bet.id,
        amount: bet.amount,
      });
    }
    this.emit("ROUND_STARTED", { roundId, shoeId: this.state.shoe.id });

    // Classic live deal: one card each player, dealer up, one each player, dealer hole
    const bySeat = [...active].sort((a, b) => a.seat - b.seat);
    this.dealQueue = [];
    for (const player of bySeat) {
      this.dealQueue.push({ kind: "player", playerId: player.id });
    }
    this.dealQueue.push({ kind: "dealer" });
    for (const player of bySeat) {
      this.dealQueue.push({ kind: "player", playerId: player.id });
    }
    this.dealQueue.push({ kind: "dealer", hole: true });

    // Others act first (with turn orb), then local — feels like a live table.
    const bots = bySeat.filter((p) => isBot(p.id)).map((p) => p.id);
    const humans = bySeat.filter((p) => !isBot(p.id)).map((p) => p.id);
    this.actionQueue = [...bots, ...humans];
    this.awaiting = this.dealQueue[0] ?? null;
    this.state.round.nextCardRecipient = this.awaiting?.kind === "dealer" ? "dealer" : "player";
    this.state.table.phase = "dealing";
    this.state.availableActions = [];
    this.state.actingPlayerId = null;
    this.refreshInstruction();
    this.publishState();
  }

  private clearTimers(): void {
    if (this.bettingTimer) {
      clearTimeout(this.bettingTimer);
      this.bettingTimer = null;
    }
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
      this.nextRoundTimer = null;
    }
    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }
    for (const t of this.botBetTimers) {
      clearTimeout(t);
    }
    this.botBetTimers = [];
  }

  onCardDetected(detection: PhysicalCardDetection): void {
    if (this.state.table.paused) {
      throw new Error("Table is paused");
    }
    if (!this.state.round || !this.awaiting) {
      throw new Error("No card is expected from the shoe");
    }

    this.state.shoe.cardsDealt += 1;
    const cardId = crypto.randomUUID();
    this.emit("CARD_DETECTED", {
      shoeId: detection.shoeId,
      rank: detection.rank,
      suit: detection.suit,
      cardId,
      shoeSequence: this.state.shoe.cardsDealt,
    });

    const target = this.awaiting;
    const hole = target.kind === "dealer" && Boolean(target.hole);
    const card: Card = {
      id: cardId,
      rank: detection.rank as Rank,
      suit: detection.suit as Suit,
      sequence: this.state.shoe.cardsDealt,
      shoeId: detection.shoeId,
      detectedAt: detection.detectedAt,
      hidden: hole,
    };

    this.assignCard(card, target, hole);
  }

  submitPlayerAction(playerId: string, action: PlayerActionType): void {
    if (this.state.table.paused) {
      throw new Error("Table is paused");
    }
    if (this.state.table.phase !== "player_action") {
      throw new Error("Player action is not currently required");
    }
    if (this.state.actingPlayerId !== playerId) {
      throw new Error("Not this player's turn");
    }

    const player = this.requirePlayer(playerId);
    const hand = player.hands[player.activeHandIndex];
    if (!hand) {
      throw new Error("No active hand");
    }
    if (!this.state.availableActions.includes(action)) {
      throw new Error(`Action ${action} is not available`);
    }

    const actionId = `${this.state.round?.id}:${playerId}:${action}:${hand.cards.length}`;
    if (actionId === this.lastActionId) {
      throw new Error("Duplicate player action rejected");
    }
    this.lastActionId = actionId;
    this.clearActionTimer();

    this.emit("PLAYER_ACTION_RECEIVED", {
      playerId,
      handId: hand.id,
      action,
    });

    if (action === "hit") {
      this.awaiting = { kind: "player", playerId };
      this.state.round!.nextCardRecipient = "player";
      this.state.table.phase = "dealing";
      this.state.availableActions = [];
      this.state.actionClosesAt = null;
      this.refreshInstruction("hit");
      this.publishState();
      return;
    }

    if (action === "double") {
      if (player.demoCredits < player.currentBet) {
        throw new Error("Insufficient credits to double");
      }
      player.demoCredits -= player.currentBet;
      player.currentBet *= 2;
      hand.isDoubled = true;
      this.pendingDouble = true;
      this.awaiting = { kind: "player", playerId };
      this.state.round!.nextCardRecipient = "player";
      this.state.table.phase = "dealing";
      this.state.availableActions = [];
      this.state.actionClosesAt = null;
      this.refreshInstruction("double");
      this.publishState();
      return;
    }

    if (action === "stand") {
      hand.isStood = true;
      this.completePlayerHand(hand);
      this.advanceActionQueue();
    }
  }

  pause(reason: string): void {
    this.state.table.paused = true;
    this.state.table.phase = "paused";
    this.emit("TABLE_PAUSED", { reason });
    this.refreshInstruction();
    this.publishState();
  }

  resume(): void {
    this.state.table.paused = false;
    this.state.table.phase = this.state.round ? "player_action" : "open";
    this.emit("TABLE_RESUMED", { phase: this.state.table.phase });
    this.refreshInstruction();
    this.publishState();
  }

  private assignCard(card: Card, target: DealTarget, hole: boolean): void {
    if (target.kind === "player") {
      const player = this.requirePlayer(target.playerId);
      const hand = player.hands[player.activeHandIndex];
      if (!hand) {
        throw new Error("Player hand missing");
      }
      const next = withCard(hand, card);
      player.hands[player.activeHandIndex] = next;
      this.emit("CARD_ASSIGNED", {
        card,
        recipient: "player" satisfies CardRecipient,
        handId: next.id,
        hole,
      });
      this.afterPlayerCard(target.playerId, next);
      return;
    }

    const next = withCard(this.state.dealer.hand, card);
    this.state.dealer.hand = next;
    this.emit("CARD_ASSIGNED", {
      card,
      recipient: "dealer",
      handId: next.id,
      hole,
    });
    this.afterDealerCard(next);
  }

  private afterPlayerCard(playerId: string, hand: Hand): void {
    if (this.dealQueue.length > 0) {
      this.advanceDealQueue();
      return;
    }

    if (hand.isBust) {
      this.completePlayerHand(hand);
      this.advanceActionQueue();
      return;
    }

    if (this.pendingDouble) {
      this.pendingDouble = false;
      hand.isStood = true;
      this.completePlayerHand(hand);
      this.advanceActionQueue();
      return;
    }

    // Twenty-one — no need to stand; hand is done.
    if (hand.total >= 21 || hand.isBlackjack) {
      hand.isStood = true;
      this.completePlayerHand(hand);
      this.advanceActionQueue();
      return;
    }

    // Hit mid-turn — re-prompt same player
    this.promptPlayer(playerId);
  }

  private afterDealerCard(hand: Hand): void {
    if (this.dealQueue.length > 0) {
      this.advanceDealQueue();
      return;
    }

    if (shouldDealerDraw(hand.cards)) {
      this.awaiting = { kind: "dealer" };
      this.state.round!.nextCardRecipient = "dealer";
      this.state.table.phase = "dealer_action";
      this.state.availableActions = [];
      this.emit("DEALER_ACTION_REQUIRED", {
        instruction: this.instruction("deal_dealer", "DEAL TO DEALER"),
      });
      this.refreshInstruction();
      this.publishState();
      return;
    }

    this.completeDealerHand();
    this.settleRound();
  }

  private advanceDealQueue(): void {
    this.dealQueue.shift();
    const next = this.dealQueue[0];
    if (next) {
      this.awaiting = next;
      this.state.round!.nextCardRecipient = next.kind === "dealer" ? "dealer" : "player";
      this.refreshInstruction();
      this.publishState();
      return;
    }

    this.awaiting = null;
    this.state.round!.nextCardRecipient = null;

    // Refresh all hands after initial deal
    for (const player of this.state.players) {
      if (player.hands[0]) {
        player.hands[0] = refreshHand(player.hands[0]);
      }
    }
    this.state.dealer.hand = refreshHand(this.state.dealer.hand);

    // Skip blackjacks / twenty-ones — auto-complete
    this.actionQueue = this.actionQueue.filter((id) => {
      const hand = this.requirePlayer(id).hands[0];
      if (hand && (hand.isBlackjack || hand.total >= 21)) {
        hand.isStood = true;
        this.completePlayerHand(hand);
        return false;
      }
      return true;
    });

    this.advanceActionQueue();
  }

  private advanceActionQueue(): void {
    this.clearActionTimer();
    const nextId = this.actionQueue.shift();
    if (!nextId) {
      this.beginDealerPlay();
      return;
    }
    const hand = this.requirePlayer(nextId).hands[0];
    if (
      !hand ||
      hand.isResolved ||
      hand.isBlackjack ||
      hand.isBust ||
      hand.isStood ||
      hand.total >= 21
    ) {
      if (hand && !hand.isResolved && hand.total >= 21) {
        hand.isStood = true;
        this.completePlayerHand(hand);
      }
      this.advanceActionQueue();
      return;
    }
    this.promptPlayer(nextId);
  }

  private promptPlayer(playerId: string): void {
    const player = this.requirePlayer(playerId);
    const hand = player.hands[0];
    if (!hand) {
      this.advanceActionQueue();
      return;
    }

    if (hand.total >= 21 || hand.isBlackjack) {
      hand.isStood = true;
      this.completePlayerHand(hand);
      this.advanceActionQueue();
      return;
    }

    if (isBot(playerId)) {
      this.state.actingPlayerId = playerId;
      this.state.availableActions = [];
      this.state.table.phase = "player_action";
      this.state.actionClosesAt = new Date(Date.now() + BOT_ACTION_SECONDS * 1000).toISOString();
      this.awaiting = null;
      this.state.round!.nextCardRecipient = null;
      this.emit("PLAYER_ACTION_REQUIRED", {
        playerId,
        handId: hand.id,
        actions: ["hit", "stand"],
      });
      this.refreshInstruction("waiting_for_player");
      this.publishState();
      // Decide inside the 6s window so the orb countdown is visible.
      const thinkMs = 1800 + Math.random() * 3200;
      this.botActionTimer = setTimeout(() => {
        this.playBot(playerId);
      }, thinkMs);
      this.actionTimer = setTimeout(() => {
        if (this.state.table.phase === "player_action" && this.state.actingPlayerId === playerId) {
          this.playBot(playerId);
        }
      }, BOT_ACTION_SECONDS * 1000);
      return;
    }

    const actions = getAvailableActions({
      cards: hand.cards,
      credits: player.demoCredits,
      bet: player.currentBet,
      canSplit: false,
    }).filter((action) => action !== "split");

    this.state.availableActions = actions;
    this.state.table.phase = "player_action";
    this.state.actingPlayerId = playerId;
    this.state.actionClosesAt = new Date(Date.now() + LOCAL_ACTION_SECONDS * 1000).toISOString();
    this.awaiting = null;
    this.state.round!.nextCardRecipient = null;
    this.emit("PLAYER_ACTION_REQUIRED", {
      playerId,
      handId: hand.id,
      actions: this.state.availableActions,
    });
    this.refreshInstruction("waiting_for_player");
    this.publishState();

    this.actionTimer = setTimeout(() => {
      if (this.state.table.phase === "player_action" && this.state.actingPlayerId === playerId) {
        try {
          this.submitPlayerAction(playerId, "stand");
        } catch {
          hand.isStood = true;
          this.completePlayerHand(hand);
          this.advanceActionQueue();
        }
      }
    }, LOCAL_ACTION_SECONDS * 1000);
  }

  private playBot(playerId: string): void {
    if (this.state.table.phase !== "player_action" || this.state.actingPlayerId !== playerId) {
      return;
    }
    const hand = this.requirePlayer(playerId).hands[0];
    if (!hand) {
      this.advanceActionQueue();
      return;
    }
    const action: PlayerActionType = hand.total >= 17 ? "stand" : "hit";
    // Temporarily allow bot action via internal path
    this.state.availableActions = ["hit", "stand", "double"];
    try {
      this.submitPlayerAction(playerId, action);
    } catch {
      hand.isStood = true;
      this.completePlayerHand(hand);
      this.advanceActionQueue();
    }
  }

  private clearActionTimer(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }
  }

  private beginDealerPlay(): void {
    this.state.dealer.hand = revealHand(this.state.dealer.hand);
    this.state.availableActions = [];
    this.state.actingPlayerId = null;
    this.state.actionClosesAt = null;
    this.state.table.phase = "dealer_action";

    const anyAlive = this.state.players.some(
      (p) => p.hands[0] && !p.hands[0].isBust && !p.hands[0].isBlackjack,
    );
    if (!anyAlive) {
      this.completeDealerHand();
      this.settleRound();
      return;
    }

    if (shouldDealerDraw(this.state.dealer.hand.cards)) {
      this.awaiting = { kind: "dealer" };
      this.state.round!.nextCardRecipient = "dealer";
      this.emit("DEALER_ACTION_REQUIRED", {
        instruction: this.instruction("deal_dealer", "DEAL TO DEALER"),
      });
      this.refreshInstruction();
      this.publishState();
      return;
    }

    this.completeDealerHand();
    this.settleRound();
  }

  private completePlayerHand(hand: Hand): void {
    hand.isResolved = true;
    this.emit("HAND_COMPLETED", {
      handId: hand.id,
      owner: "player",
      total: hand.total,
      isBust: hand.isBust,
      isBlackjack: hand.isBlackjack,
    });
  }

  private completeDealerHand(): void {
    const hand = refreshHand(this.state.dealer.hand);
    hand.isStood = true;
    hand.isResolved = true;
    this.state.dealer.hand = hand;
    this.emit("HAND_COMPLETED", {
      handId: hand.id,
      owner: "dealer",
      total: hand.total,
      isBust: hand.isBust,
      isBlackjack: hand.isBlackjack,
    });
  }

  private settleRound(): void {
    if (!this.state.round) {
      return;
    }

    this.state.table.phase = "settling";
    this.state.dealer.hand = revealHand(this.state.dealer.hand);
    const settlements = [];

    for (const bet of this.state.round.bets) {
      const player = this.requirePlayer(bet.playerId);
      const hand = player.hands[0];
      if (!hand) {
        continue;
      }
      const settled = settleHand({
        playerCards: hand.cards,
        dealerCards: this.state.dealer.hand.cards,
        bet: player.currentBet,
        doubled: hand.isDoubled,
      });

      player.demoCredits += settled.payout;
      hand.outcome = settled.outcome;
      hand.payout = settled.payout;
      hand.isResolved = true;
      settlements.push({
        playerId: player.id,
        handId: hand.id,
        ...settled,
      });
    }

    this.state.lastSettlements = settlements;
    this.emit("ROUND_SETTLED", { settlements });
    this.emit("ROUND_COMPLETED", {
      roundId: this.state.round.id,
      outcomes: settlements.map((s) => s.outcome),
    });
    this.state.round.completedAt = new Date().toISOString();
    this.state.table.phase = "round_complete";
    this.awaiting = null;
    this.state.round.nextCardRecipient = null;
    this.state.availableActions = [];
    this.state.actingPlayerId = null;
    this.state.actionClosesAt = null;
    this.state.nextRoundAt = new Date(Date.now() + BETWEEN_ROUNDS_MS).toISOString();
    this.refreshInstruction("round_complete");
    this.publishState();
    this.nextRoundTimer = setTimeout(() => {
      this.openBetting();
    }, BETWEEN_ROUNDS_MS);
  }

  private refreshInstruction(kind?: DealerInstruction["kind"]): void {
    if (this.state.table.paused) {
      this.state.dealerInstruction = this.instruction("waiting_for_player", "TABLE PAUSED");
      return;
    }
    if (this.state.table.phase === "betting") {
      this.state.dealerInstruction = this.instruction("waiting_for_player", "PLACE YOUR BETS");
      return;
    }
    if (this.state.table.phase === "round_complete") {
      const local = this.state.lastSettlements.find((s) => s.playerId === DEFAULT_PLAYER_ID);
      const outcome = local?.outcome.toUpperCase() ?? "ROUND OVER";
      this.state.dealerInstruction = this.instruction("round_complete", outcome);
      return;
    }
    if (this.awaiting?.kind === "player") {
      this.state.dealerInstruction = this.instruction(
        kind === "hit" ? "hit" : kind === "double" ? "double" : "deal_player",
        kind === "hit" ? "HIT" : kind === "double" ? "DOUBLE" : "DEALING",
      );
      return;
    }
    if (this.awaiting?.kind === "dealer") {
      this.state.dealerInstruction = this.instruction("deal_dealer", "DEALER");
      return;
    }
    if (this.state.table.phase === "player_action") {
      const acting = this.state.players.find((p) => p.id === this.state.actingPlayerId);
      const label = acting && isBot(acting.id) ? `${acting.displayName.toUpperCase()}'S TURN` : "YOUR TURN";
      this.state.dealerInstruction = this.instruction("waiting_for_player", label);
      return;
    }
    this.state.dealerInstruction = this.instruction("waiting_for_player", "LIVE");
  }

  private instruction(kind: DealerInstruction["kind"], label: string): DealerInstruction {
    return { kind, label };
  }

  private requirePlayer(playerId: string): Player {
    const player = this.state.players.find((seat) => seat.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} is not seated`);
    }
    return player;
  }

  private emit<T extends GameEvent["type"]>(
    type: T,
    payload: Extract<GameEvent, { type: T }>["payload"],
  ): Extract<GameEvent, { type: T }> {
    const isStateSync = type === "GAME_STATE_UPDATED";
    if (!isStateSync) {
      this.sequence += 1;
      this.state.sequence = this.sequence;
    }
    // Cast: TS can't correlate `type` + `payload` through createGameEvent's generic.
    const event = createGameEvent({
      tableId: this.state.table.id,
      roundId: this.state.round?.id ?? null,
      sequence: this.sequence,
      type,
      payload,
    } as unknown as Parameters<typeof createGameEvent<T>>[0]);
    if (!isStateSync) {
      this.store.append(event);
      rewardSignalFromEvent(event);
    }
    for (const listener of this.listeners) {
      listener(event, this.getState());
    }
    return event;
  }

  private publishState(): void {
    this.emit("GAME_STATE_UPDATED", { state: this.getState() });
  }

  private createInitialState(tableId: string): GameState {
    const dealerProfile = getDemoDealer();
    const demoPlayers: Player[] = [
      {
        id: DEFAULT_PLAYER_ID,
        displayName: "You",
        seat: 1,
        demoCredits: STARTING_CREDITS,
        chipStack: [],
        hands: [],
        activeHandIndex: 0,
        currentBet: 0,
      },
      ...TABLEMATES.map((mate) => ({
        id: mate.id,
        displayName: mate.displayName,
        seat: mate.seat,
        demoCredits: STARTING_CREDITS,
        chipStack: [] as ChipValue[],
        hands: [],
        activeHandIndex: 0,
        currentBet: 0,
      })),
    ];
    return {
      table: {
        id: tableId,
        name: this.mode === "live" ? "Friends table" : "Live Blackjack — Private Table",
        phase: "closed",
        paused: false,
      },
      shoe: {
        id: DEFAULT_SHOE_ID,
        tableId,
        status: "disconnected",
        cardsDealt: 0,
      },
      round: null,
      dealer: {
        id: dealerProfile.id,
        profile: dealerProfile,
        hand: createEmptyHand("dealer-idle", "dealer"),
      },
      players: this.mode === "live" ? [] : demoPlayers,
      availableActions: [],
      dealerInstruction: { kind: "waiting_for_player", label: "WAITING" },
      lastSettlements: [],
      bettingClosesAt: null,
      actionClosesAt: null,
      nextRoundAt: null,
      actingPlayerId: null,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      sequence: 0,
    };
  }
}
