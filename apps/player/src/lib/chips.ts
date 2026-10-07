import type { ChipValue } from "@live-dealr/shared-types";

/** Spiffing `public/cards/chips/{1-5}.svg` mapped to Dealr denominations. */
export const CHIP_ASSET: Record<ChipValue, { src: string; label: string; ink: string }> = {
  1: { src: "/chips/1.svg", label: "1", ink: "#ffffff" },
  5: { src: "/chips/2.svg", label: "5", ink: "#ffffff" },
  25: { src: "/chips/3.svg", label: "25", ink: "#ffffff" },
  100: { src: "/chips/4.svg", label: "100", ink: "#ffffff" },
  500: { src: "/chips/5.svg", label: "500", ink: "#ffffff" },
};

/** @deprecated use CHIP_ASSET — kept for any leftover look references */
export const CHIP_LOOK = {
  1: { fill: "#e8e2d6", ink: "#1a1714", label: "1" },
  5: { fill: "#37ECA0", ink: "#0b1f1a", label: "5" },
  25: { fill: "#E9F936", ink: "#1a1a0a", label: "25" },
  100: { fill: "#a855f7", ink: "#f7f1e8", label: "100" },
  500: { fill: "#f43f5e", ink: "#f7f1e8", label: "500" },
} as const satisfies Record<ChipValue, { fill: string; ink: string; label: string }>;

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
