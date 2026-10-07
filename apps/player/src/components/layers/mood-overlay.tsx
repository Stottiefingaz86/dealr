"use client";

import { ANIMATION_INTENSITY } from "@live-dealr/environments";
import type { PlayerEnvironmentSettings } from "@live-dealr/shared-types";
import { sceneHue } from "@/lib/scene-hue";

/**
 * Hue mood wash over the room. Sits BELOW the dealer (z-2 < z-3) — nothing
 * is ever composited on top of her.
 */
export function MoodOverlay({ settings }: { settings: PlayerEnvironmentSettings }) {
  const motion = settings.reducedMotion ? 0 : ANIMATION_INTENSITY[settings.animationIntensity];
  if (motion === 0 && !settings.lightingBrightness) {
    return null;
  }

  const hue = sceneHue(settings);
  const bright = Math.min(1, Math.max(0.2, settings.lightingBrightness));
  const pulse = settings.lightingPulse && motion > 0;
  const opacity = 0.14 + bright * 0.28;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      aria-hidden
      style={{ opacity }}
    >
      {/* Edge vignette tint — soft-light keeps faces readable */}
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% 0%, hsla(${hue}, 90%, 58%, 0.95), transparent 55%),
            radial-gradient(ellipse 55% 70% at 0% 45%, hsla(${(hue + 25) % 360}, 85%, 52%, 0.7), transparent 50%),
            radial-gradient(ellipse 55% 70% at 100% 48%, hsla(${(hue + 340) % 360}, 80%, 50%, 0.65), transparent 50%),
            radial-gradient(ellipse 80% 45% at 50% 100%, hsla(${hue}, 70%, 42%, 0.55), transparent 55%)
          `,
          animation: pulse
            ? `mood-breathe ${8 / Math.max(motion, 0.2)}s ease-in-out infinite`
            : undefined,
        }}
      />

      {/* Floating light orbs — screen blend = glow without blocking video */}
      <div
        className="absolute -left-[8%] top-[12%] size-[42vmin] rounded-full mix-blend-screen blur-3xl"
        style={{
          background: `radial-gradient(circle, hsla(${hue}, 95%, 62%, 0.55), transparent 68%)`,
          animation: pulse
            ? `mood-orb-a ${11 / Math.max(motion, 0.2)}s ease-in-out infinite`
            : undefined,
        }}
      />
      <div
        className="absolute -right-[10%] top-[28%] size-[36vmin] rounded-full mix-blend-screen blur-3xl"
        style={{
          background: `radial-gradient(circle, hsla(${(hue + 48) % 360}, 90%, 60%, 0.45), transparent 68%)`,
          animation: pulse
            ? `mood-orb-b ${14 / Math.max(motion, 0.2)}s ease-in-out infinite`
            : undefined,
        }}
      />
      <div
        className="absolute bottom-[8%] left-[28%] size-[48vmin] rounded-full mix-blend-screen blur-[56px]"
        style={{
          background: `radial-gradient(circle, hsla(${(hue + 200) % 360}, 70%, 55%, 0.22), transparent 70%)`,
          animation: pulse
            ? `mood-orb-c ${17 / Math.max(motion, 0.2)}s ease-in-out infinite`
            : undefined,
        }}
      />

      {/* Fine dust / sparkle particles */}
      {motion > 0 ? (
        <div
          className="absolute inset-0 mix-blend-screen opacity-50"
          style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 12% 22%, hsla(${hue}, 100%, 85%, 0.7), transparent),
              radial-gradient(1px 1px at 28% 58%, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 46% 18%, hsla(${(hue + 30) % 360}, 100%, 80%, 0.55), transparent),
              radial-gradient(1px 1px at 62% 72%, rgba(255,255,255,0.35), transparent),
              radial-gradient(1.5px 1.5px at 78% 34%, hsla(${hue}, 100%, 88%, 0.6), transparent),
              radial-gradient(1px 1px at 88% 64%, rgba(255,255,255,0.4), transparent),
              radial-gradient(1px 1px at 18% 78%, hsla(${(hue + 50) % 360}, 90%, 75%, 0.4), transparent),
              radial-gradient(1.5px 1.5px at 54% 42%, rgba(255,255,255,0.5), transparent)
            `,
            backgroundSize: "100% 100%",
            animation: `mood-sparkle ${22 / Math.max(motion, 0.2)}s linear infinite`,
          }}
        />
      ) : null}
    </div>
  );
}
