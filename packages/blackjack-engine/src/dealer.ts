import type { Card } from "@live-dealr/shared-types";
import { STANDARD_BLACKJACK_RULES, type BlackjackRules } from "./rules";
import { scoreIncludingHidden } from "./scoring";

export function shouldDealerDraw(
  cards: readonly Card[],
  rules: BlackjackRules = STANDARD_BLACKJACK_RULES,
): boolean {
  const score = scoreIncludingHidden(cards);
  if (score.isBust) {
    return false;
  }
  if (score.total < 17) {
    return true;
  }
  if (score.total === 17 && score.isSoft && rules.dealerHitsSoft17) {
    return true;
  }
  return false;
}

export function dealerShouldStand(
  cards: readonly Card[],
  rules: BlackjackRules = STANDARD_BLACKJACK_RULES,
): boolean {
  return !shouldDealerDraw(cards, rules);
}
