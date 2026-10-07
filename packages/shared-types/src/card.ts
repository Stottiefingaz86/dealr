export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  sequence: number;
  shoeId: string;
  detectedAt: string;
  hidden?: boolean;
}

export function formatCard(card: Pick<Card, "rank" | "suit">): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}
