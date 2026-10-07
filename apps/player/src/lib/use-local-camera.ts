"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LocalCameraStatus = "idle" | "requesting" | "live" | "denied" | "error";

/**
 * Dev / studio default: open the local camera on the player.
 * Production path remains dealer go-live → playback URL (useDealerStream).
 */
export function useLocalCamera(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<LocalCameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const attach = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Camera unavailable.");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      stop();
      attach(stream);
      setStatus("live");
    } catch (cause) {
      const denied =
        cause instanceof DOMException &&
        (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError");
      setStatus(denied ? "denied" : "error");
      setError(
        denied
          ? "Allow camera access to preview the table."
          : cause instanceof Error
            ? cause.message
            : "Could not open camera.",
      );
    }
  }, [attach, enabled, stop]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void connect();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (status === "live" && streamRef.current) {
      attach(streamRef.current);
    }
  }, [attach, status]);

  return { videoRef, status, error, connect, stop };
}
