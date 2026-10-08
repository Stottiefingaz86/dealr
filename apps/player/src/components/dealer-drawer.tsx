"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Clapperboard,
  ChevronLeft,
  Gift,
  Grid3X3,
  Lock,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";
import type { DealerHighlight, DealerProfile, DealerRecommendation } from "@live-dealr/shared-types";
import { cn } from "@live-dealr/ui/lib/utils";
import { DockOrDrawer } from "@/components/dock-or-drawer";
import { useDrawerDirection } from "@/hooks/use-mobile";
import { DealerAvatar } from "@/components/dealer-avatar";

const TIP_AMOUNTS = [1, 5, 10, 25, 50] as const;

type Tab = "posts" | "reels" | "picks";

const STORIES: Array<{ id: string; label: string; src: string }> = [
  { id: "s-wins", label: "Big wins", src: "/dealer/clip-3.jpg" },
  { id: "s-busts", label: "Dealer busts", src: "/dealer/clip-75.jpg" },
  { id: "s-table", label: "The table", src: "/dealer/clip-165.jpg" },
  { id: "s-bts", label: "Behind", src: "/dealer/clip-21.jpg" },
  { id: "s-week", label: "This week", src: "/dealer/clip-26.jpg" },
];

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/**
 * The dealer's profile — reads like a creator page: avatar + stats, bio, actions,
 * story highlights, then a grid of posts / reels and her game picks. Content
 * unlocks when you follow.
 */
