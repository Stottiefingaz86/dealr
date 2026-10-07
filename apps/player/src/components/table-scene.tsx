"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ANIMATION_INTENSITY } from "@live-dealr/environments";
import type {
  Card,
  ChipValue,
  PlayerActionType,
  PlayerEnvironmentSettings,
  TableEffectId,
  TablePhase,
} from "@live-dealr/shared-types";
import { TABLE_EFFECTS } from "@live-dealr/shared-types";
import type { BackgroundEffectId } from "@live-dealr/shared-types";
import dynamic from "next/dynamic";

const Atmos = dynamic(() => import("./fx/Atmos"), { ssr: false });
import { Chip } from "./chip";
import { PlayingCard } from "./playing-card";
import { SeatActionBurst } from "./seat-action-burst";
import { TurnOrb } from "./turn-orb";
import { PlayerAvatar } from "./player-avatar";
import { ChromaKeyVideo } from "./layers/chroma-key-video";
import { sceneHue } from "@/lib/scene-hue";
import {
  dealerFrameFor,
  REFERENCE_FRAME_WIDTH,
  useContainerSize,
  type DealerFrame,
} from "./layers/dealer-video-layer";

/* ------------------------------------------------------------------ */
/* Geometry — one perspective plane, everything on it inherits depth   */
/* ------------------------------------------------------------------ */

const TILT = 50;
const PERSPECTIVE = 1250;
/**
 * The table slab, expressed in *dealer-feed units* (fractions of the video frame's
 * width/height, before tilt). Anchoring to the feed — not the viewport — means the
 * overlay stays glued to where the real table and real cards are in the camera shot.
 */
const PLANE_V = { left: -0.09, width: 1.18, top: 0.72, height: 0.94 };
/** Tighter slab on phones so all 5 seats stay inside the cropped feed. */
const PLANE_V_COMPACT = { left: 0.02, width: 0.96, top: 0.72, height: 0.94 };

/**
 * Seat 1 = local (centre). Desktop arc uses the full slab; phone arc is tighter
 * so every hand stays on-screen (no off-table crop).
 */
/** Local seat higher on the slab so the bet pad sits above the bottom chip tray. */
const SEAT_POS: ReadonlyArray<readonly [number, number]> = [
  [50, 34],
  [30, 32],
  [70, 32],
  [14, 28],
  [86, 28],
];
const SEAT_POS_COMPACT: ReadonlyArray<readonly [number, number]> = [
  [50, 38],
  [32, 36],
  [68, 36],
  [18, 32],
  [82, 32],
];
const DEALER = { x: 50, y: 12 };
/** How long the bet pad takes to open, swallow the chips and close. */
const PAD_CLOSE_SECONDS = 1.2;

let compactSeats = false;

/** Used by docks / throw aiming that sample seat layout outside the scene. */
export function setSeatLayoutCompact(compact: boolean) {
  compactSeats = compact;
}

export function seatGeometry(seat: number) {
  const layout = compactSeats ? SEAT_POS_COMPACT : SEAT_POS;
  const [x, y] = layout[seat - 1] ?? [50, 56];
  // Slight inward lean for the outer seats so cards point at the dealer.
  const angle = (x - 50) * 0.35;
  return {
    angle,
    spot: { x, y },
    cards: { x, y },
    // Identity tag (avatar + name + bet) sits just in front of the hand.
    tag: { x, y: y + 14 },
  };
}

/* ------------------------------------------------------------------ */

export interface SceneSeat {
  seat: number;
  displayName: string | null;
  avatarUrl?: string | null;
  isLocal: boolean;
  chips: ChipValue[];
  bet: number;
  cards: Card[];
  handTotal: string | null;
  isActing: boolean;
  turnProgress: number;
  turnSeconds: number | null;
  actionBurst: { action: PlayerActionType; id: string } | null;
  menuOpen: boolean;
  /** Hide the identity tag (a screen-space dock is standing in for it). */
  hideTag?: boolean;
  onAvatarClick: () => void;
}

