"use client";

import type { TableSpot } from "@live-dealr/environments";
import type { ChipValue } from "@live-dealr/shared-types";
import { Chip } from "./chip";
import { formatMoney } from "@/lib/chips";

export function ChipStack({
  spot,
  chips,
  total,
}: {
  spot: TableSpot;
  chips: ChipValue[];
  total: number;
}) {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      <div className="relative h-16 w-16">
        {chips.length === 0 ? (
          <div className="size-16 rounded-full border border-dashed border-white/25" />
        ) : (
          chips.slice(-8).map((chip, index) => (
            <div
              key={`${chip}-${index}`}
              className="absolute left-1/2 -translate-x-1/2"
              style={{ bottom: index * 5 }}
            >
              <Chip value={chip} size={48} stacked />
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-center text-sm font-semibold tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
        {total > 0 ? `$${formatMoney(total)}` : "Bet"}
      </p>
    </div>
  );
}
