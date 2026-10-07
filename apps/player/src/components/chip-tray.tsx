"use client";

import { useEffect, useRef } from "react";
import type { ChipValue } from "@live-dealr/shared-types";
import { Chip } from "./chip";
import { playChipSelect, preloadChipSfx, unlockAudio } from "@/lib/chip-sound";

/** Chip selector — used inside the betting modal. */
export function ChipTray({
  selectedChip,
  onSelectChip,
  onUndo,
  onDouble,
  chipValues,
  canDouble,
  compact = false,
  size,
  minimal = false,
}: {
  selectedChip: ChipValue;
  onSelectChip: (value: ChipValue) => void;
  onUndo: () => void;
  onDouble: () => void;
  chipValues: readonly ChipValue[];
  canDouble: boolean;
  compact?: boolean;
  /** Explicit chip diameter in px (overrides compact). */
  size?: number;
  /** Chips only — no Undo / x2. */
  minimal?: boolean;
}) {
  const trayRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    unlockAudio();
    void preloadChipSfx();
  }, []);

  const chipSize = size ?? (compact ? 40 : 46);
  const tiny = chipSize <= 38;
  const sideBtn = `mb-0.5 flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 tracking-wide text-white/75 uppercase ${
    tiny ? "size-8 text-[8px]" : "size-10 text-[9px]"
  }`;

  return (
    <div className={`mx-auto flex w-full items-end justify-center pointer-events-auto ${tiny ? "gap-1" : "gap-1.5"}`}>
      {minimal ? null : (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            onUndo();
          }}
          className={sideBtn}
        >
          Undo
        </button>
      )}

      <div className={`flex items-end px-0.5 ${minimal ? "gap-2" : "gap-0.5"}`}>
        {chipValues.map((value) => {
          const selected = selectedChip === value;
          return (
            <button
              key={value}
              type="button"
              ref={(node) => {
                trayRefs.current[value] = node;
              }}
              onClick={() => {
                unlockAudio();
                onSelectChip(value);
                playChipSelect();
              }}
              className="relative flex flex-col items-center rounded-full outline-none transition-[opacity,transform] duration-150 ease-out focus:outline-none focus-visible:outline-none"
              style={{
                opacity: selected ? 1 : 0.55,
                transform: selected ? "scale(1)" : "scale(0.88)",
              }}
              aria-pressed={selected}
              aria-label={`Select $${value} chip`}
            >
              <Chip value={value} size={chipSize} selected={selected} />
            </button>
          );
        })}
      </div>

      {minimal ? null : (
        <button
          type="button"
          onClick={onDouble}
          disabled={!canDouble}
          className={`${sideBtn} disabled:opacity-30`}
        >
          x2
        </button>
      )}
    </div>
  );
}
