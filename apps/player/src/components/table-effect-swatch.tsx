"use client";

import type { TableEffectId } from "@live-dealr/shared-types";

/** Preview tile for the Table FX picker — a tiny slab with the effect on it. */
export function TableEffectSwatch({ id, hue }: { id: TableEffectId; hue: number }) {
  const h2 = (hue + 40) % 360;
  const styles: Record<TableEffectId, React.CSSProperties> = {
    aurora: {
      background: `radial-gradient(circle at 25% 35%, hsla(${hue},90%,60%,0.7), transparent 55%), radial-gradient(circle at 75% 70%, hsla(${h2},90%,60%,0.6), transparent 55%), #0a0a10`,
    },
    grid: {
      backgroundImage: `linear-gradient(hsla(${hue},90%,80%,0.6) 1px, transparent 1px), linear-gradient(90deg, hsla(${hue},90%,80%,0.6) 1px, transparent 1px), radial-gradient(circle at 50% 0%, hsla(${hue},95%,60%,0.6), #0a0a10 70%)`,
      backgroundSize: "7px 7px, 7px 7px, 100% 100%",
    },
    nebula: {
      background: `radial-gradient(circle at 30% 40%, hsla(${(hue + 320) % 360},90%,55%,0.8), transparent 50%), radial-gradient(circle at 70% 60%, hsla(${(hue + 190) % 360},90%,55%,0.7), transparent 50%), #07070c`,
    },
    ripple: {
      background: `repeating-radial-gradient(circle at 50% 0%, hsla(${hue},90%,75%,0.55) 0 1px, transparent 1px 7px), #0a0a10`,
    },
    plasma: {
      background: `conic-gradient(from 0deg, hsla(${hue},95%,60%,0.9), hsla(${(hue + 120) % 360},95%,60%,0.9), hsla(${(hue + 240) % 360},95%,60%,0.9), hsla(${hue},95%,60%,0.9))`,
      filter: "blur(1px)",
    },
    dust: {
      background: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0 0.6px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.8) 0 0.6px, transparent 1px), radial-gradient(circle at 45% 80%, rgba(255,255,255,0.7) 0 0.6px, transparent 1px), radial-gradient(circle at 50% 20%, hsla(${hue},90%,60%,0.75), transparent 60%), #0a0a10`,
    },
  };
  return (
    <span
      className="block h-6 w-9 rounded-[4px] border border-white/15 shadow-[0_0_14px_rgba(255,255,255,0.1)]"
      style={styles[id]}
    />
  );
}
