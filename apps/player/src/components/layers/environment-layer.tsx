"use client";

import { ANIMATION_INTENSITY } from "@live-dealr/environments";
import type { PlayerEnvironmentSettings } from "@live-dealr/shared-types";
import { sceneHue } from "@/lib/scene-hue";

/**
 * Cinematic room atmosphere behind the dealer — no felt, no table chrome.
 * Soft Hue washes + depth fog so the live feed feels staged in a lounge.
 */
export function EnvironmentLayer({ settings }: { settings: PlayerEnvironmentSettings }) {
  const motion = settings.reducedMotion ? 0 : ANIMATION_INTENSITY[settings.animationIntensity];
  const hue = sceneHue(settings);
  const bright = Math.min(1, Math.max(0.12, settings.lightingBrightness));
  const pulse = settings.lightingPulse && motion > 0;
  const speed = Math.max(motion, 0.2);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Deep void */}
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Distant wall tone */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, hsla(${hue}, 35%, 18%, ${0.55 * bright}), transparent 55%),
            radial-gradient(ellipse 90% 60% at 50% 110%, hsla(${(hue + 200) % 360}, 25%, 10%, 0.7), transparent 50%),
            linear-gradient(180deg, #0a0a10 0%, #06060a 45%, #040406 100%)
          `,
        }}
      />

      {/* Ceiling wash — Hue */}
      <div
        className="absolute inset-x-[-10%] top-[-15%] h-[70%]"
        style={{
          opacity: 0.45 + bright * 0.5,
          background: `
            radial-gradient(ellipse 70% 55% at 50% 0%, hsla(${hue}, 90%, ${52 + bright * 14}%, ${0.55 * bright}), transparent 62%),
            radial-gradient(ellipse 40% 45% at 18% 18%, hsla(${(hue + 32) % 360}, 80%, 50%, ${0.28 * bright}), transparent 60%),
            radial-gradient(ellipse 40% 45% at 82% 20%, hsla(${(hue + 328) % 360}, 75%, 48%, ${0.26 * bright}), transparent 60%)
          `,
          animation: pulse ? `hue-breathe ${8 / speed}s ease-in-out infinite` : undefined,
          filter: "blur(2px)",
        }}
      />

      {/* Side light blooms */}
      <div
        className="absolute -left-[18%] top-[10%] h-[55%] w-[42%] rounded-full blur-[80px]"
        style={{
          opacity: 0.25 + bright * 0.45,
          background: `hsla(${hue}, 92%, 56%, 0.55)`,
          animation: pulse ? `hue-lamp-left ${10 / speed}s ease-in-out infinite` : undefined,
        }}
      />
      <div
        className="absolute -right-[20%] top-[14%] h-[50%] w-[40%] rounded-full blur-[80px]"
        style={{
          opacity: 0.22 + bright * 0.4,
          background: `hsla(${(hue + 42) % 360}, 88%, 58%, 0.48)`,
          animation: pulse ? `hue-lamp-right ${12 / speed}s ease-in-out infinite` : undefined,
        }}
      />

      {/* Stage floor behind the table — dealer stands here */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% 55%, hsla(${hue}, 55%, 30%, ${0.22 * bright}), transparent 70%),
            linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 70%)
          `,
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 40%, transparent 35%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
