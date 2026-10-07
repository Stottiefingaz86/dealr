import type { Card, Hand } from "@live-dealr/shared-types";
import { scoreHand } from "./scoring";

export function createEmptyHand(id: string, owner: Hand["owner"]): Hand {
  return {
    id,
    owner,
    cards: [],
    isStood: false,
    isDoubled: false,
    isSplit: false,
    isResolved: false,
    isBlackjack: false,
    isBust: false,
    isSoft: false,
    total: 0,
  };
}

export function withCard(hand: Hand, card: Card): Hand {
  const cards = [...hand.cards, card];
  const score = scoreHand(cards);
  return {
    ...hand,
    cards,
    total: score.total,
    isSoft: score.isSoft,
    isBlackjack: score.isBlackjack,
    isBust: score.isBust,
  };
}

export function revealHand(hand: Hand): Hand {
  const cards = hand.cards.map((card) => ({ ...card, hidden: false }));
  const score = scoreHand(cards);
  return {
    ...hand,
    cards,
    total: score.total,
    isSoft: score.isSoft,
    isBlackjack: score.isBlackjack,
    isBust: score.isBust,
  };
}

export function refreshHand(hand: Hand): Hand {
  const score = scoreHand(hand.cards);
  return {
    ...hand,
    total: score.total,
    isSoft: score.isSoft,
    isBlackjack: score.isBlackjack,
    isBust: score.isBust,
  };
}
