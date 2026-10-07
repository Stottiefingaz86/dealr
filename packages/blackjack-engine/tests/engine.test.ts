import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@live-dealr/shared-types";
import {
  getAvailableActions,
  isSplitEligible,
  scoreHand,
  settleHand,
  shouldDealerDraw,
  STANDARD_BLACKJACK_RULES,
  withCard,
  createEmptyHand,
} from "../src";

function card(rank: Rank, suit: Suit = "spades", hidden = false): Card {
  return {
    id: `${rank}-${suit}`,
    rank,
    suit,
    sequence: 1,
    shoeId: "SHOE-001",
    detectedAt: "2026-10-07T12:00:00.000Z",
    hidden,
  };
}

describe("scoreHand", () => {
  it("scores blackjack", () => {
    const score = scoreHand([card("A"), card("K")]);
    expect(score.total).toBe(21);
    expect(score.isBlackjack).toBe(true);
    expect(score.isSoft).toBe(true);
  });

  it("scores a soft hand", () => {
    const score = scoreHand([card("A"), card("6")]);
    expect(score.total).toBe(17);
    expect(score.isSoft).toBe(true);
    expect(score.isBlackjack).toBe(false);
  });

  it("converts ace to hard when needed", () => {
    const score = scoreHand([card("A"), card("6"), card("K")]);
    expect(score.total).toBe(17);
    expect(score.isSoft).toBe(false);
  });

  it("detects bust", () => {
    const score = scoreHand([card("10"), card("6"), card("8")]);
    expect(score.total).toBe(24);
    expect(score.isBust).toBe(true);
  });

  it("ignores hidden cards in the public total", () => {
    const score = scoreHand([card("A"), card("K", "hearts", true)]);
    expect(score.total).toBe(11);
    expect(score.isBlackjack).toBe(false);
  });
});

describe("actions", () => {
  it("allows hit, stand, and double on a two-card hand", () => {
    expect(
      getAvailableActions({
        cards: [card("5"), card("6")],
        credits: 100,
        bet: 25,
      }),
    ).toEqual(["hit", "stand", "double"]);
  });

  it("does not allow double without credits", () => {
    expect(
      getAvailableActions({
        cards: [card("5"), card("6")],
        credits: 10,
        bet: 25,
      }),
    ).toEqual(["hit", "stand"]);
  });

  it("detects split eligibility for matching ranks", () => {
    expect(isSplitEligible([card("8", "hearts"), card("8", "clubs")])).toBe(true);
    expect(isSplitEligible([card("8"), card("7")])).toBe(false);
  });

  it("returns no actions for blackjack or bust", () => {
    expect(
      getAvailableActions({ cards: [card("A"), card("K")], credits: 100, bet: 25 }),
    ).toEqual([]);
    expect(
      getAvailableActions({
        cards: [card("K"), card("Q"), card("5")],
        credits: 100,
        bet: 25,
      }),
    ).toEqual([]);
  });
});

describe("dealer draw rules (S17)", () => {
  it("hits 16 and stands on hard 17", () => {
    expect(shouldDealerDraw([card("10"), card("6")])).toBe(true);
    expect(shouldDealerDraw([card("10"), card("7")])).toBe(false);
  });

  it("stands on soft 17 by default", () => {
    expect(shouldDealerDraw([card("A"), card("6")])).toBe(false);
  });

  it("hits soft 17 when configured", () => {
    expect(
      shouldDealerDraw([card("A"), card("6")], {
        ...STANDARD_BLACKJACK_RULES,
        dealerHitsSoft17: true,
      }),
    ).toBe(true);
  });
});

describe("settlement", () => {
  it("pays 3:2 blackjack", () => {
    const result = settleHand({
      playerCards: [card("A"), card("K")],
      dealerCards: [card("9"), card("10")],
      bet: 20,
    });
    expect(result.outcome).toBe("blackjack");
    expect(result.net).toBe(30);
  });

  it("player bust loses", () => {
    const result = settleHand({
      playerCards: [card("K"), card("Q"), card("5")],
      dealerCards: [card("9"), card("8")],
      bet: 25,
    });
    expect(result.outcome).toBe("bust");
    expect(result.net).toBe(-25);
  });

  it("dealer bust wins", () => {
    const result = settleHand({
      playerCards: [card("10"), card("8")],
      dealerCards: [card("10"), card("6"), card("7")],
      bet: 25,
    });
    expect(result.outcome).toBe("win");
    expect(result.net).toBe(25);
  });

  it("equal totals push", () => {
    const result = settleHand({
      playerCards: [card("10"), card("8")],
      dealerCards: [card("9"), card("9")],
      bet: 25,
    });
    expect(result.outcome).toBe("push");
    expect(result.net).toBe(0);
  });
});

describe("hand mutation", () => {
  it("adds a passed-in card and never invents one", () => {
    const dealt = card("4", "diamonds");
    const next = withCard(createEmptyHand("h1", "player"), dealt);
    expect(next.cards).toEqual([dealt]);
    expect(next.total).toBe(4);
  });
});
