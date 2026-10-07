"use client";

import { motion } from "framer-motion";
import type { TableSpot } from "@live-dealr/environments";

export function TableSpotMarker({
  spot,
  label,
  value,
  hint,
  tone = "default",
  empty = false,
}: {
  spot: TableSpot;
  label: string;
  value?: string;
  hint?: string;
  tone?: "default" | "win" | "lose";
  empty?: boolean;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: empty ? 0.45 : 1, scale: 1 }}
    >
      <div
        className={`flex flex-col items-center justify-center rounded-full border ${
          empty ? "size-14 border-white/20 bg-black/25" : "size-[5.2rem]"
        } ${
          empty
            ? ""
            : tone === "win"
              ? "border-primary/50 bg-black/45"
              : tone === "lose"
                ? "border-destructive/40 bg-black/45"
                : "border-white/18 bg-black/40"
        } shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-[8px]`}
      >
        <p className="text-[9px] tracking-[0.2em] text-white/55 uppercase">{label}</p>
        {!empty && value ? (
          <p className="font-display text-[2rem] leading-none tabular-nums text-white">{value}</p>
        ) : null}
        {!empty && hint ? <p className="text-[10px] text-white/45">{hint}</p> : null}
      </div>
    </motion.div>
  );
}
