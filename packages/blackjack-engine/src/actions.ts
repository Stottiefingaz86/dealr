import type { Card, PlayerActionType } from "@live-dealr/shared-types";
import { STANDARD_BLACKJACK_RULES, type BlackjackRules } from "./rules";
import { scoreHand } from "./scoring";

export interface ActionContext {
  cards: readonly Card[];
  credits: number;
  bet: number;
  canSplit?: boolean;
  alreadyActed?: boolean;
}

export function getAvailableActions(
  context: ActionContext,
  rules: BlackjackRules = STANDARD_BLACKJACK_RULES,
): PlayerActionType[] {
  const score = scoreHand(context.cards);
  if (score.isBust || score.isBlackjack || context.cards.length === 0) {
    return [];
  }

  const actions: PlayerActionType[] = ["hit", "stand"];

  const canDouble =
    context.cards.length >= rules.minCardsToDouble &&
    context.cards.length <= rules.maxCardsToDouble &&
    context.credits >= context.bet &&
    !context.alreadyActed;

  if (canDouble) {
    actions.push("double");
  }

  if (isSplitEligible(context.cards) && context.canSplit !== false && context.credits >= context.bet) {
    actions.push("split");
  }

  return actions;
}

export function isSplitEligible(cards: readonly Card[]): boolean {
  if (cards.length !== 2) {
    return false;
  }
  const first = cards[0];
  const second = cards[1];
  if (!first || !second) {
    return false;
  }
  return first.rank === second.rank;
}

export function isActionAllowed(
  action: PlayerActionType,
  context: ActionContext,
  rules: BlackjackRules = STANDARD_BLACKJACK_RULES,
): boolean {
  return getAvailableActions(context, rules).includes(action);
}
