import type { Card, Rank } from "@live-dealr/shared-types";

export interface HandScore {
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
}

const RANK_VALUE: Record<Rank, number> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
};

export function scoreHand(cards: readonly Card[]): HandScore {
  const visible = cards.filter((card) => !card.hidden);
  let total = 0;
  let aces = 0;

  for (const card of visible) {
    total += RANK_VALUE[card.rank];
    if (card.rank === "A") {
      aces += 1;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  const isSoft = aces > 0 && total <= 21;
  const isBlackjack = visible.length === 2 && total === 21 && cards.length === 2 && !cards.some((c) => c.hidden);
  const isBust = total > 21;

  return { total, isSoft, isBlackjack, isBust };
}

export function scoreIncludingHidden(cards: readonly Card[]): HandScore {
  return scoreHand(cards.map((card) => ({ ...card, hidden: false })));
}
