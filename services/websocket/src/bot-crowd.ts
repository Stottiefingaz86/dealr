import type { GameEvent, GameState, Player } from "@live-dealr/shared-types";
import type { ReactionKind } from "@live-dealr/realtime";

/**
 * Gives the demo tablemates a voice: light chatter in the stream, emotes on
 * their seats, and the odd throwable, all driven by what is happening at the
 * table. Everything is rate-limited so it reads like a real room, not spam.
 */

export interface CrowdReaction {
  senderId: string;
  senderName: string;
  kind: ReactionKind;
  emoji: string;
  fromSeat: number;
  toSeat: number | null;
}

interface CrowdSinks {
  say: (bot: Player, text: string) => void;
  react: (reaction: CrowdReaction) => void;
  /** The dealer's own channel bot — pinned-style notes from her. */
  dealerPost: (text: string) => void;
}

const DEALER_POSTS = [
  "Follow my profile for clips from tonight's table 🎬",
  "Game of the week: Lightning Blackjack — it's in my Picks",
  "New reel is up: three dealer busts in a row 😅",
  "Tap my name to see tonight's highlights",
  "Tips keep the table lively — thank you 💛",
  "I'm live Wed, Fri and Sat. Follow so you don't miss it",
  "Followers get my game picks every week",
  "Big win on the table? It'll be on my page later",
];

const IDLE_LINES = [
  "gl everyone",
  "this dealer is on fire tonight",
  "one more hand then I'm out… probably",
  "who else is up?",
  "come on 21",
  "feeling lucky",
  "dealer always gets 20 smh",
  "nice table",
  "lets gooo",
  "ggs",
  "anyone splitting 8s here?",
  "the 25 chip is my lucky one",
  "hi chat 👋",
  "stay on 12 vs 2? never",
  "double it",
];

const WIN_LINES = ["YES", "lets go!!", "ez", "pays for dinner", "called it", "🔥🔥🔥", "that's how it's done"];
const BJ_LINES = ["BLACKJACK", "ohhh baby", "21 baby", "natural!!"];
const LOSE_LINES = ["ugh", "nooo", "every time", "robbed", "painful", "next hand", "gg dealer"];
const BUST_LINES = ["busted 😩", "why did I hit", "too greedy", "ugh bust"];
const PUSH_LINES = ["push, fine", "tie, I'll take it"];
const DEALER_BUST_LINES = ["DEALER BUST", "she busts!!", "everyone wins lol", "yesss dealer bust"];
const DEALER_STRONG_LINES = ["dealer 20 again", "of course", "she's unreal", "brutal"];
const LOCAL_WIN_LINES = ["nice one", "gg", "well played", "clean", "that's the way"];
const LOCAL_BJ_LINES = ["blackjack!! congrats", "wow nice", "lucky!!", "21 👏"];
const BET_BIG_LINES = ["big bet", "whale alert", "bold", "someone's confident"];
const ACTION_LINES: Record<string, string[]> = {
  double: ["double down 👀", "ooh double", "brave"],
  split: ["split!", "splitting, respect"],
  hit: ["hit me", "one more"],
  stand: ["standing", "I'll stay"],
};

const EMOTES = ["👋", "🔥", "👏", "😂", "❤️", "😎"];
const WIN_EMOTES = ["🔥", "👏", "😎"];
const LOSE_EMOTES = ["😂", "👋"];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function isBot(player: Player): boolean {
  return player.id.startsWith("bot-");
}

export class BotCrowd {
  private state: GameState | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private emoteTimer: ReturnType<typeof setTimeout> | null = null;
  private dealerTimer: ReturnType<typeof setTimeout> | null = null;
  private dealerPostIndex = 0;
  private lastSpoke = new Map<string, number>();
  private seenEvents = new Set<string>();
  private readonly pending: Array<ReturnType<typeof setTimeout>> = [];

  constructor(private readonly sinks: CrowdSinks) {}

  start(initial: GameState): void {
    this.state = initial;
    this.scheduleIdle();
    this.scheduleEmote();
    this.scheduleDealerPost(20000);
  }

