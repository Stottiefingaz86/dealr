"use client";

import type { Card, Suit } from "@live-dealr/shared-types";

/** Suit art borrowed for prototype faces only — no studio branding. */
const SUIT_SRC: Record<Suit, string> = {
  clubs: "/cards/suits/clubs.svg",
  diamonds: "/cards/suits/diamonds.svg",
  hearts: "/cards/suits/hearts.svg",
  spades: "/cards/suits/spades.svg",
};

const SIZE = {
  sm: { w: 42, h: 60, rank: 13, suit: 22, radius: 6 },
  md: { w: 56, h: 80, rank: 17, suit: 30, radius: 8 },
  lg: { w: 72, h: 102, rank: 22, suit: 40, radius: 10 },
} as const;

export function PlayingCard({ card, size = "md" }: { card: Card; size?: keyof typeof SIZE }) {
  const dim = SIZE[size];

  if (card.hidden) {
    return (
      <div
        className="relative overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
        style={{
          width: dim.w,
          height: dim.h,
          borderRadius: dim.radius,
          // Black lacquer with a soft sheen, white card edge like the faces
          background:
            "radial-gradient(ellipse 90% 70% at 50% 30%, #2a2a33, #111116 60%, #0a0a0e 100%)",
          border: "0.7px solid rgba(255,255,255,0.85)",
          padding: dim.w * 0.07,
        }}
        aria-label="Hole card"
      >
        {/* Gold frame */}
        <div
          className="relative size-full"
          style={{
            borderRadius: Math.max(2, dim.radius * 0.45),
            border: `${Math.max(1, dim.w * 0.02)}px solid transparent`,
            background:
              "linear-gradient(#141419, #141419) padding-box, linear-gradient(160deg, #f6dc8c, #a8782a 35%, #f3d37a 55%, #8a6220 80%, #e9c76a) border-box",
          }}
        >
          {/* Fine lattice so the black isn't flat */}
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              borderRadius: "inherit",
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(246,220,140,0.9) 0 0.6px, transparent 0.6px 4px), repeating-linear-gradient(-45deg, rgba(246,220,140,0.9) 0 0.6px, transparent 0.6px 4px)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/dealr-logo.png"
            alt=""
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "82%",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
            }}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const ink = isRed ? "#e6315f" : "#231f20";

  return (
    <div
      className="relative flex flex-col bg-white shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
      style={{
        width: dim.w,
        height: dim.h,
        borderRadius: dim.radius,
        border: "0.7px solid rgba(209,213,219,0.7)",
        padding: `${dim.h * 0.06}px ${dim.w * 0.1}px`,
      }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="font-semibold leading-none" style={{ color: ink, fontSize: dim.rank }}>
        {card.rank}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SUIT_SRC[card.suit]}
        alt=""
        className="absolute bottom-[12%] left-1/2 -translate-x-1/2 object-contain"
        style={{ width: dim.suit, height: dim.suit }}
        draggable={false}
      />
    </div>
  );
}
