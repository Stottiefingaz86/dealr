"use client";

import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from "livekit-client";

type WarmState = {
  roomName: string;
  room: Room;
  conversationId: string;
  videoTrack: RemoteTrack | null;
  ready: Promise<boolean>;
  resolveReady: (ok: boolean) => void;
  audioEl: HTMLAudioElement | null;
  readyTimer?: number;
};

let warm: WarmState | null = null;
/** One in-flight warm per room — prevents double dispatch / double agents. */
const inflight = new Map<string, Promise<WarmState | null>>();

function detachAudio(state: WarmState) {
  if (!state.audioEl) return;
  try {
    state.audioEl.pause();
    state.audioEl.srcObject = null;
    state.audioEl.remove();
  } catch {
    /* ignore */
  }
  state.audioEl = null;
}

function preferHigh(pub: RemoteTrackPublication) {
  try {
    pub.setVideoQuality?.(VideoQuality.HIGH);
  } catch {
    /* older SDK */
  }
  if (!pub.isSubscribed) pub.setSubscribed(true);
}

function grabVideo(room: Room): RemoteTrack | null {
  for (const p of room.remoteParticipants.values()) {
    for (const pub of p.trackPublications.values()) {
      preferHigh(pub as RemoteTrackPublication);
      if (pub.kind === Track.Kind.Video && pub.track) {
        return pub.track as RemoteTrack;
      }
    }
  }
  return null;
}

export function clearWarmBey(): void {
  if (!warm) return;
  const prev = warm;
  warm = null;
  if (prev.readyTimer !== undefined) window.clearTimeout(prev.readyTimer);
  detachAudio(prev);
  void prev.room.disconnect();
}

/**
 * Single shared LiveKit connect + agent dispatch for the table room.
 * Safe to call from start screen and table — never spawns a second Isla.
 */
export function warmBeyDealer(
  roomName: string,
  userName?: string,
  opts?: { force?: boolean },
): Promise<WarmState | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  if (
    !opts?.force &&
    warm?.roomName === roomName &&
    warm.room.state !== "disconnected"
  ) {
    return Promise.resolve(warm);
  }

  const existing = inflight.get(roomName);
  if (existing && !opts?.force) return existing;

  if (opts?.force) clearWarmBey();

  const run = (async (): Promise<WarmState | null> => {
    if (warm && warm.roomName !== roomName) {
      void warm.room.disconnect();
      warm = null;
    }

    let resolveReady: (ok: boolean) => void = () => undefined;
    const ready = new Promise<boolean>((r) => {
      resolveReady = r;
    });

    const room = new Room({ adaptiveStream: false, dynacast: false });
    const state: WarmState = {
      roomName,
      room,
      conversationId: roomName,
      videoTrack: null,
      ready,
      resolveReady,
      audioEl: null,
    };
    warm = state;

    const onVideo = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Video) return;
      state.videoTrack = track;
      state.resolveReady(true);
    };

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, _p: RemoteParticipant) => {
        preferHigh(pub);
        if (track.kind === Track.Kind.Video) onVideo(track);
        if (track.kind === Track.Kind.Audio) {
          // One audio element per warm room — never stack on resubscribe.
          detachAudio(state);
          const audio = track.attach();
          audio.autoplay = true;
          audio.volume = 0.88;
          state.audioEl = audio;
          void audio.play().catch(() => undefined);
        }
      },
    );

    try {
      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName,
          identity: `player-${Math.random().toString(36).slice(2, 8)}`,
          name: userName?.trim() || "Player",
          force: Boolean(opts?.force),
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        url?: string;
        token?: string;
        room?: string;
      };
      if (!tokenRes.ok || !tokenJson.url || !tokenJson.token) {
        state.resolveReady(false);
        return null;
      }
      state.conversationId = tokenJson.room ?? roomName;
      if (warm !== state) return null;
      await room.connect(tokenJson.url, tokenJson.token);
      const existingTrack = grabVideo(room);
      if (existingTrack) onVideo(existingTrack);
      state.readyTimer = window.setTimeout(() => {
        if (!state.videoTrack) state.resolveReady(false);
      }, 18_000);
      return state;
    } catch {
      state.resolveReady(false);
      return null;
    } finally {
      inflight.delete(roomName);
    }
  })();

  inflight.set(roomName, run);
  return run;
}

export function getWarmBey(roomName: string): WarmState | null {
  if (!warm || warm.roomName !== roomName) return null;
  if (warm.room.state === "disconnected") return null;
  return warm;
}

export function adoptWarmBey(roomName: string): WarmState | null {
  const s = getWarmBey(roomName);
  if (!s) return null;
  if (!s.videoTrack) s.videoTrack = grabVideo(s.room);
  return s;
}
