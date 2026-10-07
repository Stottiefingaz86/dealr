export interface BlackjackRules {
  dealerHitsSoft17: boolean;
  blackjackPayout: number;
  minCardsToDouble: number;
  maxCardsToDouble: number;
}

export const STANDARD_BLACKJACK_RULES: BlackjackRules = {
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  minCardsToDouble: 2,
  maxCardsToDouble: 2,
};