export function TableScene({
  settings,
  phase,
  seats,
  dealerCards,
  dealerTotal,
  canBet,
  onBet,
  dealerVideoRef,
}: {
  settings: PlayerEnvironmentSettings;
  phase: TablePhase | undefined;
  seats: SceneSeat[];
  dealerCards: Card[];
  dealerTotal: string | null;
  canBet: boolean;
  onBet: () => void;
  /** Keyed dealer <video>; reflected on the glass so she reads as standing at the table. */
  dealerVideoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const motionLevel = settings.reducedMotion ? 0 : ANIMATION_INTENSITY[settings.animationIntensity];
  const hue = sceneHue(settings);
  const bright = Math.min(1, Math.max(0.2, settings.lightingBrightness));
  const animate = motionLevel > 0;
  const betting = phase === "betting";
  const rootRef = useRef<HTMLDivElement>(null);
  const { w, h } = useContainerSize(rootRef);
  const ready = w > 0 && h > 0;
  const frame: DealerFrame = ready
    ? dealerFrameFor(w, h)
    : { left: 0, top: 0, width: 0, height: 0 };
  // Scale with the feed so phones shrink and desktops stay readable — but keep a
  // modest cap. Tracking ultrawide frame width at 2×+ made pads swallow the UI.
  const cropped = ready && w <= 640;
  useEffect(() => {
    setSeatLayoutCompact(cropped);
    return () => setSeatLayoutCompact(false);
  }, [cropped]);

  const unit = ready
    ? Math.max(
        cropped ? 0.55 : 0.75,
        Math.min(cropped ? 0.95 : 1.35, frame.width / REFERENCE_FRAME_WIDTH),
      )
    : 1;
  const planeV = cropped ? PLANE_V_COMPACT : PLANE_V;
  const plane = {
    left: frame.left + frame.width * planeV.left,
    width: frame.width * planeV.width,
    top: frame.top + frame.height * planeV.top,
    height: frame.height * planeV.height,
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[6] overflow-clip"
      style={{
        perspective: PERSPECTIVE * unit,
        perspectiveOrigin: `50% ${frame.top + frame.height * 0.1}px`,
      }}
    >
      {ready ? (
        <div
          className="absolute"
          style={{
            left: plane.left,
            width: plane.width,
            top: plane.top,
            height: plane.height,
            transformOrigin: "50% 0%",
            transform: `rotateX(${TILT}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <Felt
            hue={hue}
            bright={bright}
            animate={animate}
            effect={normalizeTableEffect(settings.tableEffect)}
            background={settings.backgroundEffect}
          />

          {/* Light beam travelling around the slab edge */}
          {animate ? <EdgeBeam hue={hue} bright={bright} /> : null}

          {/* Dealer reflection + contact shadow on the glass */}
          {dealerVideoRef ? (
            <DealerReflection videoRef={dealerVideoRef} frame={frame} planeTop={plane.top} />
          ) : null}

          {/* Dealer hand — far centre of the felt */}
          <FlatGroup x={DEALER.x} y={DEALER.y} scale={unit}>
            <CardFan cards={dealerCards} size="md" total={dealerTotal} />
          </FlatGroup>

          {seats.map((seat) => (
            <Seat
              key={seat.seat}
              model={seat}
              betting={betting}
              canBet={canBet && seat.isLocal}
              onBet={onBet}
              hue={hue}
              scale={unit}
            />
          ))}
        </div>
      ) : null}

      {/* Phones: the feed is cropped, so seats outside the shot get a slim strip */}
      {cropped ? <OffscreenSeats seats={seats} plane={plane} /> : null}
    </div>
  );
}

/** Seats whose plane position lands outside the viewport on a cropped feed. */
function OffscreenSeats({
  seats,
  plane,
}: {
  seats: SceneSeat[];
  plane: { left: number; width: number; top: number };
}) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const out = seats.filter((seat) => {
    if (!seat.displayName && !seat.isLocal) return false;
    const geo = seatGeometry(seat.seat);
    const x = plane.left + (plane.width * geo.spot.x) / 100;
    return x < 24 || x > vw - 24;
  });
  if (out.length === 0) return null;
  const left = out.filter((s) => seatGeometry(s.seat).spot.x < 50);
  const right = out.filter((s) => seatGeometry(s.seat).spot.x >= 50);
  const pill = (seat: SceneSeat) => (
    <div
      key={seat.seat}
      className={`flex items-center gap-1.5 rounded-full border bg-[#0d0d13]/90 py-[3px] pl-[3px] pr-2 ${
        seat.isActing ? "border-[#f0c43a]/70" : "border-white/12"
      }`}
    >
      <PlayerAvatar
        name={seat.displayName ?? (seat.isLocal ? "You" : "?")}
        src={seat.avatarUrl}
        isActing={seat.isActing}
        size={20}
      />
      <span className="text-[10px] font-medium text-white/85">
        {seat.displayName ?? (seat.isLocal ? "You" : "")}
      </span>
      {seat.handTotal ? (
        <span className="rounded-full bg-[#1f8f4e] px-1.5 text-[10px] font-bold tabular-nums text-white">
          {seat.handTotal}
        </span>
      ) : seat.bet > 0 ? (
        <span className="text-[10px] font-semibold tabular-nums text-white/80">${seat.bet}</span>
      ) : null}
    </div>
  );
  return (
    <div
      className="pointer-events-none absolute inset-x-2 flex justify-between"
      style={{ top: plane.top + 6 }}
    >
      <div className="flex flex-col gap-1">{left.map(pill)}</div>
      <div className="flex flex-col items-end gap-1">{right.map(pill)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Felt + rail + printed markings                                      */
/* ------------------------------------------------------------------ */

/**
 * Plain rectangular slab — dark glass with a living surface on it.
 * No felt, no rail, no casino print. The chosen effect is the surface.
 */
function normalizeTableEffect(id: string | undefined): TableEffectId {
  return TABLE_EFFECTS.some((item) => item.id === id) ? (id as TableEffectId) : "dust";
}

function Felt({
  hue,
  bright,
  animate,
  effect,
  background,
}: {
  hue: number;
  bright: number;
  animate: boolean;
  effect: TableEffectId;
  background: BackgroundEffectId;
}) {
  const h2 = (hue + 40) % 360;
  const h3 = (hue + 300) % 360;
  const showGrid = effect === "aurora" || effect === "grid" || effect === "ripple";
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-t-[18px]"
      style={{
        background: `
          radial-gradient(ellipse 60% 50% at 50% 0%, hsla(${hue}, 50%, 28%, ${0.55 * bright}), transparent 70%),
          linear-gradient(180deg, #0e0e16 0%, #08080d 50%, #050508 100%)
        `,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.1),
          inset 2px 0 0 hsla(${hue}, 80%, 70%, ${0.35 * bright}),
          inset -2px 0 0 hsla(${hue}, 80%, 70%, ${0.35 * bright}),
          inset 0 0 90px rgba(0,0,0,0.6),
          0 0 60px hsla(${hue}, 80%, 50%, ${0.25 * bright}),
          0 40px 120px rgba(0,0,0,0.8)
        `,
      }}
    >
      {/* The room reflects in the glass: same shader, flipped, dimmed, fading towards the player */}
      {animate && background !== "none" && background !== "plasma" ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.38 * (0.6 + 0.4 * bright),
            transform: "scaleY(-1)",
            filter: "blur(2px) saturate(0.85)",
            maskImage:
              "linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35) 40%, transparent 85%)",
            WebkitMaskImage:
              "linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35) 40%, transparent 85%)",
          }}
        >
          <Atmos
            mode={background}
            hue={hue}
            intensity={0.9}
            speed={0.9}
            resolution={0.5}
            targetFps={24}
          />
        </div>
      ) : null}

      {/* Aurora — soft light drifting under the glass */}
      {effect === "aurora" || effect === "plasma" || effect === "dust" ? (
        <div
          className="absolute inset-0"
          style={{
            animation:
              effect === "plasma" && animate ? "slab-hue-spin 30s linear infinite" : undefined,
          }}
        >
          <div
            className="absolute -left-[10%] top-[10%] h-[60%] w-[55%] rounded-full"
            style={{
              background: `radial-gradient(circle, hsla(${hue}, 90%, 60%, ${(effect === "plasma" ? 0.6 : 0.42) * bright}), transparent 65%)`,
              filter: "blur(40px)",
              animation: animate
                ? `slab-blob-a ${effect === "plasma" ? 14 : 28}s ease-in-out infinite`
                : undefined,
            }}
          />
          <div
            className="absolute right-[-8%] top-[25%] h-[55%] w-[50%] rounded-full"
            style={{
              background: `radial-gradient(circle, hsla(${h2}, 90%, 60%, ${(effect === "plasma" ? 0.5 : 0.34) * bright}), transparent 65%)`,
              filter: "blur(44px)",
              animation: animate
                ? `slab-blob-b ${effect === "plasma" ? 17 : 34}s ease-in-out infinite`
                : undefined,
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[30%] h-[50%] w-[45%] rounded-full"
            style={{
              background: `radial-gradient(circle, hsla(${h3}, 85%, 55%, ${(effect === "plasma" ? 0.36 : 0.16) * bright}), transparent 65%)`,
              filter: "blur(48px)",
              animation: animate
                ? `slab-blob-c ${effect === "plasma" ? 20 : 40}s ease-in-out infinite`
                : undefined,
            }}
          />
        </div>
      ) : null}

      {/* Nebula — deep colour clouds + fine star dust */}
      {effect === "nebula" ? (
        <>
          <div
            className="absolute inset-[-10%]"
            style={{
              background: `
                radial-gradient(ellipse 35% 45% at 25% 35%, hsla(${(hue + 320) % 360}, 90%, 55%, ${0.45 * bright}), transparent 70%),
                radial-gradient(ellipse 40% 40% at 70% 55%, hsla(${(hue + 190) % 360}, 90%, 55%, ${0.4 * bright}), transparent 70%),
                radial-gradient(ellipse 30% 35% at 50% 20%, hsla(${hue}, 95%, 65%, ${0.5 * bright}), transparent 70%)
              `,
              filter: "blur(30px)",
              animation: animate ? "slab-blob-a 36s ease-in-out infinite" : undefined,
            }}
          />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.9), transparent 60%),
                radial-gradient(1px 1px at 32% 68%, rgba(255,255,255,0.7), transparent 60%),
                radial-gradient(1.5px 1.5px at 58% 36%, rgba(255,255,255,0.9), transparent 60%),
                radial-gradient(1px 1px at 76% 74%, rgba(255,255,255,0.7), transparent 60%),
                radial-gradient(1px 1px at 88% 18%, rgba(255,255,255,0.8), transparent 60%),
                radial-gradient(1px 1px at 44% 86%, rgba(255,255,255,0.6), transparent 60%),
                radial-gradient(1.5px 1.5px at 20% 48%, rgba(255,255,255,0.8), transparent 60%),
                radial-gradient(1px 1px at 66% 12%, rgba(255,255,255,0.7), transparent 60%)
              `,
              animation: animate ? "fx-twinkle 5s ease-in-out infinite" : undefined,
            }}
          />
        </>
      ) : null}

      {/* Ripple — slow pulses rolling out from the dealer's end */}
      {effect === "ripple" && animate
        ? [0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute left-1/2 top-0 aspect-square w-[160%] rounded-full"
              style={{
                border: `1.5px solid hsla(${hue}, 90%, 75%, ${0.45 * bright})`,
                boxShadow: `0 0 18px hsla(${hue}, 90%, 65%, ${0.3 * bright})`,
                transformOrigin: "50% 50%",
                // Hide the top arc so each ring reads as a wave rolling down the slab, not a circle on the horizon
                maskImage: "linear-gradient(180deg, transparent 42%, black 60%)",
                WebkitMaskImage: "linear-gradient(180deg, transparent 42%, black 60%)",
                animation: `table-ripple 9s cubic-bezier(0.2, 0.6, 0.3, 1) ${i * 3}s infinite`,
              }}
            />
          ))
        : null}

      {/* Dust — fine motes drifting slowly through the aura */}
      {effect === "dust" ? (
        <>
          {[0, 1, 2].map((layer) => (
            <div
              key={layer}
              className="absolute inset-[-10%]"
              style={{
                opacity: 0.55 - layer * 0.12,
                backgroundImage: `
                  radial-gradient(1px 1px at ${7 + layer * 13}% ${18 + layer * 7}%, rgba(255,255,255,0.95), transparent 70%),
                  radial-gradient(1.4px 1.4px at ${28 + layer * 9}% ${62 - layer * 11}%, rgba(255,255,255,0.8), transparent 70%),
                  radial-gradient(1px 1px at ${52 - layer * 7}% ${34 + layer * 15}%, rgba(255,255,255,0.9), transparent 70%),
                  radial-gradient(1.2px 1.2px at ${71 + layer * 5}% ${78 - layer * 9}%, rgba(255,255,255,0.75), transparent 70%),
                  radial-gradient(1px 1px at ${88 - layer * 11}% ${22 + layer * 13}%, rgba(255,255,255,0.85), transparent 70%),
                  radial-gradient(1.6px 1.6px at ${40 + layer * 15}% ${88 - layer * 6}%, rgba(255,255,255,0.7), transparent 70%),
                  radial-gradient(1px 1px at ${16 + layer * 21}% ${46 + layer * 5}%, rgba(255,255,255,0.8), transparent 70%),
                  radial-gradient(1.2px 1.2px at ${62 + layer * 9}% ${12 + layer * 17}%, rgba(255,255,255,0.9), transparent 70%)
                `,
                backgroundSize: `${46 + layer * 18}% ${46 + layer * 18}%`,
                animation: animate
                  ? `table-dust ${38 + layer * 14}s linear infinite${layer % 2 ? " reverse" : ""}`
                  : undefined,
                filter: layer === 2 ? "blur(0.6px)" : undefined,
              }}
            />
          ))}
        </>
      ) : null}

      {/* Grid lives on the plane, so it converges with the real perspective */}
      {showGrid ? (
        <div
          className="absolute inset-0"
          style={{
            opacity: effect === "grid" ? 0.3 + bright * 0.3 : 0.1 + bright * 0.1,
            backgroundImage: `
              linear-gradient(hsla(${hue}, 90%, 80%, 0.55) 1px, transparent 1px),
              linear-gradient(90deg, hsla(${hue}, 90%, 80%, 0.4) 1px, transparent 1px)
            `,
            backgroundSize: effect === "grid" ? "90px 90px" : "120px 120px",
            backgroundPosition: "center top",
            maskImage:
              "radial-gradient(ellipse 70% 90% at 50% 40%, #000 30%, rgba(0,0,0,0.35) 70%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 90% at 50% 40%, #000 30%, rgba(0,0,0,0.35) 70%, transparent 100%)",
            animation: animate
              ? `slab-grid-flow ${effect === "grid" ? 10 : 40}s linear infinite`
              : undefined,
          }}
        />
      ) : null}
      {effect === "grid" ? (
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 40% at 50% 0%, hsla(${hue}, 95%, 60%, ${0.35 * bright}), transparent 70%),
              linear-gradient(180deg, transparent 60%, hsla(${(hue + 40) % 360}, 90%, 55%, ${0.18 * bright}) 100%)
            `,
          }}
        />
      ) : null}

      {/* Micro noise so it reads as a material */}
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "120px 120px",
        }}
      />

      {/* Lit far edge */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, hsla(${hue}, 95%, 75%, ${0.9 * bright}) 30%, hsla(${hue}, 95%, 85%, ${bright}) 50%, hsla(${hue}, 95%, 75%, ${0.9 * bright}) 70%, transparent)`,
          boxShadow: `0 0 18px hsla(${hue}, 95%, 70%, ${0.7 * bright}), 0 0 50px hsla(${hue}, 95%, 65%, ${0.4 * bright})`,
        }}
      />
    </div>
  );
}

/**
 * Mirror of the keyed dealer lying on the slab. The plane's far edge sits at
 * z=0 so 1 screen px == 1 plane px there; we size the mirror in vh to match
 * the dealer layer's framing and let the tilt foreshorten it.
 */
/**
 * A single bright band of light that slides around the rim of the slab. The ring is a
 * border-only mask; a huge conic gradient spins behind it so the beam sweeps the perimeter.
 */
function EdgeBeam({ hue, bright }: { hue: number; bright: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[18px]"
      style={{
        padding: 1.5,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
        opacity: 0.5 + 0.5 * bright,
      }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[260%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 290deg, hsla(${hue}, 95%, 72%, 0.35) 325deg, hsla(${(hue + 40) % 360}, 95%, 85%, 0.95) 348deg, #fff 354deg, transparent 360deg)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 11, ease: "linear", repeat: Infinity }}
      />
    </div>
  );
}

function DealerReflection({
  videoRef,
  frame,
  planeTop,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  frame: DealerFrame;
  planeTop: number;
}) {
  const visible = Math.max(0, planeTop - frame.top); // portion of her above the table edge, px
  return (
    <>
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 overflow-hidden"
        style={{
          height: visible,
          width: frame.width,
          opacity: 0.42,
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 45%, transparent 80%)",
          WebkitMaskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.25) 45%, transparent 80%)",
        }}
      >
        <ChromaKeyVideo
          videoRef={videoRef}
          className="absolute left-0 w-full"
          style={{
            height: frame.height,
            top: visible,
            transformOrigin: "50% 0%",
            transform: "scaleY(-1)",
            filter: "blur(1.5px) saturate(0.7) brightness(0.9)",
          }}
        />
      </div>
      {/* Contact shadow where she meets the table */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[14%] w-[34%] -translate-x-1/2 -translate-y-1/3 rounded-[50%]"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.6), transparent 70%)",
          filter: "blur(10px)",
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Lies flat on the felt. */
function FlatGroup({
  x,
  y,
  rotate = 0,
  scale = 1,
  children,
  className = "",
}: {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
}

/** Stands upright on the felt, facing the camera (bottom edge on the anchor). */
function Standee({
  x,
  y,
  scale = 1,
  children,
  className = "",
}: {
  x: number;
  y: number;
  scale?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transformOrigin: "50% 100%",
        transform: `translate(-50%, -100%) rotateX(${-TILT}deg) scale(${scale})`,
        // Flat: keeps buttons inside hit-testable (Chrome mis-targets z-indexed
        // children inside preserve-3d subtrees).
        transformStyle: "flat",
      }}
    >
      {children}
    </div>
  );
}

function CardFan({
  cards,
  size,
  total,
}: {
  cards: Card[];
  size: "sm" | "md";
  total: string | null;
}) {
  if (cards.length === 0) {
    return null;
  }
  // Tighten the fan as it grows so big hands stay inside their own zone.
  const base = size === "md" ? -24 : -18;
  const overlap = cards.length <= 2 ? base : base - Math.min(cards.length - 2, 3) * 6;
  return (
    <div className="relative flex items-end" style={{ transformStyle: "preserve-3d" }}>
      <AnimatePresence initial={false}>
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            className="relative"
            style={{
              marginLeft: index === 0 ? 0 : overlap,
              zIndex: index + 1,
              transform: `translateZ(${index * 0.6}px)`,
            }}
            initial={{ y: -140, x: 40, opacity: 0, rotate: -14 }}
            animate={{
              y: 0,
              x: 0,
              opacity: 1,
              rotate: (index - (cards.length - 1) / 2) * 4,
            }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            <PlayingCard card={card} size={size} />
          </motion.div>
        ))}
      </AnimatePresence>
      {total ? (
        <div
          className="absolute bottom-full left-1/2 mb-1"
          style={{
            transformOrigin: "50% 100%",
            transform: `translateX(-50%) rotateX(${-TILT}deg)`,
          }}
        >
          <span
            className={`block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-md ${
              total === "BUST"
                ? "bg-[#e04545]"
                : total === "BJ"
                  ? "bg-[#f0c43a] text-black"
                  : "bg-[#1f9d55]"
            }`}
          >
            {total}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seat: bet spot (betting only) + cards + standing avatar             */
/* ------------------------------------------------------------------ */

function Seat({
  model,
  betting,
  canBet,
  onBet,
  hue,
  scale,
}: {
  model: SceneSeat;
  betting: boolean;
  canBet: boolean;
  onBet: () => void;
  hue: number;
  scale: number;
}) {
  const geo = seatGeometry(model.seat);
  const sc = scale;
  const vacant = !model.displayName && !model.isLocal;
  const name = model.displayName ?? (model.isLocal ? "You" : "");
  const hasBet = model.chips.length > 0;

  // Empty seats stay invisible — no lock disks, Open pills, or "?" placeholders.
  // Keep a zero-size anchor so throws can still target the seat slot.
  if (vacant) {
    return (
      <Standee x={geo.tag.x} y={geo.tag.y} scale={sc}>
        <div data-seat-drop={model.seat} data-seat-anchor={model.seat} className="size-1 opacity-0" />
      </Standee>
    );
  }

  return (
    <>
      {/* Seat zone — soft pool of light grouping avatar, cards and name */}
      <FlatGroup x={geo.spot.x} y={geo.spot.y} scale={sc}>
        <motion.div
          className="h-[150px] w-[190px] rounded-[50%]"
          animate={{
            background: model.isActing
              ? "radial-gradient(ellipse at 50% 50%, rgba(240,196,58,0.3), rgba(240,196,58,0.08) 55%, transparent 72%)"
              : model.isLocal
                ? `radial-gradient(ellipse at 50% 50%, hsla(${hue}, 80%, 65%, 0.26), hsla(${hue}, 80%, 65%, 0.06) 55%, transparent 72%)`
                : `radial-gradient(ellipse at 50% 50%, hsla(${hue}, 70%, 65%, 0.16), hsla(${hue}, 70%, 65%, 0.03) 55%, transparent 72%)`,
          }}
          transition={{ duration: 0.6 }}
        />
      </FlatGroup>

      {/* AR bet pad — materialises for betting, opens + swallows chips when the round starts */}
      <AnimatePresence>
        {betting ? (
          <FlatGroup
            key="pad"
            x={geo.spot.x}
            y={geo.spot.y}
            scale={sc}
            className="pointer-events-auto"
          >
            <motion.button
              type="button"
              disabled={!canBet}
              onClick={onBet}
              aria-label={canBet ? "Place chip" : "Bet spot"}
              className={`relative flex size-[76px] items-center justify-center rounded-full ${
                canBet ? "cursor-pointer" : "cursor-default"
              }`}
              style={{ transformStyle: "flat" }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              // Exit: ring widens → hole irises open → chips drop → hole closes
              exit={{
                scale: [1, 1.14, 1.14, 0.3],
                opacity: [1, 1, 1, 0],
                transition: {
                  duration: PAD_CLOSE_SECONDS,
                  times: [0, 0.3, 0.72, 1],
                  ease: "easeInOut",
                },
              }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              {/* Dish — dark glass well the chips sit in */}
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle at 50% 50%, hsla(${hue}, 60%, 45%, ${model.isLocal ? 0.38 : 0.28}), hsla(${hue}, 50%, 20%, 0.35) 60%, rgba(8,8,12,0.2) 100%)`,
                  boxShadow: `0 0 26px hsla(${hue}, 85%, 60%, ${model.isLocal ? 0.3 : 0.18})`,
                }}
              />
              {/* Spinning gradient stroke — the rim is a moving band of light, not a flat yellow ring */}
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{
                  padding: model.isLocal ? 2 : 1.5,
                  background: model.isLocal
                    ? `conic-gradient(from 0deg, transparent 0deg, hsla(${hue}, 95%, 70%, 0.2) 70deg, hsla(${(hue + 40) % 360}, 95%, 75%, 0.9) 150deg, #fff 185deg, hsla(${hue}, 95%, 70%, 0.6) 230deg, transparent 320deg)`
                    : `conic-gradient(from 0deg, transparent 0deg, hsla(${hue}, 90%, 72%, 0.75) 110deg, hsla(${(hue + 40) % 360}, 90%, 80%, 0.95) 170deg, hsla(${hue}, 90%, 72%, 0.5) 230deg, transparent 320deg)`,
                  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  maskComposite: "exclude",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: model.isLocal ? 4.5 : 7, ease: "linear", repeat: Infinity }}
              />
              {/* Soft static base ring so the stroke never reads as broken */}
              <span
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: `inset 0 0 0 1px hsla(${hue}, 70%, 85%, 0.22)` }}
              />
              {/* Invite pulse — only on your empty pad while bets are open */}
              {canBet && !hasBet ? (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ border: `1.5px solid hsla(${(hue + 40) % 360}, 95%, 75%, 0.7)` }}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: [0.9, 1.45], opacity: [0.7, 0] }}
                  transition={{
                    duration: 2.2,
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 0.6,
                  }}
                />
              ) : null}
              {/* Aperture — the table "opens" here when the round starts */}
              <motion.span
                className="absolute inset-[6%] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 50% 45%, #000 55%, rgba(0,0,0,0.85) 75%, transparent 100%)",
                  boxShadow: `inset 0 0 0 1px hsla(${hue}, 90%, 75%, 0.6), inset 0 8px 18px rgba(0,0,0,0.9), 0 0 24px hsla(${hue}, 90%, 60%, 0.5)`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 0, opacity: 0 }}
                exit={{
                  scale: [0, 1, 1, 0],
                  opacity: [0, 1, 1, 0],
                  transition: {
                    duration: PAD_CLOSE_SECONDS,
                    times: [0, 0.3, 0.72, 1],
                    ease: "easeInOut",
                  },
                }}
              />
              {!hasBet && canBet ? (
                <span className="relative text-[9px] tracking-[0.22em] text-white/45 uppercase">
                  Bet
                </span>
              ) : null}
            </motion.button>
          </FlatGroup>
        ) : null}
      </AnimatePresence>

      {/* Chips stack on the spot; fall through when the pad opens */}
      <FlatGroup x={geo.spot.x} y={geo.spot.y} scale={sc}>
        <AnimatePresence>
          {betting && hasBet ? (
            <motion.div
              key="chips"
              className="relative"
              style={{ transformStyle: "preserve-3d" }}
              // Drop through the open aperture, mid-way through the pad's close
              exit={{
                y: [0, -3, 22],
                scale: [1, 1.03, 0.2],
                opacity: [1, 1, 0],
                filter: ["brightness(1)", "brightness(1)", "brightness(0.2)"],
                transition: {
                  delay: PAD_CLOSE_SECONDS * 0.3,
                  duration: PAD_CLOSE_SECONDS * 0.42,
                  times: [0, 0.2, 1],
                  ease: "easeIn",
                },
              }}
            >
              <ChipStack chips={model.chips} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </FlatGroup>

      {/* Player cards — land on the spot where the chips went in */}
      <FlatGroup x={geo.cards.x} y={geo.cards.y} rotate={-geo.angle} scale={sc}>
        <CardFan cards={model.cards} size="md" total={model.handTotal} />
      </FlatGroup>

      {/* Identity tag — avatar + name + wager */}
      <Standee x={geo.tag.x} y={geo.tag.y} scale={sc} className="pointer-events-auto">
        <div
          className="relative flex flex-col items-center"
          data-seat-drop={model.seat}
          data-seat-anchor={model.seat}
          style={{ transformStyle: "flat", visibility: model.hideTag ? "hidden" : "visible" }}
        >
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
            <SeatActionBurst
              action={model.actionBurst?.action ?? null}
              burstId={model.actionBurst?.id ?? null}
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              model.onAvatarClick();
            }}
            aria-label={model.isLocal ? "Your reactions" : `${name} profile`}
            className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[3px] pl-[3px] pr-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.6)] ${
              model.isActing
                ? "border-[#f0c43a]/80 bg-[#1c170a]"
                : model.menuOpen
                  ? "border-[#f0c43a]/80 bg-[#0d0d13]"
                  : model.isLocal
                    ? "border-[#f0c43a]/45 bg-[#0d0d13]"
                    : "border-white/15 bg-[#0d0d13]"
            }`}
          >
            <span className="relative flex size-[30px] items-center justify-center">
              <AnimatePresence>
                {model.isActing ? (
                  <TurnOrb
                    progress={model.turnProgress}
                    seconds={model.turnSeconds}
                    avatarSize={28}
                  />
                ) : null}
              </AnimatePresence>
              <PlayerAvatar
                name={name || "?"}
                src={model.avatarUrl}
                isLocal={model.isLocal}
                isActing={model.isActing}
                size={28}
              />
            </span>
            <span
              className={`max-w-[5.5rem] truncate text-[11px] leading-none ${
                model.isLocal || model.isActing
                  ? "font-semibold text-[#f0c43a]"
                  : "font-medium text-white/90"
              }`}
            >
              {name}
            </span>
            <AnimatePresence>
              {model.bet > 0 ? (
                <motion.span
                  key="bet"
                  className="text-[11px] font-semibold tabular-nums leading-none text-white"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  ${model.bet}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        </div>
      </Standee>
    </>
  );
}

/** Real 3D stack — each chip lifted on Z so perspective does the work. */
function ChipStack({ chips }: { chips: ChipValue[] }) {
  const visible = chips.slice(-8);
  return (
    <div className="relative size-[44px]" style={{ transformStyle: "preserve-3d" }}>
      <AnimatePresence initial={false}>
        {visible.map((chip, index) => (
          <motion.div
            key={`${chip}-${index}`}
            className="absolute inset-0"
            style={{
              transform: `translateZ(${index * 3.2}px)`,
              transformStyle: "preserve-3d",
            }}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 26 }}
          >
            {/* chip edge shadow */}
            <span
              className="absolute inset-0 rounded-full"
              style={{
                transform: "translateZ(-1.6px)",
                background: "rgba(0,0,0,0.55)",
                filter: "blur(1px)",
              }}
            />
            <Chip value={chip} size={44} stacked />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
