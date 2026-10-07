"use client";

import { motion } from "framer-motion";
import { Check, ChevronLeft, Lock, Target } from "lucide-react";
import { cn } from "@live-dealr/ui/lib/utils";
import { Drawer, DrawerContent, DrawerHandle } from "@/components/ui/drawer";
import { useDrawerDirection } from "@/hooks/use-mobile";
import { claimable, MISSIONS, type Mission, type MissionBook } from "@/lib/missions";

/** Floating entry point, bottom-right. Pulses and shows a count when something is ready to claim. */
export function MissionsButton({
  book,
  active,
  onClick,
}: {
  book: MissionBook;
  active: boolean;
  onClick: () => void;
}) {
  const ready = claimable(book).length;
  const done = MISSIONS.filter((m) => book.progress[m.id]?.claimed).length;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Missions"
      className={cn(
        "absolute bottom-[max(0.9rem,env(safe-area-inset-bottom))] right-3 z-30 inline-flex h-9 items-center gap-2 rounded-full border pl-3 pr-3.5 text-[12px] backdrop-blur-md transition",
        active
          ? "border-white/25 bg-white/20 text-white"
          : ready > 0
            ? "border-[#f0c43a]/50 bg-[#1c170a]/80 text-[#f6dc8c] hover:bg-[#26200e]"
            : "border-white/12 bg-black/35 text-white/55 hover:bg-black/55 hover:text-white/80",
      )}
      animate={ready > 0 && !active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={ready > 0 ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <Target className="size-3.5" strokeWidth={1.75} />
      Missions
      <span
        className={cn(
          "ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
          ready > 0 ? "bg-[#f0c43a] text-black" : "bg-white/10 text-white/70",
        )}
      >
        {ready > 0 ? ready : `${done}/${MISSIONS.length}`}
      </span>
    </motion.button>
  );
}

/**
 * Session missions — laid out like the dealer page: a short intro, a strip of the
 * rewards on offer, then a plain list of goals divided by hairlines.
 */
export function MissionsDrawer({
  open,
  onOpenChange,
  book,
  unlocks,
  onClaim,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: MissionBook;
  unlocks: ReadonlySet<string>;
  onClaim: (mission: Mission, buttonEl?: HTMLElement) => void;
}) {
  const direction = useDrawerDirection();
  const ready = MISSIONS.filter(
    (m) => book.progress[m.id]?.completedAt && !book.progress[m.id]?.claimed,
  );
  const open_ = MISSIONS.filter((m) => !book.progress[m.id]?.completedAt);
  const done = MISSIONS.filter((m) => book.progress[m.id]?.claimed);
  const cashback = done.reduce(
    (sum, m) => sum + (m.reward.kind === "cashback" ? m.reward.amount : 0),
    0,
  );
  const cosmetic = MISSIONS.filter((m) => m.reward.kind !== "cashback");

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={direction}
      shouldScaleBackground={false}
      dismissible={false}
    >
      <DrawerContent
        className={cn(
          "border-white/8 bg-[#0b0b0f]",
          direction === "bottom"
            ? "inset-x-0 bottom-0 h-[88dvh] max-h-[88dvh] rounded-t-[16px]"
            : "inset-y-0 right-0 h-full w-full max-w-[24rem] border-l",
        )}
      >
        {direction === "bottom" ? <DrawerHandle /> : null}

        <header className="flex shrink-0 items-center justify-between px-2 py-1.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/8"
            aria-label="Close"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="text-[14px] font-semibold">Missions</p>
          <span className="size-9" />
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
          data-drawer-persist
        >
          {/* Intro + session progress */}
          <section className="px-5 pt-2">
            <p className="font-display text-[20px] leading-tight text-white">This session</p>
            <p className="text-[12px] text-white/50">
              Play your way to new emotes, throwables and cashback.
            </p>
            <div className="mt-3 flex items-baseline justify-between text-[12px]">
              <span className="text-white/70">
                <span className="font-semibold text-white tabular-nums">{done.length}</span> of{" "}
                {MISSIONS.length} complete
              </span>
              <span className="text-[#f6dc8c] tabular-nums">${cashback} earned</span>
            </div>
            <div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-[#f0c43a]"
                initial={false}
                animate={{ width: `${(done.length / MISSIONS.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 26 }}
              />
            </div>
          </section>

          {/* Rewards on offer — reads like story highlights */}
          <section className="mt-4">
            <p className="px-5 text-[10px] tracking-[0.18em] text-white/40 uppercase">
              Unlockables
            </p>
            <div className="mt-2 flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {cosmetic.map((m) => {
                const reward = m.reward;
                if (reward.kind === "cashback") return null;
                const owned = unlocks.has(reward.id);
                return (
                  <div key={m.id} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "relative flex size-14 items-center justify-center rounded-full border text-[24px]",
                        owned
                          ? "border-[#f0c43a]/70 bg-[#f0c43a]/10"
                          : "border-white/12 bg-white/[0.03] opacity-60 grayscale",
                      )}
                    >
                      {reward.emoji}
                      {owned ? null : (
                        <Lock
                          className="absolute right-0 bottom-0 size-4 rounded-full bg-[#0b0b0f] p-[3px] text-white/70"
                          strokeWidth={2}
                        />
                      )}
                    </span>
                    <span className="w-full truncate text-center text-[10px] text-white/55">
                      {reward.kind === "emote" ? "Emote" : "Throw"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {ready.length > 0 ? (
            <section className="mt-4">
              <p className="px-5 text-[10px] tracking-[0.18em] text-[#f6dc8c]/80 uppercase">
                Ready to claim
              </p>
              <ul className="mt-1 divide-y divide-white/8 border-y border-white/8">
                {ready.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    book={book}
                    onClaim={(el) => onClaim(m, el)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-4">
            <p className="px-5 text-[10px] tracking-[0.18em] text-white/40 uppercase">Missions</p>
            <ul className="mt-1 divide-y divide-white/8 border-y border-white/8">
              {open_.map((m) => (
                <MissionRow key={m.id} mission={m} book={book} />
              ))}
              {done.map((m) => (
                <MissionRow key={m.id} mission={m} book={book} />
              ))}
            </ul>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function MissionRow({
  mission,
  book,
  onClaim,
}: {
  mission: Mission;
  book: MissionBook;
  onClaim?: (el: HTMLElement) => void;
}) {
  const p = book.progress[mission.id];
  const value = Math.min(p?.value ?? 0, mission.target);
  const ratio = value / mission.target;
  const claimed = Boolean(p?.claimed);
  const reward = mission.reward;

  return (
    <li
      className={cn(
        "flex items-center gap-4 px-5 py-3",
        onClaim && "bg-[#f0c43a]/[0.06]",
        claimed && "opacity-50",
      )}
    >
      {/* Reward */}
      <span className="flex w-9 shrink-0 items-center justify-center">
        {reward.kind === "cashback" ? (
          <span className="font-display text-[17px] leading-none text-[#f6dc8c]">
            ${reward.amount}
          </span>
        ) : (
          <span className={cn("text-[22px] leading-none", !claimed && "grayscale-[0.4]")}>
            {reward.emoji}
          </span>
        )}
      </span>

      {/* Copy */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white">{mission.title}</p>
        <p className="truncate text-[12px] text-white/50">{mission.description}</p>
      </div>

      {/* State */}
      {onClaim ? (
        <button
          type="button"
          onClick={(e) => onClaim(e.currentTarget)}
          className="h-8 shrink-0 rounded-lg bg-[#f0c43a] px-3 text-[12px] font-semibold text-black transition hover:bg-[#f6d25e] active:scale-95"
        >
          Claim
        </button>
      ) : claimed ? (
        <Check className="size-4 shrink-0 text-white/60" strokeWidth={2} />
      ) : (
        <ProgressRing ratio={ratio} label={`${value}/${mission.target}`} />
      )}
    </li>
  );
}

function ProgressRing({ ratio, label }: { ratio: number; label: string }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-[11px] text-white/45 tabular-nums">{label}</span>
      <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <motion.circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={ratio > 0 ? "#f0c43a" : "transparent"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ type: "spring", stiffness: 160, damping: 26 }}
        />
      </svg>
    </span>
  );
}