  stop(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.emoteTimer) clearTimeout(this.emoteTimer);
    if (this.dealerTimer) clearTimeout(this.dealerTimer);
    for (const t of this.pending) clearTimeout(t);
  }

  observe(event: GameEvent, state: GameState): void {
    this.state = state;
    if (this.seenEvents.has(event.id)) {
      return;
    }
    this.seenEvents.add(event.id);
    if (this.seenEvents.size > 500) {
      const [first] = this.seenEvents;
      if (first) this.seenEvents.delete(first);
    }

    switch (event.type) {
      case "BETTING_OPENED":
        this.maybe(0.35, () => this.sayFrom(this.randomBot(), pick(["gl all", "new hand", "here we go", "bets in"])));
        break;
      case "BET_PLACED": {
        if (event.payload.amount >= 100 && !event.payload.playerId.startsWith("bot-")) {
          this.maybe(0.5, () => this.sayFrom(this.randomBot(), pick(BET_BIG_LINES)));
        }
        break;
      }
      case "PLAYER_ACTION_RECEIVED": {
        const { playerId, action } = event.payload;
        if (playerId.startsWith("bot-")) {
          const bot = this.bot(playerId);
          if (bot && chance(0.25)) {
            this.sayFrom(bot, pick(ACTION_LINES[action] ?? ["ok"]));
          }
        } else if (action === "double" || action === "split") {
          this.maybe(0.6, () => this.sayFrom(this.randomBot(), pick(ACTION_LINES[action] ?? ["👀"])));
        }
        break;
      }
      case "HAND_COMPLETED": {
        if (event.payload.owner === "dealer") {
          if (event.payload.isBust) {
            this.maybe(0.9, () => this.sayFrom(this.randomBot(), pick(DEALER_BUST_LINES)));
            this.maybe(0.6, () => this.emoteFrom(this.randomBot(), "🔥"), 900);
          } else if (event.payload.total >= 20) {
            this.maybe(0.6, () => this.sayFrom(this.randomBot(), pick(DEALER_STRONG_LINES)));
          }
        }
        break;
      }
      case "ROUND_SETTLED": {
        const bots = this.bots();
        let delay = 400;
        for (const settlement of event.payload.settlements) {
          const player = state.players.find((p) => p.id === settlement.playerId);
          if (!player) continue;
          const d = delay;
          delay += 500 + Math.random() * 700;

          if (isBot(player)) {
            const lines =
              settlement.outcome === "blackjack"
                ? BJ_LINES
                : settlement.outcome === "win"
                  ? WIN_LINES
                  : settlement.outcome === "bust"
                    ? BUST_LINES
                    : settlement.outcome === "push"
                      ? PUSH_LINES
                      : LOSE_LINES;
            const p = settlement.outcome === "blackjack" ? 0.95 : settlement.outcome === "push" ? 0.3 : 0.55;
            this.maybe(p, () => this.sayFrom(player, pick(lines)), d);
            const emotes = settlement.outcome === "win" || settlement.outcome === "blackjack" ? WIN_EMOTES : LOSE_EMOTES;
            this.maybe(0.5, () => this.emoteFrom(player, pick(emotes)), d + 300);
          } else {
            // Crowd reacts to the human
            if (settlement.outcome === "blackjack") {
              this.maybe(0.9, () => this.sayFrom(pick(bots), pick(LOCAL_BJ_LINES)), d);
              this.maybe(0.8, () => this.throwFrom(pick(bots), "🎉", player.seat), d + 500);
              this.maybe(0.5, () => this.throwFrom(pick(bots), "🌹", player.seat), d + 1300);
            } else if (settlement.outcome === "win") {
              this.maybe(0.55, () => this.sayFrom(pick(bots), pick(LOCAL_WIN_LINES)), d);
              this.maybe(0.35, () => this.throwFrom(pick(bots), pick(["🎉", "🌹", "🪙"]), player.seat), d + 600);
            } else if (settlement.outcome === "bust" || settlement.outcome === "lose") {
              this.maybe(0.25, () => this.sayFrom(pick(bots), pick(["unlucky", "next one", "F", "dealer's hot"])), d);
              this.maybe(0.15, () => this.throwFrom(pick(bots), "🍅", player.seat), d + 700);
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private scheduleDealerPost(firstWait?: number): void {
    const wait = firstWait ?? 55000 + Math.random() * 40000;
    this.dealerTimer = setTimeout(() => {
      const text = DEALER_POSTS[this.dealerPostIndex % DEALER_POSTS.length];
      this.dealerPostIndex += 1;
      if (text) this.sinks.dealerPost(text);
      this.scheduleDealerPost();
    }, wait);
  }

  private scheduleIdle(): void {
    const wait = 9000 + Math.random() * 14000;
    this.idleTimer = setTimeout(() => {
      const bot = this.randomBot();
      if (bot) this.sayFrom(bot, pick(IDLE_LINES));
      this.scheduleIdle();
    }, wait);
  }

  private scheduleEmote(): void {
    const wait = 12000 + Math.random() * 16000;
    this.emoteTimer = setTimeout(() => {
      const bot = this.randomBot();
      if (bot) {
        if (chance(0.2)) {
          const target = this.randomBot(bot.id);
          if (target) this.throwFrom(bot, pick(["🌹", "🪙", "❄️"]), target.seat);
        } else {
          this.emoteFrom(bot, pick(EMOTES));
        }
      }
      this.scheduleEmote();
    }, wait);
  }

  private maybe(p: number, fn: () => void, delay = 0): void {
    if (!chance(p)) return;
    const t = setTimeout(() => {
      fn();
      const i = this.pending.indexOf(t);
      if (i >= 0) this.pending.splice(i, 1);
    }, delay + Math.random() * 400);
    this.pending.push(t);
  }

  private sayFrom(bot: Player | undefined, text: string): void {
    if (!bot) return;
    const now = Date.now();
    const last = this.lastSpoke.get(bot.id) ?? 0;
    if (now - last < 2500) {
      return;
    }
    this.lastSpoke.set(bot.id, now);
    this.sinks.say(bot, text);
  }

  private emoteFrom(bot: Player | undefined, emoji: string): void {
    if (!bot) return;
    this.sinks.react({
      senderId: bot.id,
      senderName: bot.displayName,
      kind: "emote",
      emoji,
      fromSeat: bot.seat,
      toSeat: null,
    });
  }

  private throwFrom(bot: Player | undefined, emoji: string, toSeat: number): void {
    if (!bot || bot.seat === toSeat) return;
    this.sinks.react({
      senderId: bot.id,
      senderName: bot.displayName,
      kind: "throw",
      emoji,
      fromSeat: bot.seat,
      toSeat,
    });
  }

  private bots(): Player[] {
    return (this.state?.players ?? []).filter(isBot);
  }

  private bot(id: string): Player | undefined {
    return this.bots().find((b) => b.id === id);
  }

  private randomBot(excludeId?: string): Player | undefined {
    const pool = this.bots().filter((b) => b.id !== excludeId);
    return pool.length ? pick(pool) : undefined;
  }
}
