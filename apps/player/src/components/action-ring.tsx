"use client";

import type { PlayerActionType } from "@live-dealr/shared-types";

/** Compact bottom dock — stays clear of the seat pad. */
export function ActionRing({
  available,
  onAction,
  size = "md",
}: {
  available: PlayerActionType[];
  onAction: (action: PlayerActionType) => void;
  size?: "sm" | "md";
}) {
  const can = (action: PlayerActionType) => available.includes(action);

  return (
    <div
      className={`pointer-events-auto mx-auto flex w-full max-w-md items-center justify-center ${
        size === "sm" ? "gap-1.5" : "gap-2.5"
      }`}
    >
      <ActionButton
        label="Double"
        size={size}
        sub="x2"
        color="bg-[#f08a2a]"
        disabled={!can("double")}
        onClick={() => onAction("double")}
      />
      <ActionButton
        label="Hit"
        size={size}
        sub="+"
        color="bg-[#2fbf6a]"
        disabled={!can("hit")}
        onClick={() => onAction("hit")}
      />
      <ActionButton
        label="Stand"
        size={size}
        sub="—"
        color="bg-[#e04545]"
        disabled={!can("stand")}
        onClick={() => onAction("stand")}
      />
      <ActionButton
        label="Split"
        size={size}
        sub="∥"
        color="bg-[#3b82f6]"
        disabled={!can("split")}
        onClick={() => onAction("split")}
      />
    </div>
  );
}

function ActionButton({
  label,
  sub,
  color,
  disabled,
  onClick,
  size,
}: {
  label: string;
  sub: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
  size: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-full text-white shadow-[0_10px_24px_rgba(0,0,0,0.45)] disabled:opacity-25 ${
        sm ? "size-[2.6rem]" : "size-[3.65rem]"
      } ${color}`}
    >
      <span className={`font-bold leading-none ${sm ? "text-sm" : "text-base"}`}>{sub}</span>
      <span className={`mt-0.5 font-semibold tracking-wide uppercase ${sm ? "text-[7px]" : "text-[9px]"}`}>
        {label}
      </span>
    </button>
  );
}
