"use client";

import dynamic from "next/dynamic";
import type { BackgroundEffectId, PlayerEnvironmentSettings } from "@live-dealr/shared-types";
import { sceneHue } from "@/lib/scene-hue";

/*
 * Full-screen GPU atmospheres behind the dealer. These are React Bits shader
 * backgrounds (reactbits.dev) vendored into ./fx — real WebGL, not CSS blobs.
 * Loaded lazily so the table paints first.
 */
const Plasma = dynamic(() => import("../fx/Plasma"), { ssr: false });
const Atmos = dynamic(() => import("../fx/Atmos"), { ssr: false });

const VALID: ReadonlySet<string> = new Set<BackgroundEffectId>([
  "none",
  "studio",
  "flames",
  "embers",
  "aurora",
  "smoke",
  "nebula",
  "ink",
  "plasma",
]);

export function BackgroundEffects({ settings }: { settings: PlayerEnvironmentSettings }) {
  const effect: BackgroundEffectId = VALID.has(settings.backgroundEffect)
    ? settings.backgroundEffect
    : "none";
  if (settings.reducedMotion || effect === "none") {
    return null;
  }
  const intensity =
    settings.animationIntensity === "high"
      ? 1
      : settings.animationIntensity === "low"
        ? 0.55
        : settings.animationIntensity === "off"
          ? 0
          : 0.8;
  if (intensity === 0) {
    return null;
  }

  const hue = sceneHue(settings);
  const bright = Math.min(1, Math.max(0.2, settings.lightingBrightness));

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
      style={{ opacity: (0.5 + intensity * 0.5) * (0.6 + bright * 0.4) }}
    >
      {effect === "plasma" ? (
        <div className="absolute inset-0">
          <Plasma
            color={hsl(hue, 85, 60)}
            speed={0.45}
            scale={1.3}
            opacity={0.55}
            mouseInteractive={false}
          />
        </div>
      ) : (
        <div className="absolute inset-0">
          <Atmos mode={effect} hue={hue} intensity={atmosIntensity(effect, bright)} speed={0.9} />
        </div>
      )}

      {/* Keep the dealer readable — darken behind her and towards the table */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 60% at 50% 45%, rgba(0,0,0,0.45), transparent 70%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

/** Preview swatch for the settings grid */
export function BackgroundEffectSwatch({ id }: { id: BackgroundEffectId }) {
  const styles: Record<BackgroundEffectId, string> = {
    none: "bg-[#14141c]",
    studio:
      "bg-[radial-gradient(ellipse_at_15%_60%,#ff3cac_0,transparent_40%),radial-gradient(ellipse_at_85%_60%,#2bd1ff_0,transparent_40%),linear-gradient(0deg,#5a2bff55,transparent_45%),linear-gradient(180deg,#0c0b12,#07070b)]",
    flames: "bg-[linear-gradient(0deg,#ffd166_0%,#ff6a00_30%,#7a1200_60%,#0a0a10_85%)]",
    embers:
      "bg-[radial-gradient(circle_at_30%_70%,#ffb347_0_1px,transparent_2px),radial-gradient(circle_at_65%_40%,#ff7a3a_0_1px,transparent_2px),linear-gradient(0deg,#3a1200,#0a0a10_60%)]",
    aurora: "bg-[linear-gradient(180deg,#0a0a14_10%,#7cff67_45%,#2ad4c8_65%,#0a0a14)]",
    smoke: "bg-[radial-gradient(circle_at_40%_40%,#6a5a8a,#1a1428_55%,#0a0a10_80%)]",
    nebula: "bg-[radial-gradient(circle_at_60%_40%,#ff6ad5_0,#5a2bff_35%,#050508_70%)]",
    ink: "bg-[conic-gradient(from_200deg,#2a0a40,#ff4fa3,#ffd27a,#3a7bff,#2a0a40)]",
    plasma: "bg-[radial-gradient(circle_at_50%_50%,#ff6a3a,#2a0a40_70%)]",
  };

  return (
    <span
      className={`size-8 rounded-full ${styles[id]} shadow-[0_0_14px_rgba(255,255,255,0.12)]`}
    />
  );
}

/** Per-mode brightness so dark moods stay moody and bright ones don't wash out the dealer. */
function atmosIntensity(effect: BackgroundEffectId, bright: number): number {
  const base: Partial<Record<BackgroundEffectId, number>> = {
    flames: 0.6,
    embers: 0.7,
    smoke: 0.75,
    nebula: 0.7,
    aurora: 0.75,
    ink: 0.6,
    studio: 0.85,
  };
  return (base[effect] ?? 0.7) + bright * 0.3;
}

function hslTuple(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = s / 100;
  const ll = l / 100;
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)];
}

function hsl(h: number, s: number, l: number): string {
  const [r, g, b] = hslTuple(h, s, l);
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
