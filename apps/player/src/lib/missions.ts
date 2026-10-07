/**
 * Session missions — small goals you can hit while you play. Completing one unlocks
 * an emote / throwable or pays a cashback into your balance.
 */

export type MissionReward =
  | { kind: "emote"; id: string; emoji: string; label: string }
  | { kind: "throwable"; id: string; emoji: string; label: string }
  | { kind: "cashback"; amount: number };

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: MissionReward;
}

export interface MissionProgress {
  value: number;
  /** Set once the mission is completed, cleared when the reward is claimed */
  completedAt?: number;
  claimed?: boolean;
}

/** Things the table can tell the mission engine about. */
export type MissionSignal =
  | {
      type: "hand_settled";
      outcome: "win" | "lose" | "push" | "blackjack" | "bust";
      bet: number;
      net: number;
      doubled: boolean;
    }
  | { type: "bet_locked"; amount: number }
  | { type: "reaction" }
  | { type: "chat" }
  | { type: "tip"; amount: number };

export const MISSIONS: Mission[] = [
  {
    id: "streak-3",
    title: "Hot streak",
    description: "Win 3 hands in a row",
    target: 3,
    reward: { kind: "emote", id: "crown", emoji: "👑", label: "Crown emote" },
  },
  {
    id: "high-roller",
    title: "High roller",
    description: "Put $100 or more on a single hand",
    target: 1,
    reward: { kind: "cashback", amount: 10 },
  },
  {
    id: "natural",
    title: "Natural",
    description: "Hit a blackjack",
    target: 1,
    reward: { kind: "emote", id: "gem", emoji: "💎", label: "Diamond emote" },
  },
  {
    id: "double-win",
    title: "Doubled up",
    description: "Win a hand you doubled down on",
    target: 1,
    reward: { kind: "throwable", id: "dynamite", emoji: "🧨", label: "Dynamite throwable" },
  },
  {
    id: "regular",
    title: "Regular",
    description: "Play 10 hands this session",
    target: 10,
    reward: { kind: "cashback", amount: 15 },
  },
  {
    id: "hype",
    title: "Hype crew",
    description: "Send 5 reactions or throwables",
    target: 5,
    reward: { kind: "throwable", id: "moneybag", emoji: "💰", label: "Money bag throwable" },
  },
  {
    id: "comeback",
    title: "Comeback",
    description: "Win after losing 2 in a row",
    target: 1,
    reward: { kind: "emote", id: "rocket", emoji: "🚀", label: "Rocket emote" },
  },
  {
    id: "generous",
    title: "Generous",
    description: "Tip the dealer",
    target: 1,
    reward: { kind: "cashback", amount: 5 },
  },
];

export interface MissionBook {
  progress: Record<string, MissionProgress>;
  /** Internal counters the missions derive from */
  winStreak: number;
  lossStreak: number;
}

export const EMPTY_BOOK: MissionBook = { progress: {}, winStreak: 0, lossStreak: 0 };

function bump(book: MissionBook, id: string, by: number, set?: number): MissionBook {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) return book;
  const prev = book.progress[id] ?? { value: 0 };
  if (prev.completedAt || prev.claimed) return book;
  const value = Math.min(mission.target, set !== undefined ? set : prev.value + by);
  const next: MissionProgress = { ...prev, value };
  if (value >= mission.target) next.completedAt = Date.now();
  return { ...book, progress: { ...book.progress, [id]: next } };
}

export function advance(book: MissionBook, signal: MissionSignal): MissionBook {
  let b = book;
  switch (signal.type) {
    case "hand_settled": {
      const won = signal.outcome === "win" || signal.outcome === "blackjack";
      const lost = signal.outcome === "lose" || signal.outcome === "bust";
      b = bump(b, "regular", 1);
      if (signal.outcome === "blackjack") b = bump(b, "natural", 1);
      if (won && signal.doubled) b = bump(b, "double-win", 1);
      if (won && b.lossStreak >= 2) b = bump(b, "comeback", 1);
      const winStreak = won ? b.winStreak + 1 : 0;
      const lossStreak = lost ? b.lossStreak + 1 : 0;
      b = { ...b, winStreak, lossStreak };
      b = bump(b, "streak-3", 0, Math.max(b.progress["streak-3"]?.value ?? 0, winStreak));
      return b;
    }
    case "bet_locked":
      return signal.amount >= 100 ? bump(b, "high-roller", 1) : b;
    case "reaction":
      return bump(b, "hype", 1);
    case "tip":
      return bump(b, "generous", 1);
    case "chat":
      return b;
  }
}

export function claim(book: MissionBook, id: string): MissionBook {
  const prev = book.progress[id];
  if (!prev?.completedAt || prev.claimed) return book;
  return { ...book, progress: { ...book.progress, [id]: { ...prev, claimed: true } } };
}

export function claimable(book: MissionBook): Mission[] {
  return MISSIONS.filter((m) => {
    const p = book.progress[m.id];
    return Boolean(p?.completedAt) && !p?.claimed;
  });
}

export function rewardLabel(reward: MissionReward): string {
  return reward.kind === "cashback" ? `$${reward.amount} cashback` : reward.label;
}
