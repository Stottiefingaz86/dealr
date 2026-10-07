import type { PlayerEnvironmentSettings } from "@live-dealr/shared-types";

/**
 * The hue every layer (background, dealer wash, table slab, bet pads) should tint with.
 *
 * Fire backgrounds refuse to go cold unless the room is clearly blue/purple — a pink or
 * amber room gets classic orange fire. The rest of the scene has to follow that, otherwise
 * you get orange flames behind a magenta table.
 */
export function sceneHue(
  settings: Pick<PlayerEnvironmentSettings, "lightingHue" | "backgroundEffect">,
): number {
  const h = ((settings.lightingHue % 360) + 360) % 360;
  if (settings.backgroundEffect === "flames" || settings.backgroundEffect === "embers")
    return fireHue(h);
  return h;
}

/** Map a lighting hue onto a range that still reads as fire (orange → gold → violet → blue). */
export function fireHue(h: number): number {
  if (h < 60 || h > 330) return 22; // warm/pink rooms → classic fire
  if (h < 180) return 40; // greens/yellows → golden fire
  return h; // blues/purples → coloured fire
}
