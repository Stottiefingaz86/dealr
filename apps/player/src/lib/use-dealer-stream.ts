"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  ServerEvents,
  createRealtimeSocket,
  type TableMediaSessionMessage,
} from "@live-dealr/realtime";
import { DEFAULT_TABLE_ID } from "@live-dealr/shared-types";
import { resolveApiUrl } from "./api";

export type StreamStatus = "waiting" | "live" | "offline" | "error";

/**
 * Player-only dealer feed — never opens the player webcam.
 * Playback URL comes from backend media session (dealer go-live).
 */
export function useDealerStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<StreamStatus>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const applySession = useCallback((session: TableMediaSessionMessage) => {
    setLive(session.live);
    setPlaybackUrl(session.playbackUrl);
    if (!session.live) {
      setStatus("offline");
      setError(null);
      return;
    }
    if (!session.playbackUrl) {
      setStatus("waiting");
      setError("Dealer is live — waiting for stream URL from studio.");
      return;
    }
    setStatus("live");
    setError(null);
  }, []);

  useEffect(() => {
    const api = resolveApiUrl();
    if (!api) {
      setStatus("offline");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${api}/tables/${DEFAULT_TABLE_ID}/media`);
        if (!response.ok || cancelled) {
          return;
        }
        const session = (await response.json()) as TableMediaSessionMessage;
        if (!cancelled) {
          applySession(session);
        }
      } catch {
        // Socket join will retry media state.
      }
    })();

    const socket = createRealtimeSocket(api);
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("table:join", {
        tableId: DEFAULT_TABLE_ID,
        role: "player",
      });
    });
    socket.on(ServerEvents.mediaState, (session: TableMediaSessionMessage) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [applySession]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (status === "live" && playbackUrl) {
      if (video.src !== playbackUrl) {
        video.src = playbackUrl;
      }
      void video.play().catch(() => {
        // Autoplay may need a gesture; stream URL is still attached.
      });
      return;
    }
    video.removeAttribute("src");
    video.load();
  }, [playbackUrl, status]);

  return {
    videoRef,
    status,
    error,
    playbackUrl: playbackUrl ?? "",
    live,
    /** @deprecated player never connects a camera */
    streamUrl: playbackUrl ?? "",
  };
}
