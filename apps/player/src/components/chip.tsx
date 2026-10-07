"use client";

import { CHIP_ASSET } from "@/lib/chips";
import type { ChipValue } from "@live-dealr/shared-types";

export function Chip({
  value,
  size = 52,
  stacked = false,
}: {
  value: ChipValue;
  size?: number;
  stacked?: boolean;
  selected?: boolean;
}) {
  const asset = CHIP_ASSET[value];

  return (
    <span
      className={stacked ? "relative block" : "relative inline-flex"}
      style={{
        width: size,
        height: size,
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="pointer-events-none size-full select-none object-contain"
      />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-sans tabular-nums"
        style={{
          color: asset.ink,
          fontSize: Math.max(9, size * (asset.label.length > 2 ? 0.24 : 0.27)),
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {asset.label}
      </span>
    </span>
  );
}
