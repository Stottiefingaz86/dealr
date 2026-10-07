"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { TableSpot } from "@live-dealr/environments";

export const EMOTES = [
  { id: "wave", emoji: "👋" },
  { id: "fire", emoji: "🔥" },
  { id: "clap", emoji: "👏" },
  { id: "laugh", emoji: "😂" },
  { id: "heart", emoji: "❤️" },
  { id: "cool", emoji: "😎" },
  { id: "crown", emoji: "👑", locked: true },
  { id: "gem", emoji: "💎", locked: true },
  { id: "rocket", emoji: "🚀", locked: true },
] as const;

export const THROWABLES = [
  { id: "tomato", emoji: "🍅" },
  { id: "rose", emoji: "🌹" },
  { id: "chip", emoji: "🪙" },
  { id: "party", emoji: "🎉" },
  { id: "snow", emoji: "❄️" },
  { id: "boom", emoji: "💥" },
  { id: "dynamite", emoji: "🧨", locked: true },
  { id: "moneybag", emoji: "💰", locked: true },
] as const;

export type EmoteId = (typeof EMOTES)[number]["id"];
export type ThrowableId = (typeof THROWABLES)[number]["id"];

export interface FlyingThrow {
  id: string;
  emoji: string;
  from: TableSpot;
  to: TableSpot;
}

export type ImpactKind = "splat" | "confetti" | "petals" | "coins" | "frost" | "boom";

export interface Impact {
  id: string;
  kind: ImpactKind;
  at: TableSpot;
}

export function impactFor(emoji: string): ImpactKind {
  switch (emoji) {
    case "🍅":
      return "splat";
    case "🎉":
      return "confetti";
    case "🌹":
      return "petals";
    case "🪙":
    case "💰":
      return "coins";
    case "🧨":
      return "boom";
    case "❄️":
      return "frost";
    case "💥":
      return "boom";
    default:
      return "confetti";
  }
}

const THROW_FLIGHT_MS = 650;
const IMPACT_MS = 1500;

export interface LocalEmote {
  id: string;
  emoji: string;
  at: TableSpot;
}

export interface SeatTarget {
  seat: number;
  spot: TableSpot;
  isLocal: boolean;
}

/**
 * Popover on your avatar: emotes (appear on you) + throwables (drag onto others).
 */
