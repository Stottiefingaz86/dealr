import type { Card, HandOutcome } from "@live-dealr/shared-types";
import { STANDARD_BLACKJACK_RULES, type BlackjackRules } from "./rules";
import { scoreHand, scoreIncludingHidden } from "./scoring";

export interface SettlementInput {
  playerCards: readonly Card[];
  dealerCards: readonly Card[];
  bet: number;
  doubled?: boolean;
}

export interface SettlementResult {
  outcome: HandOutcome;
  betAmount: number;
  payout: number;
  net: number;
}

export function settleHand(
  input: SettlementInput,
  rules: BlackjackRules = STANDARD_BLACKJACK_RULES,
): SettlementResult {
  const player = scoreHand(input.playerCards);
  const dealer = scoreIncludingHidden(input.dealerCards);
  const stake = input.doubled ? input.bet * 2 : input.bet;

  if (player.isBust) {
    return { outcome: "bust", betAmount: stake, payout: 0, net: -stake };
  }

  if (player.isBlackjack && !dealer.isBlackjack) {
    const payout = input.bet + input.bet * rules.blackjackPayout;
    return {
      outcome: "blackjack",
      betAmount: input.bet,
      payout,
      net: input.bet * rules.blackjackPayout,
    };
  }

  if (dealer.isBlackjack && !player.isBlackjack) {
    return { outcome: "lose", betAmount: stake, payout: 0, net: -stake };
  }

  if (player.isBlackjack && dealer.isBlackjack) {
    return { outcome: "push", betAmount: input.bet, payout: input.bet, net: 0 };
  }

  if (dealer.isBust) {
    return { outcome: "win", betAmount: stake, payout: stake * 2, net: stake };
  }

  if (player.total > dealer.total) {
    return { outcome: "win", betAmount: stake, payout: stake * 2, net: stake };
  }

  if (player.total < dealer.total) {
    return { outcome: "lose", betAmount: stake, payout: 0, net: -stake };
  }

  return { outcome: "push", betAmount: stake, payout: stake, net: 0 };
}
