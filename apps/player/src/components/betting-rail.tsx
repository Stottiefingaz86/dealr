"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChipValue } from "@live-dealr/shared-types";
import { Chip } from "./chip";
import { formatMoney } from "@/lib/chips";
import { playChipPlace, playChipSelect, playChipUndo, preloadChipSfx, unlockAudio } from "@/lib/chip-sound";

type BetSpot = "main" | "pairs" | "twentyOne";

/**
 * Spiffing-style: pick a chip, tap a betting circle to stack it.
 */
export function BettingRail({
  chips,
  total,
  selectedChip,
  onSelectChip,
  onAddChip,
  onUndo,
  onDouble,
  betting,
  chipValues,
}: {
  chips: ChipValue[];
  total: number;
  selectedChip: ChipValue;
  onSelectChip: (value: ChipValue) => void;
  onAddChip: (value: ChipValue) => void;
  onUndo: () => void;
  onDouble: () => void;
  betting: boolean;
  chipValues: readonly ChipValue[];
}) {
  const [pairs, setPairs] = useState<ChipValue[]>([]);
  const [twentyOne, setTwentyOne] = useState<ChipValue[]>([]);
  const [flights, setFlights] = useState<
    { id: string; value: ChipValue; from: { x: number; y: number }; to: { x: number; y: number } }[]
  >([]);
  const trayRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const spotRefs = useRef<Record<BetSpot, HTMLButtonElement | null>>({
    main: null,
    pairs: null,
    twentyOne: null,
  });
  const prevLen = useRef(chips.length);

  useEffect(() => {
    unlockAudio();
    void preloadChipSfx();
  }, []);

  useEffect(() => {
    if (chips.length > prevLen.current) {
      playChipPlace(0.85 + Math.min(chips.length, 8) * 0.03);
    } else if (chips.length < prevLen.current) {
      playChipUndo();
    }
    prevLen.current = chips.length;
  }, [chips.length]);

  function place(spot: BetSpot) {
    if (!betting) {
      return;
    }
    const tray = trayRefs.current[selectedChip];
    const target = spotRefs.current[spot];
    if (tray && target) {
      const a = tray.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const id = `${spot}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFlights((current) => [
        ...current,
        {
          id,
          value: selectedChip,
          from: { x: a.left + a.width / 2, y: a.top + a.height / 2 },
          to: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
        },
      ]);
    }

    if (spot === "main") {
      onAddChip(selectedChip);
      return;
    }
    playChipPlace(0.7);
    if (spot === "pairs") {
      setPairs((current) => [...current, selectedChip].slice(-8));
    } else {
      setTwentyOne((current) => [...current, selectedChip].slice(-8));
    }
  }

  return (
    <div className="relative z-30 mx-auto w-full max-w-lg pointer-events-auto">
      {/* Spiffing-style betting pad */}
      <div className="relative mx-auto h-[11.5rem] w-[11.5rem]">
        <svg viewBox="0 0 220 220" className="pointer-events-none absolute inset-0 size-full drop-shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
          <circle cx="110" cy="110" r="100" fill="rgba(6,18,14,0.5)" stroke="rgba(232,220,180,0.45)" strokeWidth="2" />
          <circle cx="110" cy="110" r="62" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
          <path id="arc-pp" d="M 28 130 A 92 92 0 0 1 78 30" fill="none" />
          <path id="arc-213" d="M 142 30 A 92 92 0 0 1 192 130" fill="none" />
          <text fill="rgba(255,255,255,0.5)" fontSize="9" letterSpacing="1.5" fontFamily="system-ui,sans-serif">
            <textPath href="#arc-pp" startOffset="6%">
              PERFECT PAIRS
            </textPath>
          </text>
          <text fill="rgba(255,255,255,0.5)" fontSize="9" letterSpacing="1.8" fontFamily="system-ui,sans-serif">
            <textPath href="#arc-213" startOffset="14%">
              21+3
            </textPath>
          </text>
        </svg>

        {/* Side: Perfect Pairs */}
        <button
          type="button"
          ref={(node) => {
            spotRefs.current.pairs = node;
          }}
          disabled={!betting}
          onClick={() => place("pairs")}
          className="absolute left-0 top-[18%] flex size-[3.4rem] items-end justify-center rounded-full border border-white/20 bg-black/35 disabled:opacity-60"
          aria-label="Perfect Pairs"
        >
          <ChipStack chips={pairs} size={30} step={4} />
        </button>

        {/* Side: 21+3 */}
        <button
          type="button"
          ref={(node) => {
            spotRefs.current.twentyOne = node;
          }}
          disabled={!betting}
          onClick={() => place("twentyOne")}
          className="absolute right-0 top-[18%] flex size-[3.4rem] items-end justify-center rounded-full border border-white/20 bg-black/35 disabled:opacity-60"
          aria-label="21+3"
        >
          <ChipStack chips={twentyOne} size={30} step={4} />
        </button>

        {/* Main bet */}
        <button
          type="button"
          ref={(node) => {
            spotRefs.current.main = node;
          }}
          disabled={!betting}
          onClick={() => place("main")}
          className="absolute left-1/2 top-1/2 flex size-[7.25rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-end rounded-full border-2 border-[#e8dcb4]/55 bg-black/30 pb-3 disabled:opacity-70"
          aria-label="Main bet"
        >
          {chips.length === 0 ? (
            <span className="mb-1 text-[11px] font-semibold tracking-[0.28em] text-white/55 uppercase">
              Main
            </span>
          ) : (
            <ChipStack chips={chips} size={48} step={6} />
          )}
        </button>
      </div>

      {total > 0 ? (
        <p className="mt-1.5 text-center text-sm font-semibold tabular-nums text-white drop-shadow">
          ${formatMoney(total)}
          {pairs.length || twentyOne.length
            ? ` · sides $${formatMoney(sumChips(pairs) + sumChips(twentyOne))}`
            : ""}
        </p>
      ) : (
        <p className="mt-1.5 text-center text-[10px] tracking-[0.28em] text-white/45 uppercase">
          Select chip · tap circle
        </p>
      )}

      {betting ? (
        <div className="mt-3 flex items-end justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              onUndo();
            }}
            className="mb-1 flex size-12 items-center justify-center rounded-full border border-white/15 bg-black/50 text-[10px] tracking-wide text-white/75 uppercase"
          >
            Undo
          </button>

          <div className="flex items-end gap-0.5 px-1">
            {chipValues.map((value, index) => {
              const selected = selectedChip === value;
              const selectedIndex = chipValues.indexOf(selectedChip);
              const spread =
                selectedIndex >= 0 && !selected
                  ? (index < selectedIndex ? -6 : 6) * (1 - Math.abs(index - selectedIndex) / chipValues.length)
                  : 0;
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
                  className="origin-bottom transition duration-200 ease-out"
                  style={{
                    transform: selected
                      ? "translateY(-10px) scale(1.38)"
                      : `translateX(${spread}px) scale(${selectedIndex >= 0 ? 0.88 : 1})`,
                    opacity: selected || selectedIndex < 0 ? 1 : 0.85,
                    zIndex: selected ? 2 : 1,
                  }}
                  aria-pressed={selected}
                  aria-label={`Select $${value} chip`}
                >
                  <Chip value={value} size={value >= 100 ? 54 : 48} selected={selected} />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onDouble}
            disabled={total <= 0}
            className="mb-1 flex size-12 items-center justify-center rounded-full border border-white/15 bg-black/50 text-[10px] tracking-wide text-white/75 uppercase disabled:opacity-30"
          >
            x2
          </button>
        </div>
      ) : null}

      {/* Flying chips layer */}
      <AnimatePresence>
        {flights.map((flight) => (
          <motion.div
            key={flight.id}
            className="pointer-events-none fixed z-[60]"
            style={{ left: 0, top: 0 }}
            initial={{ x: flight.from.x - 24, y: flight.from.y - 24, scale: 1, opacity: 1 }}
            animate={{ x: flight.to.x - 24, y: flight.to.y - 24, scale: 0.85, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onAnimationComplete={() => {
              setFlights((current) => current.filter((item) => item.id !== flight.id));
            }}
          >
            <Chip value={flight.value} size={48} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ChipStack({
  chips,
  size,
  step,
}: {
  chips: ChipValue[];
  size: number;
  step: number;
}) {
  const visible = chips.slice(-8);
  return (
    <div className="relative flex h-14 w-full items-end justify-center">
      <AnimatePresence initial={false}>
        {visible.map((chip, index) => (
          <motion.div
            key={`${chip}-${index}-${visible.length}`}
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: index * step, zIndex: index + 1 }}
            initial={{ y: 36, scale: 0.55, opacity: 0, rotate: -8 }}
            animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 22, mass: 0.7 }}
          >
            <Chip value={chip} size={size} stacked />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function sumChips(chips: ChipValue[]) {
  return chips.reduce((sum, value) => sum + value, 0);
}
