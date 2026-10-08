"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Link2, Copy, Check } from "lucide-react";
import { DEFAULT_TABLE_ID } from "@live-dealr/shared-types";
import { TableExperience } from "@/components/table-experience";
import { unlockAudio, preloadChipSfx } from "@/lib/chip-sound";
import { ensureAmbience, setMusicVolume } from "@/lib/music";
import { preloadRewardClaim } from "@/lib/turn-sound";
import { generateRoomCode, peerIdForRoom } from "@/lib/live-room";
import {
  compressAvatarFile,
  gameLink,
  loadProfile,
  parseGameId,
  saveProfile,
  sanitizeGameId,
} from "@/lib/player-profile";
import { warmBeyDealer } from "@/lib/warm-bey";
import { useLiveTable, type LiveRole } from "@/lib/use-live-table";

type LobbyState =
  | { step: "lobby" }
  | { step: "table"; role: LiveRole; roomCode: string; name: string; avatarUrl?: string };

function readInvite(): { gameId: string; isHostFlag: boolean } {
  if (typeof window === "undefined") return { gameId: "", isHostFlag: false };
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("g") ?? q.get("room") ?? "";
  return {
    gameId: sanitizeGameId(raw),
    isHostFlag: q.get("host") === "1",
  };
}

export default function RealTablePage() {
  const invite = useMemo(() => readInvite(), []);
  const saved = useMemo(() => loadProfile(), []);
  const [lobby, setLobby] = useState<LobbyState>({ step: "lobby" });
  const [name, setName] = useState(saved.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(saved.avatarUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const joining = Boolean(invite.gameId) && !invite.isHostFlag;

  // Warm Isla while they set up — same LiveKit room as the felt.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BEY_DEALER !== "1") return;
    warmBeyDealer(`dealr-${DEFAULT_TABLE_ID.slice(0, 40)}`, saved.name || "Player", {
      force: false,
    });
  }, [saved.name]);

  if (lobby.step === "table") {
    return (
      <LiveTable
        role={lobby.role}
        roomCode={lobby.roomCode}
        name={lobby.name}
        avatarUrl={lobby.avatarUrl}
        onLeave={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("host");
          window.history.replaceState({}, "", url.pathname + (url.searchParams.get("g") ? `?g=${url.searchParams.get("g")}` : ""));
          setLobby({ step: "lobby" });
          setBusy(false);
        }}
      />
    );
  }

  async function onPickAvatar(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const data = await compressAvatarFile(file);
      setAvatarUrl(data);
    } catch {
      /* ignore bad files */
    }
  }

  function enterTable(role: LiveRole, gameId: string) {
    unlockAudio();
    setMusicVolume(0.2);
    ensureAmbience();
    void preloadChipSfx();
    preloadRewardClaim();
    const trimmed = name.trim() || (role === "host" ? "Host" : "Player");
    saveProfile(trimmed, avatarUrl);
    if (process.env.NEXT_PUBLIC_BEY_DEALER === "1") {
      warmBeyDealer(`dealr-${DEFAULT_TABLE_ID.slice(0, 40)}`, trimmed, { force: false });
    }
    setBusy(true);
    const url = new URL(window.location.href);
    url.searchParams.set("g", gameId);
    url.searchParams.delete("room");
    if (role === "host") url.searchParams.set("host", "1");
    else url.searchParams.delete("host");
    window.history.replaceState({}, "", url.toString());
    setLobby({
      step: "table",
      role,
      roomCode: gameId,
      name: trimmed,
      avatarUrl: avatarUrl ?? undefined,
    });
  }

  function createTable() {
    enterTable("host", generateRoomCode());
  }

  function joinTable() {
    const id = invite.gameId || parseGameId(window.location.href);
    if (id.length < 4) return;
    enterTable("guest", id);
  }

  async function copyInvitePreview() {
    const id = invite.gameId || "······";
    const link = gameLink(id);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#07070a] px-6 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(168,85,247,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 90%, rgba(234,179,8,0.08), transparent 50%), radial-gradient(ellipse 40% 30% at 10% 80%, rgba(59,130,246,0.12), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")",
          backgroundSize: "180px",
        }}
      />

      <div className="relative z-10 w-full max-w-[22rem]">
        <p className="text-[10px] tracking-[0.32em] text-white/40 uppercase">Friends table</p>
        <h1 className="mt-2 font-display text-[2.65rem] leading-[0.95] tracking-tight">
          {joining ? "Join the table" : "Play together"}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          {joining
            ? "Add your name and photo, then sit down. Same link for everyone."
            : "Create a private table and share the game link. Up to 5 seats."}
        </p>

        <div className="mt-9 flex items-center gap-4">
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
              className="mt-2 w-full rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-[15px] tracking-normal text-white normal-case outline-none placeholder:text-white/25 focus:border-white/25"
            />
          </label>
        </div>

        {joining ? (
          <>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] tracking-[0.2em] text-white/35 uppercase">Game link</p>
              <p className="mt-1 truncate font-mono text-[12px] text-[#f0c43a]/90">
                {gameLink(invite.gameId)}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={joinTable}
              className="mt-5 w-full rounded-full bg-[#f0c43a] py-3.5 text-[14px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
            >
              Join table
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={createTable}
              className="mt-8 w-full rounded-full bg-[#f0c43a] py-3.5 text-[14px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
            >
              Create table
            </button>
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-white/35">
              <Link2 className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              You’ll get a game link to share — friends open it and tap Join table. No codes to type.
            </p>
          </>
        )}

        {joining ? (
          <button
            type="button"
            onClick={() => void copyInvitePreview()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-2.5 text-[12px] text-white/55 transition hover:bg-white/5 hover:text-white/80"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy game link"}
          </button>
        ) : null}

        <a
          href="/"
          className="mt-10 block text-center text-[13px] text-white/35 transition hover:text-white/65"
        >
          ← Solo table
        </a>
      </div>
    </main>
  );
}

