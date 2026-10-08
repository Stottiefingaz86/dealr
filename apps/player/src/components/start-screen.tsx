"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { DEFAULT_TABLE_ID } from "@live-dealr/shared-types";
import {
  compressAvatarFile,
  loadProfile,
  saveProfile,
} from "@/lib/player-profile";
import { unlockAudio, preloadChipSfx } from "@/lib/chip-sound";
import { ensureAmbience, setMusicVolume } from "@/lib/music";
import { preloadRewardClaim } from "@/lib/turn-sound";
import { warmBeyDealer } from "@/lib/warm-bey";

export type StartProfile = { name: string; avatarUrl: string | null };

export function StartScreen({ onEnter }: { onEnter: (profile: StartProfile) => void }) {
  // Avoid hydration mismatch — localStorage avatar only exists on the client.
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedName = useRef("Player");

  useEffect(() => {
    const saved = loadProfile();
    savedName.current = saved.name || "Player";
    setName(saved.name);
    setAvatarUrl(saved.avatarUrl);
  }, []);

  // Warm connect while they type. Don't force-kill a healthy running agent.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BEY_DEALER !== "1") return;
    const room = `dealr-${DEFAULT_TABLE_ID.slice(0, 40)}`;
    warmBeyDealer(room, savedName.current, { force: false });
  }, []);

  async function onPickAvatar(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setAvatarUrl(await compressAvatarFile(file));
    } catch {
      /* ignore */
    }
  }

  async function takeSeat() {
    const trimmed = name.trim() || "Player";
    saveProfile(trimmed, avatarUrl);
    unlockAudio();
    setBusy(true);
    // Light local warm-up — Isla was already dispatched on mount.
    setMusicVolume(0.2);
    ensureAmbience();
    void preloadChipSfx();
    preloadRewardClaim();
    onEnter({ name: trimmed, avatarUrl });
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#07070a] px-6 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -5%, rgba(240,196,58,0.14), transparent 55%), radial-gradient(ellipse 45% 35% at 85% 85%, rgba(80,120,180,0.1), transparent 50%), radial-gradient(ellipse 40% 30% at 12% 78%, rgba(40,40,60,0.5), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")",
          backgroundSize: "180px",
        }}
      />

      <div className="relative z-10 w-full max-w-[22rem]">
        <p className="font-display text-[3.4rem] leading-none tracking-tight text-white">Dealr</p>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          Your name and photo — then wait for Isla before hands deal.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative size-[4.5rem] shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition hover:border-[#f0c43a]/55"
            aria-label="Upload avatar"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full flex-col items-center justify-center gap-1 text-white/35">
                <Camera className="size-5" strokeWidth={1.5} />
                <span className="text-[9px] tracking-[0.14em] uppercase">Photo</span>
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[9px] tracking-wide text-white/80 opacity-0 transition group-hover:opacity-100">
              Edit
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickAvatar(e.target.files?.[0] ?? null)}
          />

          <label className="min-w-0 flex-1 text-[10px] tracking-[0.2em] text-white/40 uppercase">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
              maxLength={18}
              disabled={busy}
              className="mt-2 w-full rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-[15px] tracking-normal text-white normal-case outline-none placeholder:text-white/25 focus:border-[#f0c43a]/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") void takeSeat();
              }}
            />
          </label>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void takeSeat()}
          className="mt-8 w-full rounded-full bg-[#f0c43a] py-3.5 text-[14px] font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
        >
          Take a seat
        </button>
        <p className="mt-4 text-center text-[12px] text-white/35">
          Isla’s already joining while you enter.
        </p>
      </div>
    </main>
  );
}
