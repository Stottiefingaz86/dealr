"use client";

import { useEffect, useRef, useState } from "react";
import {
  RoomEvent,
  Track,
  VideoQuality,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type Room,
} from "livekit-client";
import { adoptWarmBey, warmBeyDealer } from "./warm-bey";

export type BeyDealerStatus =
  | "off"
  | "checking"
  | "connecting"
  | "live"
  | "error"
  | "unavailable";

/**
 * Attach Bey video from the single shared warm LiveKit room.
 * Does not create a second agent dispatch (that was killing speech/chat).
 */
export function useBeyDealer({
  enabled,
  videoRef,
  userName,
  tableId,
}: {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  userName?: string;
  tableId?: string;
}) {
  const [status, setStatus] = useState<BeyDealerStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const liveRef = useRef(false);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      liveRef.current = false;
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;
    let forceTimer: number | undefined;
    let unwire: (() => void) | undefined;
    let forceAttempts = 0;
    const roomName = `dealr-${(tableId || "demo").slice(0, 40)}`;

    function preferHigh(pub: RemoteTrackPublication) {
      try {
        pub.setVideoQuality?.(VideoQuality.HIGH);
      } catch {
        /* older SDK */
      }
      if (!pub.isSubscribed) pub.setSubscribed(true);
    }

    function attachVideo(track: RemoteTrack) {
      const el = videoRef.current;
      if (!el || track.kind !== Track.Kind.Video) return;
      try {
        el.crossOrigin = "anonymous";
      } catch {
        /* ignore */
      }
      track.attach(el);
      el.muted = true;
      el.loop = false;
      el.playsInline = true;
      void el.play().catch(() => undefined);
      liveRef.current = true;
      if (!cancelled) {
        setStatus("live");
        setError(null);
      }
    }

    function wireRoom(room: Room) {
      roomRef.current = room;
      const onTrackSubscribed = (
        track: RemoteTrack,
        pub: RemoteTrackPublication,
        _p: RemoteParticipant,
      ) => {
        preferHigh(pub);
        // Video only here — warm-bey owns the single Isla audio element.
        if (track.kind === Track.Kind.Video) attachVideo(track);
      };
      const onTrackPublished = (
        pub: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        preferHigh(pub);
        if (pub.track) onTrackSubscribed(pub.track as RemoteTrack, pub, participant);
      };
      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackPublished, onTrackPublished);
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          preferHigh(pub as RemoteTrackPublication);
          if (pub.isSubscribed && pub.track) {
            onTrackSubscribed(
              pub.track as RemoteTrack,
              pub as RemoteTrackPublication,
              p,
            );
          }
        }
      }
      return () => {
        room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.off(RoomEvent.TrackPublished, onTrackPublished);
      };
    }

    async function ensureConnected(force: boolean) {
      if (force) {
        if (forceAttempts >= 1) return;
        forceAttempts += 1;
      }
      if (!cancelled) {
        setStatus("connecting");
        setError(null);
      }
      liveRef.current = false;

      const state = await warmBeyDealer(roomName, userName, { force });
      if (cancelled) return;
      if (!state) {
        setStatus("unavailable");
        setError("Could not reach Isla — retrying…");
        // Soft retry only — never force-loop (that spawn-storms Bey sessions).
        retryTimer = window.setTimeout(() => {
          if (!cancelled && !liveRef.current) void ensureConnected(false);
        }, 8_000);
        return;
      }

      setConversationId(state.conversationId);
      unwire?.();
      unwire = wireRoom(state.room);
      if (state.videoTrack) attachVideo(state.videoTrack);

      void state.ready.then((ok) => {
        if (cancelled || liveRef.current) return;
        if (state.videoTrack) attachVideo(state.videoTrack);
        else if (!ok) {
          setStatus("unavailable");
          setError("Isla is slow to join…");
          if (retryTimer !== undefined) window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            if (!cancelled && !liveRef.current && forceAttempts < 1) {
              void ensureConnected(true);
            }
          }, 12_000);
        }
      });

      // One forced redispath max if still dark — never every 15s forever.
      if (forceTimer !== undefined) window.clearTimeout(forceTimer);
      forceTimer = window.setTimeout(() => {
        if (cancelled || liveRef.current || forceAttempts >= 1) return;
        console.warn("[bey] still no video — single force redispath");
        unwire?.();
        void ensureConnected(true);
      }, 20_000);
    }

    const already = adoptWarmBey(roomName);
    if (already) {
      setConversationId(already.conversationId);
      setStatus(already.videoTrack ? "live" : "connecting");
      unwire = wireRoom(already.room);
      if (already.videoTrack) attachVideo(already.videoTrack);
      else void ensureConnected(false);
      return () => {
        cancelled = true;
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
        if (forceTimer !== undefined) window.clearTimeout(forceTimer);
        unwire?.();
        roomRef.current = null;
      };
    }

    void ensureConnected(false);

    return () => {
      cancelled = true;
      liveRef.current = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (forceTimer !== undefined) window.clearTimeout(forceTimer);
      unwire?.();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoRef, userName, tableId]);

  return { status, error, conversationId, agentId: null as string | null };
}

/** Build a short natural-language shoe summary for Isla + POST /api/bey/context. */
export function buildBeyTableSummary(input: {
  phase?: string;
  dealerTotal?: string | null;
  actingName?: string | null;
  seats: Array<{
    seat: number;
    name: string | null;
    bet?: number;
    cards?: string[];
    total?: string | null;
  }>;
  chat: Array<{ name: string; text: string }>;
}): string {
  const lines: string[] = [];
  lines.push(`Phase: ${input.phase ?? "unknown"}.`);
  if (input.dealerTotal) lines.push(`Dealer showing: ${input.dealerTotal}.`);
  if (input.actingName) lines.push(`Acting now: ${input.actingName}.`);
  for (const s of input.seats) {
    if (!s.name) continue;
    const cards = s.cards?.length ? s.cards.join(" ") : "no cards";
    lines.push(
      `Seat ${s.seat} ${s.name}: bet $${s.bet ?? 0}, cards [${cards}], total ${s.total ?? "—"}.`,
    );
  }
  if (input.chat.length) {
    lines.push("Recent chat:");
    for (const m of input.chat.slice(-8)) {
      lines.push(`- ${m.name}: ${m.text}`);
    }
  }
  return lines.join("\n");
}