export function AvatarReactionMenu({
  open,
  onClose,
  localSpot,
  seats,
  onEmote,
  onThrow,
  unlocks,
  onLocked,
}: {
  open: boolean;
  onClose: () => void;
  localSpot: TableSpot;
  seats: SeatTarget[];
  onEmote: (emoji: string) => void;
  onThrow: (emoji: string, to: TableSpot, toSeat: number) => void;
  /** Reward ids unlocked through missions */
  unlocks?: ReadonlySet<string>;
  /** Tapping a locked item — open the missions panel */
  onLocked?: () => void;
}) {
  const isLocked = (item: { id: string; locked?: boolean }) =>
    Boolean(item.locked) && !unlocks?.has(item.id);
  const [drag, setDrag] = useState<{
    emoji: string;
    x: number;
    y: number;
  } | null>(null);
  const dragEmoji = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDrag(null);
      dragEmoji.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const emoji = dragEmoji.current;
      setDrag(null);
      dragEmoji.current = null;
      if (!emoji) {
        return;
      }

      // Nearest non-local seat anchor to the drop point (in viewport %).
      const px = (clientX / window.innerWidth) * 100;
      const py = (clientY / window.innerHeight) * 100;
      let target: SeatTarget | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const seat of seats) {
        if (seat.isLocal) {
          continue;
        }
        const dx = (seat.spot.x - px) * (window.innerWidth / 100);
        const dy = (seat.spot.y - py) * (window.innerHeight / 100);
        const dist = Math.hypot(dx, dy);
        if (dist < best) {
          best = dist;
          target = seat;
        }
      }
      if (!target || best > 110) {
        // Missed drop — dismiss so the popover never feels stuck.
        onClose();
        return;
      }
      onThrow(emoji, target.spot, target.seat);
      onClose();
    },
    [onClose, onThrow, seats],
  );

  useEffect(() => {
    if (!drag) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : null));
    };
    const onUp = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      finishDrag(e.clientX, e.clientY);
      // Swallow the ghost click that browsers synthesize after pointerup.
      const swallow = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.removeEventListener("click", swallow, true);
      };
      window.addEventListener("click", swallow, true);
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, finishDrag]);

  function startThrowDrag(emoji: string, e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragEmoji.current = emoji;
    setDrag({ emoji, x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers reject capture mid-gesture — window listeners still cover us.
    }
  }

  if (!open && !drag) {
    return null;
  }

  // Portal to body so overflow-clip / 3D transforms on <main> can't trap the
  // fixed backdrop (that bug only showed up on some prod mobile browsers).
  return createPortal(
    <>
      {open ? (
        <button
          type="button"
          className={`fixed inset-0 z-[70] cursor-default bg-black/25 ${drag ? "pointer-events-none" : ""}`}
          aria-label="Close reactions"
          onClick={onClose}
        />
      ) : null}

      {open && !drag ? (
        <motion.div
          className="fixed z-[71] w-[11.5rem] -translate-x-1/2 rounded-2xl border border-white/12 bg-[#121218]/95 p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          style={{
            left: `${localSpot.x}%`,
            top: `${Math.max(8, localSpot.y - 22)}%`,
          }}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-1.5 px-0.5 text-[9px] tracking-[0.18em] text-white/40 uppercase">
            React
          </p>
          <div className="mb-2.5 grid grid-cols-6 gap-1">
            {EMOTES.map((item) =>
              isLocked(item) ? (
                <LockedTile key={item.id} emoji={item.emoji} onClick={onLocked} />
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className="flex size-8 items-center justify-center rounded-lg text-base hover:bg-white/10 active:scale-95"
                  onClick={() => {
                    onEmote(item.emoji);
                    onClose();
                  }}
                >
                  {item.emoji}
                </button>
              ),
            )}
          </div>
          <p className="mb-1.5 px-0.5 text-[9px] tracking-[0.18em] text-white/40 uppercase">
            Throw · drag to player
          </p>
          <div className="grid grid-cols-6 gap-1">
            {THROWABLES.map((item) =>
              isLocked(item) ? (
                <LockedTile key={item.id} emoji={item.emoji} onClick={onLocked} />
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className="flex size-8 touch-none items-center justify-center rounded-lg text-base hover:bg-white/10 active:scale-95"
                  onPointerDown={(e) => startThrowDrag(item.emoji, e)}
                >
                  {item.emoji}
                </button>
              ),
            )}
          </div>
        </motion.div>
      ) : null}

      {drag ? (
        <div
          className="pointer-events-none fixed z-[72] text-3xl drop-shadow-lg"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
        >
          {drag.emoji}
        </div>
      ) : null}
    </>,
    document.body,
  );
}

