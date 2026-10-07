"use client";

import confettiLib from "canvas-confetti";
import { playRedeemSfx, unlockAudio } from "@/lib/chip-sound";

type ConfettiOptions = Parameters<typeof confettiLib>[0];
type ConfettiInstance = (opts?: ConfettiOptions) => Promise<null> | null;

let cached: ConfettiInstance | null = null;

/** Own canvas pinned on top of everything (drawers, modals, table plane). */
function instance(): ConfettiInstance | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-dealr-confetti", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "2147483646",
  });
  document.body.appendChild(canvas);
  cached = confettiLib.create(canvas, { resize: true, useWorker: true }) as ConfettiInstance;
  return cached;
}

function fire(opts: ConfettiOptions) {
  const run = instance();
  if (!run) {
    return;
  }
  try {
    run(opts);
  } catch {
    // cosmetic only
  }
}

const COLORS = [
  "#ff4d6d",
  "#ff9f1c",
  "#ffd60a",
  "#f0c43a",
  "#2ec4b6",
  "#4cc9f0",
  "#7b2cbf",
  "#f72585",
  "#80ed99",
  "#ffffff",
];

/** Blackjack win: cannons from both bottom corners + centre eruption. */
export function fireWinConfetti(big = false) {
  unlockAudio();
  playRedeemSfx();

  const base = {
    colors: COLORS,
    ticks: 260,
    gravity: 0.95,
    decay: 0.92,
    scalar: 1.05,
    disableForReducedMotion: true,
  } satisfies ConfettiOptions;

  // Centre eruption straight up
  fire({ ...base, particleCount: big ? 160 : 110, angle: 90, spread: 70, startVelocity: 78, origin: { x: 0.5, y: 1.05 } });
  // Side cannons angled inward
  fire({ ...base, particleCount: 80, angle: 62, spread: 58, startVelocity: 72, origin: { x: 0, y: 1 } });
  fire({ ...base, particleCount: 80, angle: 118, spread: 58, startVelocity: 72, origin: { x: 1, y: 1 } });

  window.setTimeout(() => {
    fire({ ...base, particleCount: 60, angle: 75, spread: 50, startVelocity: 66, origin: { x: 0.2, y: 1.05 } });
    fire({ ...base, particleCount: 60, angle: 105, spread: 50, startVelocity: 66, origin: { x: 0.8, y: 1.05 } });
  }, 180);

  window.setTimeout(() => {
    // Big slow flakes drifting down
    fire({
      ...base,
      particleCount: big ? 70 : 45,
      angle: 90,
      spread: 160,
      startVelocity: 35,
      gravity: 0.6,
      scalar: 1.6,
      shapes: ["circle", "square"],
      origin: { x: 0.5, y: 0.9 },
    });
  }, 380);

  if (big) {
    // Blackjack: sustained stream for ~1.2s
    const end = Date.now() + 1200;
    const stream = () => {
      fire({ ...base, particleCount: 6, angle: 60, spread: 40, startVelocity: 60, origin: { x: 0, y: 1 } });
      fire({ ...base, particleCount: 6, angle: 120, spread: 40, startVelocity: 60, origin: { x: 1, y: 1 } });
      if (Date.now() < end) {
        requestAnimationFrame(stream);
      }
    };
    window.setTimeout(stream, 500);
  }
}

const CLAIM_COLORS = ["#f0c43a", "#ffffff", "#fef3c7", "#fde68a", "#2fbf6a"] as const;

function originFromElement(el: HTMLElement | null): { x: number; y: number } {
  if (!el || typeof window === "undefined") return { x: 0.5, y: 0.55 };
  const r = el.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
  };
}

/** BOL-style claim burst from the redeem button + side cannons. */
export function fireClaimConfetti(originEl?: HTMLElement | null) {
  unlockAudio();
  playRedeemSfx();

  const origin = originFromElement(originEl ?? null);
  const colors = [...CLAIM_COLORS];

  fire({
    particleCount: 70,
    startVelocity: 38,
    spread: 70,
    ticks: 200,
    gravity: 0.9,
    scalar: 0.9,
    origin,
    colors,
    disableForReducedMotion: true,
  });

  window.setTimeout(() => {
    fire({
      particleCount: 35,
      angle: 60,
      spread: 55,
      origin: { x: Math.max(0, origin.x - 0.15), y: origin.y },
      colors,
      disableForReducedMotion: true,
    });
    fire({
      particleCount: 35,
      angle: 120,
      spread: 55,
      origin: { x: Math.min(1, origin.x + 0.15), y: origin.y },
      colors,
      disableForReducedMotion: true,
    });
  }, 120);
}
