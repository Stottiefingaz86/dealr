"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactionKind } from "@live-dealr/realtime";
import type { PlayerActionType } from "@live-dealr/shared-types";
import { LiveGuest, LiveHost, type LiveSession } from "./live-room";
import { usePlayerStore } from "./store";
import type { TableActions } from "./use-table-socket";

export type LiveRole = "host" | "guest";

export function useLiveTable(opts: {
  roomCode: string;
  name: string;
  role: LiveRole;
  avatarUrl?: string;
  enabled: boolean;
}): TableActions & { status: string; error: string | null; ready: boolean } {
  const sessionRef = useRef<LiveSession | null>(null);
  const [playerId, setPlayerId] = useState(`p-pending`);
  const [status, setStatus] = useState("Starting…");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const setConnected = usePlayerStore((s) => s.setConnected);
  const setState = usePlayerStore((s) => s.setState);
  const setChat = usePlayerStore((s) => s.setChat);
  const appendChat = usePlayerStore((s) => s.appendChat);
  const pushReaction = usePlayerStore((s) => s.pushReaction);

  useEffect(() => {
    if (!opts.enabled || !opts.roomCode || !opts.name.trim()) return;

    let cancelled = false;
    setChat([]);
    setError(null);
    setReady(false);
    setStatus(opts.role === "host" ? "Opening table…" : "Connecting…");

    const sinks = {
      onState: (state: Parameters<typeof setState>[0]) => {
        if (cancelled) return;
        setState(state);
      },
      onChat: appendChat,
      onReaction: pushReaction,
      onStatus: (s: string) => {
        if (!cancelled) setStatus(s);
      },
      onError: (message: string) => {
        if (!cancelled) {
          setError(message);
          setStatus(message);
        }
      },
    };

    const session =
      opts.role === "host"
        ? new LiveHost(opts.roomCode, opts.name.trim(), sinks, opts.avatarUrl)
        : new LiveGuest(opts.roomCode, opts.name.trim(), sinks, opts.avatarUrl);
    sessionRef.current = session;
    setPlayerId(session.localPlayerId);

    session
      .start()
      .then(() => {
        if (cancelled) return;
        setPlayerId(session.localPlayerId);
        setConnected(true);
        // Guests must have table state before we show the felt — otherwise they
        // get the chrome with an empty table (no pads / chips / cards).
        const hasState = Boolean(usePlayerStore.getState().state?.players?.length);
        if (opts.role === "guest" && !hasState) {
          setError("Joined but got no table state — refresh and try again");
          setConnected(false);
          return;
        }
        setReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to join");
        setConnected(false);
      });

    return () => {
      cancelled = true;
      session.stop();
      sessionRef.current = null;
      setConnected(false);
      setReady(false);
    };
  }, [
    opts.enabled,
    opts.roomCode,
    opts.name,
    opts.role,
    opts.avatarUrl,
    appendChat,
    pushReaction,
    setChat,
    setConnected,
    setState,
  ]);

  return {
    playerId,
    status,
    error,
    ready,
    addChip: (value: number) => sessionRef.current?.addChip(value),
    clearBet: () => sessionRef.current?.clearBet(),
    confirmBet: () => sessionRef.current?.confirmBet(),
    sendAction: (action: PlayerActionType) => sessionRef.current?.sendAction(action),
    follow: (next: boolean) => {
      sessionRef.current?.follow(next);
    },
    sendReaction: (kind: ReactionKind, emoji: string, toSeat: number | null = null) => {
      sessionRef.current?.sendReaction(kind, emoji, toSeat);
    },
    claimReward: (payload) => sessionRef.current?.claimReward(payload),
    tip: (amount: number) => sessionRef.current?.tip(amount),
    sendChat: (text: string) => sessionRef.current?.sendChat(text),
  };
}
