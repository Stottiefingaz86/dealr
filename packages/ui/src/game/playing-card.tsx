"use client";

import type { Card } from "@live-dealr/shared-types";
import { SUIT_SYMBOL } from "@live-dealr/shared-types";
import { cn } from "../lib/utils";

export function PlayingCard({
  card,
  size = "md",
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
}) {
  const frame = {
    sm: "h-[4.6rem] w-[3.15rem] rounded-lg p-1.5",
    md: "h-[5.8rem] w-[4rem] rounded-xl p-2",
    lg: "h-[7.2rem] w-[5rem] rounded-xl p-2",
  }[size];

  if (card.hidden) {
    return (
      <div
        className={cn(
          "border border-white/10 bg-[linear-gradient(165deg,#1a241f,#070b0a)] shadow-[0_12px_28px_rgba(0,0,0,0.5)]",
          frame,
        )}
        aria-label="Hole card"
      >
        <div className="flex size-full items-center justify-center">
          <div className="size-5 rounded-full border border-primary/40" />
        </div>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      className={cn(
        "flex flex-col justify-between border border-black/10 bg-[#f3eee4] text-[#16120c] shadow-[0_14px_30px_rgba(0,0,0,0.42)]",
        frame,
      )}
    >
      <div className={cn("leading-none font-semibold", size === "lg" ? "text-2xl" : "text-lg", isRed && "text-[#9a2b2b]")}>
        {card.rank}
        <span className="ml-0.5">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className={cn("self-end leading-none", size === "lg" ? "text-3xl" : "text-2xl", isRed ? "text-[#9a2b2b]" : "text-[#16120c]")}>
        {SUIT_SYMBOL[card.suit]}
      </div>
    </div>
  );
}