export function DealerDrawer({
  open,
  onOpenChange,
  profile,
  live,
  following,
  balance,
  onFollow,
  onTip,
  docked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: DealerProfile;
  live: boolean;
  following: boolean;
  balance: number;
  onFollow: (next: boolean) => void;
  onTip: (amount: number) => void;
  docked?: boolean;
}) {
  const direction = useDrawerDirection();
  const [tipOpen, setTipOpen] = useState(false);
  const [tipped, setTipped] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const followers = profile.followerCount + (following ? 1 : 0);
  const highlights = profile.highlights ?? [];
  const reels = highlights.filter((h) => h.kind === "short" || h.kind === "video");
  const recs = profile.recommendations ?? [];
  const totalViews = highlights.reduce((sum, h) => sum + (h.views ?? 0), 0);
  const firstName = profile.displayName.split(" ")[0] ?? profile.displayName;

  return (
    <DockOrDrawer
      open={open}
      onOpenChange={onOpenChange}
      docked={docked}
      direction={direction}
      overlayClassName={cn(
        "border-white/8 bg-[#0b0b0f]",
        direction === "bottom"
          ? "inset-x-0 bottom-0 h-[94dvh] max-h-[94dvh] rounded-t-[16px]"
          : "inset-y-0 right-0 h-full w-full max-w-[26rem] border-l",
      )}
    >
        <header className="flex shrink-0 items-center justify-between px-2 py-1.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/8"
            aria-label="Close"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="inline-flex items-center gap-1 text-[14px] font-semibold">
            {profile.displayName.toLowerCase().replace(/\s+/g, "")}
            <BadgeCheck className="size-4 fill-[#2f6dff] text-[#0b0b0f]" />
          </p>
          <span className="size-9" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]" data-drawer-persist>
          {/* Avatar + stats */}
          <section className="flex items-center gap-5 px-5 pt-2">
            <div className="relative shrink-0">
              <span
                className="block rounded-full p-[3px]"
                style={{
                  background: live
                    ? "conic-gradient(from 180deg, #f0c43a, #e63946, #c13584, #6d4aff, #f0c43a)"
                    : "rgba(255,255,255,0.14)",
                }}
              >
                <span className="block rounded-full bg-[#0b0b0f] p-[3px]">
                  <DealerAvatar size={80} />
                </span>
              </span>
              {live ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-[#e63946] px-1.5 py-[2px] text-[9px] font-bold tracking-[0.16em] text-white uppercase shadow">
                  Live
                </span>
              ) : null}
            </div>
            <div className="grid flex-1 grid-cols-3 text-center">
              <Stat value={highlights.length} label="posts" />
              <Stat value={compact(followers)} label="followers" />
              <Stat value={compact(totalViews)} label="views" />
            </div>
          </section>

          {/* Name + bio */}
          <section className="px-5 pt-3">
            <p className="font-display text-[20px] leading-tight text-white">{profile.displayName}</p>
            <p className="text-[12px] text-white/50">{profile.tagline ?? profile.primaryGames.join(" · ")}</p>
            {profile.bio ? <p className="mt-1.5 text-[13px] leading-snug text-white/85">{profile.bio}</p> : null}
            {profile.schedule?.length ? (
              <p className="mt-1 text-[12px] text-white/55">
                Live{" "}
                {profile.schedule.map((slot, i) => (
                  <span key={`${slot.day}-${slot.start}`}>
                    {i > 0 ? " · " : null}
                    <span className="text-white/80">{slot.day}</span> {slot.start}
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          {/* Actions */}
          <section className="flex items-center gap-2 px-5 pt-3">
            <button
              type="button"
              onClick={() => onFollow(!following)}
              className={cn(
                "h-9 flex-1 rounded-lg text-[13px] font-semibold transition",
                following ? "bg-white/12 text-white hover:bg-white/16" : "bg-[#6d4aff] text-white hover:bg-[#7c5cff]",
              )}
            >
              {following ? "Following" : "Follow"}
            </button>
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setTipOpen((o) => !o)}
                className={cn(
                  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition",
                  tipOpen ? "bg-[#f0c43a] text-black" : "bg-white/12 text-white hover:bg-white/16",
                )}
              >
                <Gift className="size-4" strokeWidth={2} />
                {tipped ? `Tipped $${tipped}` : "Send tip"}
              </button>
              <AnimatePresence>
                {tipOpen ? (
                  <motion.div
                    className="absolute inset-x-0 top-full z-10 mt-1.5 flex items-center justify-between gap-1 rounded-xl border border-white/12 bg-[#17171d] p-1 shadow-[0_14px_36px_rgba(0,0,0,0.6)]"
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
                  >
                    {TIP_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={balance < amount}
                        onClick={() => {
                          onTip(amount);
                          setTipOpen(false);
                          setTipped(amount);
                          window.setTimeout(() => setTipped(null), 2500);
                        }}
                        className="h-8 flex-1 rounded-lg text-[12px] font-semibold tabular-nums text-white/85 hover:bg-[#f0c43a] hover:text-black disabled:opacity-30"
                      >
                        ${amount}
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </section>

          {/* Story highlights */}
          <section className="mt-4 flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {STORIES.map((story) => (
              <button key={story.id} type="button" className="flex shrink-0 flex-col items-center gap-1.5">
                <span className="block rounded-full border border-white/18 p-[2px]">
                  <span className="block size-14 overflow-hidden rounded-full bg-[#15151b]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={story.src} alt="" className="size-full object-cover" draggable={false} />
                  </span>
                </span>
                <span className="text-[11px] text-white/80">{story.label}</span>
              </button>
            ))}
          </section>

          {/* Tabs */}
          <nav className="mt-3 grid grid-cols-3 border-t border-white/8">
            <TabButton active={tab === "posts"} onClick={() => setTab("posts")} label="Posts">
              <Grid3X3 className="size-5" strokeWidth={1.75} />
            </TabButton>
            <TabButton active={tab === "reels"} onClick={() => setTab("reels")} label="Reels">
              <Clapperboard className="size-5" strokeWidth={1.75} />
            </TabButton>
            <TabButton active={tab === "picks"} onClick={() => setTab("picks")} label="Picks">
              <Sparkles className="size-5" strokeWidth={1.75} />
            </TabButton>
          </nav>

          <Locked locked={!following} onFollow={() => onFollow(true)} name={firstName}>
            {tab === "posts" ? (
              <div className="grid grid-cols-3 gap-[2px]">
                {highlights.map((post) => (
                  <PostTile key={post.id} post={post} />
                ))}
              </div>
            ) : tab === "reels" ? (
              <div className="grid grid-cols-3 gap-[2px]">
                {reels.map((post) => (
                  <PostTile key={post.id} post={post} tall />
                ))}
              </div>
            ) : (
              <div className="space-y-2 px-4 py-3">
                <p className="px-1 text-[12px] text-white/50">What {firstName} is playing this week</p>
                {recs.map((rec) => (
                  <RecRow key={rec.id} rec={rec} />
                ))}
              </div>
            )}
          </Locked>
        </div>
    </DockOrDrawer>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-[16px] font-semibold tabular-nums leading-tight text-white">{value}</p>
      <p className="text-[12px] text-white/55">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-11 items-center justify-center border-b-2 transition",
        active ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70",
      )}
    >
      {children}
    </button>
  );
}

function Locked({
  locked,
  onFollow,
  name,
  children,
}: {
  locked: boolean;
  onFollow: () => void;
  name: string;
  children: React.ReactNode;
}) {
  if (!locked) {
    return <>{children}</>;
  }
  return (
    <div className="relative min-h-[16rem] overflow-hidden">
      <div className="pointer-events-none select-none blur-[7px] saturate-50" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#0b0b0f]/60 px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-black/40">
          <Lock className="size-5 text-white/85" />
        </span>
        <p className="text-[14px] font-semibold text-white">This account is for followers</p>
        <p className="max-w-[16rem] text-[12px] text-white/60">
          Follow {name} to see her posts, reels and the games she&apos;s recommending.
        </p>
        <button
          type="button"
          onClick={onFollow}
          className="mt-1 h-9 rounded-lg bg-[#6d4aff] px-5 text-[13px] font-semibold text-white hover:bg-[#7c5cff]"
        >
          Follow to unlock
        </button>
      </div>
    </div>
  );
}

function PostTile({ post, tall = false }: { post: DealerHighlight; tall?: boolean }) {
  return (
    <button
      type="button"
      className={cn("group relative overflow-hidden bg-[#15151b]", tall ? "aspect-[3/4]" : "aspect-square")}
      aria-label={post.title}
    >
      {post.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnailUrl}
          alt=""
          className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.04]"
          draggable={false}
        />
      ) : null}
      {post.kind === "short" ? (
        <Clapperboard className="absolute right-1.5 top-1.5 size-4 text-white drop-shadow" strokeWidth={2} />
      ) : post.kind === "video" ? (
        <Play className="absolute right-1.5 top-1.5 size-4 fill-white text-white drop-shadow" />
      ) : null}
      {post.views ? (
        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-white drop-shadow">
          <Play className="size-2.5 fill-white" />
          {compact(post.views)}
        </span>
      ) : null}
      <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
        <span className="line-clamp-2 text-[10px] leading-tight text-white">{post.title}</span>
      </span>
    </button>
  );
}

function RecRow({ rec }: { rec: DealerRecommendation }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] p-2 text-left transition hover:bg-white/[0.07]"
    >
      <span
        className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(circle at 30% 25%, hsl(${rec.hue} 90% 65%), hsl(${rec.hue} 70% 30%) 60%, hsl(${(rec.hue + 40) % 360} 60% 14%))`,
        }}
      >
        <Zap className="size-5 text-white/90 drop-shadow" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-white">{rec.title}</span>
          {rec.tag ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-bold tracking-[0.1em] uppercase",
                rec.tag === "game_of_the_week"
                  ? "bg-[#f0c43a] text-black"
                  : rec.tag === "hot"
                    ? "bg-[#e63946] text-white"
                    : "bg-[#2f6dff] text-white",
              )}
            >
              {rec.tag === "game_of_the_week" ? "Game of the week" : rec.tag}
            </span>
          ) : null}
        </span>
        <span className="block text-[11px] text-white/50">{rec.provider}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85">Play</span>
    </button>
  );
}