function LiveTable({
  role,
  roomCode,
  name,
  avatarUrl,
  onLeave,
}: {
  role: LiveRole;
  roomCode: string;
  name: string;
  avatarUrl?: string;
  onLeave: () => void;
}) {
  const live = useLiveTable({ roomCode, name, role, avatarUrl, enabled: true });
  const [copied, setCopied] = useState(false);
  const shareUrl = gameLink(roomCode);

  useEffect(() => {
    unlockAudio();
    setMusicVolume(0.2);
    ensureAmbience();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  if (!live.ready && live.error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-white">
        <p className="text-[15px] text-red-300">{live.error}</p>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-white/20 px-5 py-2 text-[13px]"
        >
          Back
        </button>
      </main>
    );
  }

  if (!live.ready) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black px-6 text-white">
        <p className="text-[14px] text-white/60">{live.status}</p>
        <p className="max-w-xs truncate font-mono text-[11px] text-white/30">{shareUrl}</p>
      </main>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 z-40 -translate-x-1/2">
        <div className="pointer-events-auto flex max-w-[min(92vw,28rem)] items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[11px] backdrop-blur-md">
          <Link2 className="size-3.5 shrink-0 text-[#f0c43a]" strokeWidth={1.75} />
          <span className="min-w-0 truncate font-mono text-[10px] tracking-wide text-white/70">
            {shareUrl.replace(/^https?:\/\//, "")}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-white/85 hover:bg-white/15"
            onClick={() => void copyLink()}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            className="shrink-0 text-white/40 hover:text-white/70"
            onClick={onLeave}
            title={`Peer ${peerIdForRoom(roomCode)}`}
          >
            Leave
          </button>
        </div>
      </div>
      <TableExperience
        playerId={live.playerId}
        actions={live}
        playerName={name}
        avatarUrl={avatarUrl}
        skipJoinGreet
      />
    </div>
  );
}