export function ReactionLayer({
  throws,
  emotes,
  impacts,
}: {
  throws: FlyingThrow[];
  emotes: LocalEmote[];
  impacts: Impact[];
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-clip">
      <AnimatePresence>
        {throws.map((item) => (
          <motion.span
            key={item.id}
            className="absolute text-3xl drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
            style={{ left: `${item.from.x}%`, top: `${item.from.y}%`, x: "-50%", y: "-50%" }}
            initial={{ opacity: 1, scale: 0.8, rotate: -20 }}
            animate={{
              left: `${item.to.x}%`,
              top: [
                `${item.from.y}%`,
                `${Math.min(item.from.y, item.to.y) - 18}%`,
                `${item.to.y}%`,
              ],
              opacity: [1, 1, 1, 0],
              scale: [0.8, 1.25, 1, 0.6],
              rotate: [-20, 120, 340],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: THROW_FLIGHT_MS / 1000,
              ease: "easeIn",
              times: [0, 0.5, 0.92, 1],
            }}
          >
            {item.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {impacts.map((item) => (
          <ImpactBurst key={item.id} impact={item} />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {emotes.map((item) => (
          <motion.span
            key={item.id}
            className="absolute text-3xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
            style={{ left: `${item.at.x}%`, x: "-50%", y: "-50%" }}
            initial={{ top: `${item.at.y}%`, opacity: 0, scale: 0.5 }}
            animate={{
              top: ["" + item.at.y + "%", "-6%"],
              opacity: [0, 1, 1, 1, 0],
              scale: [0.5, 1.25, 1, 1, 0.9],
              x: ["-50%", "-30%", "-70%", "-40%", "-50%"],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 3.2,
              ease: [0.25, 0.1, 0.25, 1],
              times: [0, 0.08, 0.5, 0.88, 1],
            }}
          >
            {item.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

const CONFETTI_COLORS = ["#f0c43a", "#ff4d6d", "#4dd0ff", "#7cf29a", "#c084fc", "#ffffff"];

function ImpactBurst({ impact }: { impact: Impact }) {
  const pieces = useMemo(() => {
    const n =
      impact.kind === "confetti"
        ? 18
        : impact.kind === "boom"
          ? 10
          : impact.kind === "splat"
            ? 7
            : 12;
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 36 + Math.random() * 54;
      return {
        i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        rot: Math.random() * 540 - 270,
        size: 5 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? "#fff",
        delay: Math.random() * 0.08,
      };
    });
  }, [impact.kind]);

  const dur = IMPACT_MS / 1000;
  const base = {
    position: "absolute" as const,
    left: `${impact.at.x}%`,
    top: `${impact.at.y}%`,
  };

  if (impact.kind === "splat") {
    return (
      <motion.div style={base} initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.span
          className="absolute rounded-[46%_54%_52%_48%/55%_45%_55%_45%] bg-[#d6231f]"
          style={{
            width: 72,
            height: 62,
            x: "-50%",
            y: "-50%",
            boxShadow: "inset 0 -6px 12px rgba(0,0,0,0.25)",
          }}
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: [0.2, 1.15, 1], opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: dur, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
        />
        {pieces.map((p) => (
          <motion.span
            key={p.i}
            className="absolute rounded-full bg-[#e02a24]"
            style={{ width: p.size * 1.6, height: p.size * 1.6, x: "-50%", y: "-50%" }}
            initial={{ translateX: 0, translateY: 0, opacity: 1 }}
            animate={{
              translateX: p.dx * 0.8,
              translateY: [0, p.dy * 0.6, p.dy * 0.6 + 40],
              opacity: [1, 1, 0],
              scaleY: [1, 1, 1.6],
            }}
            transition={{ duration: dur, delay: p.delay, ease: "easeOut" }}
          />
        ))}
      </motion.div>
    );
  }

  if (impact.kind === "boom") {
    return (
      <motion.div style={base} initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.span
          className="absolute rounded-full bg-white"
          style={{ width: 90, height: 90, x: "-50%", y: "-50%" }}
          initial={{ scale: 0.1, opacity: 1 }}
          animate={{ scale: [0.1, 1.4], opacity: [1, 0] }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
        <motion.span
          className="absolute rounded-full border-2 border-[#ffb347]"
          style={{ width: 60, height: 60, x: "-50%", y: "-50%" }}
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: [0.3, 2.6], opacity: [1, 0] }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {pieces.map((p) => (
          <motion.span
            key={p.i}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              x: "-50%",
              y: "-50%",
              background: p.i % 2 ? "#ffb347" : "#ff5a36",
            }}
            initial={{ translateX: 0, translateY: 0, opacity: 1 }}
            animate={{
              translateX: p.dx * 1.3,
              translateY: p.dy * 1.3,
              opacity: [1, 1, 0],
              scale: [1, 0.4],
            }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        ))}
      </motion.div>
    );
  }

  // confetti / petals / coins / frost — particles with gravity
  const palette: Record<
    Exclude<ImpactKind, "splat" | "boom">,
    (p: (typeof pieces)[number]) => React.CSSProperties
  > = {
    confetti: (p) => ({
      width: p.size,
      height: p.size * 0.55,
      background: p.color,
      borderRadius: 1,
    }),
    petals: (p) => ({
      width: p.size * 1.3,
      height: p.size * 0.9,
      background: p.i % 3 ? "#e0356b" : "#ff7a9c",
      borderRadius: "60% 0 60% 0",
    }),
    coins: (p) => ({
      width: p.size * 1.2,
      height: p.size * 1.2,
      background: "radial-gradient(circle at 35% 35%, #fff2b0, #f0c43a 55%, #a9801a)",
      borderRadius: "50%",
    }),
    frost: (p) => ({
      width: p.size * 0.9,
      height: p.size * 0.9,
      background: "#dff6ff",
      borderRadius: "50%",
      boxShadow: "0 0 6px #9fe3ff",
    }),
  };
  const styleFor = palette[impact.kind];

  return (
    <motion.div style={base} initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {impact.kind === "frost" ? (
        <motion.span
          className="absolute rounded-full"
          style={{
            width: 110,
            height: 110,
            x: "-50%",
            y: "-50%",
            background: "radial-gradient(circle, rgba(200,240,255,0.55), transparent 65%)",
          }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1], opacity: [0, 0.9, 0] }}
          transition={{ duration: dur, ease: "easeOut" }}
        />
      ) : null}
      {impact.kind === "coins" ? (
        <motion.span
          className="absolute rounded-full border border-[#f0c43a]"
          style={{ width: 50, height: 50, x: "-50%", y: "-50%" }}
          initial={{ scale: 0.4, opacity: 1 }}
          animate={{ scale: [0.4, 2.2], opacity: [1, 0] }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      ) : null}
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute"
          style={{ ...styleFor(p), x: "-50%", y: "-50%" }}
          initial={{ translateX: 0, translateY: 0, rotate: 0, opacity: 1 }}
          animate={{
            translateX: [0, p.dx, p.dx * 1.15],
            translateY: [0, p.dy - 30, p.dy + 70],
            rotate: p.rot,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: dur, delay: p.delay, ease: [0.2, 0.7, 0.4, 1] }}
        />
      ))}
    </motion.div>
  );
}

/** Greyed-out reward tile with a padlock — tap to see which mission unlocks it. */
function LockedTile({ emoji, onClick }: { emoji: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="relative flex size-8 items-center justify-center rounded-lg text-base opacity-45 grayscale hover:bg-white/10 hover:opacity-70"
      onClick={onClick}
      aria-label="Locked — complete a mission to unlock"
    >
      {emoji}
      <Lock className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#0d0d13] p-[2px] text-white/80" />
    </button>
  );
}

export function useReactions() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [throws, setThrows] = useState<FlyingThrow[]>([]);
  const [emotes, setEmotes] = useState<LocalEmote[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  /** Blocks the synthetic click that follows a throw pointerup from reopening the menu. */
  const suppressOpenUntil = useRef(0);

  const closeMenu = useCallback(() => {
    suppressOpenUntil.current = Date.now() + 500;
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((open) => {
      if (open) {
        suppressOpenUntil.current = Date.now() + 200;
        return false;
      }
      if (Date.now() < suppressOpenUntil.current) return false;
      return true;
    });
  }, []);

  const spawnEmote = useCallback((emoji: string, at: TableSpot) => {
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEmotes((prev) => [...prev, { id, emoji, at }]);
    window.setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 3300);
  }, []);

  const spawnThrow = useCallback((emoji: string, from: TableSpot, to: TableSpot) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setThrows((prev) => [...prev, { id, emoji, from, to }]);
    window.setTimeout(() => {
      setThrows((prev) => prev.filter((t) => t.id !== id));
      setImpacts((prev) => [...prev, { id: `i-${id}`, kind: impactFor(emoji), at: to }]);
      window.setTimeout(() => {
        setImpacts((prev) => prev.filter((i) => i.id !== `i-${id}`));
      }, IMPACT_MS + 100);
    }, THROW_FLIGHT_MS);
  }, []);

  return {
    menuOpen,
    setMenuOpen,
    closeMenu,
    toggleMenu,
    throws,
    emotes,
    impacts,
    spawnEmote,
    spawnThrow,
  };
}
