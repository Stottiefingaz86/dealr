"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PlayerActionType } from "@live-dealr/shared-types";

const STYLE: Record<
  string,
  { label: string; bg: string; ring: string; icon: string }
> = {
  hit: {
    label: "HIT",
    bg: "bg-[#2fbf6a]",
    ring: "shadow-[0_0_14px_rgba(47,191,106,0.5)]",
    icon: "+",
  },
  stand: {
    label: "STAND",
    bg: "bg-[#e04545]",
    ring: "shadow-[0_0_14px_rgba(224,69,69,0.5)]",
    icon: "✋",
  },
  double: {
    label: "DOUBLE",
    bg: "bg-[#f08a2a]",
    ring: "shadow-[0_0_14px_rgba(240,138,42,0.5)]",
    icon: "×2",
  },
  split: {
    label: "SPLIT",
    bg: "bg-[#3b82f6]",
    ring: "shadow-[0_0_14px_rgba(59,130,246,0.5)]",
    icon: "∥",
  },
  insurance: {
    label: "INS",
    bg: "bg-[#8b5cf6]",
    ring: "shadow-[0_0_14px_rgba(139,92,246,0.5)]",
    icon: "◈",
  },
};

/** Bold action callout rising from the seat avatar. */
export function SeatActionBurst({
  action,
  burstId,
}: {
  action: PlayerActionType | null;
  burstId: string | null;
}) {
  if (!action || !burstId) {
    return null;
  }
  const style = STYLE[action] ?? STYLE.hit!;

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={burstId}
        className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2"
        style={{ bottom: "calc(100% + 4px)" }}
        initial={{ opacity: 0, y: 10, scale: 0.7 }}
        animate={{ opacity: 1, y: -4, scale: 1 }}
        exit={{ opacity: 0, y: -24, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
      >
        <div
          className={`flex items-center gap-1 whitespace-nowrap rounded-full py-[3px] pl-2 pr-2.5 text-white ${style.bg} ${style.ring}`}
        >
          <span className="text-[11px] font-bold leading-none">{style.icon}</span>
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase">{style.label}</span>
        </div>
        <motion.span
          className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50"
          initial={{ opacity: 0.6, scale: 0.6 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
