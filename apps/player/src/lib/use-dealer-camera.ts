"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function preferObsDevice(devices: CameraDevice[]): string | undefined {
  return devices.find((device) => /obs/i.test(device.label))?.deviceId ?? devices[0]?.deviceId;
}

export type CameraStatus = "idle" | "requesting" | "live" | "denied" | "error";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useDealerCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectingRef = useRef(false);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const streamUrl = process.env.NEXT_PUBLIC_DEALER_STREAM_URL ?? "";

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => {
      // Autoplay can fail until a gesture; stream is still attached.
    });
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const listDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const cameras = all
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));
    setDevices(cameras);
    return cameras;
  }, []);

  const connect = useCallback(
    async (nextDeviceId?: string) => {
      if (streamUrl) {
        setStatus("live");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Camera is not available in this browser.");
        return;
      }
      if (connectingRef.current) {
        return;
      }
      connectingRef.current = true;
      setStatus("requesting");
      setError(null);

      try {
        // First open any camera so labels unlock, then prefer OBS if present.
        let stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: nextDeviceId
            ? { deviceId: { exact: nextDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        const cameras = await listDevices();
        const preferred = nextDeviceId || preferObsDevice(cameras);
        const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;

        if (preferred && currentId && preferred !== currentId) {
          stream.getTracks().forEach((track) => track.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: { exact: preferred },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        }

        // Replace previous stream only after the new one succeeds.
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const chosen =
          preferred ||
          stream.getVideoTracks()[0]?.getSettings().deviceId ||
          cameras[0]?.deviceId ||
          "";
        setDeviceId(chosen);
        attachStream(stream);
        setStatus("live");
      } catch (cause) {
        const denied =
          cause instanceof DOMException &&
          (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError");
        setStatus(denied ? "denied" : "error");
        setError(
          denied
            ? "Camera permission is required for the dealer feed."
            : cause instanceof Error
              ? cause.message
              : "Could not open the dealer camera.",
        );
      } finally {
        connectingRef.current = false;
      }
    },
    [attachStream, listDevices, streamUrl],
  );

  // Keep the live stream attached if the <video> remounts.
  useEffect(() => {
    if (status === "live" && streamRef.current) {
      attachStream(streamRef.current);
    }
  }, [attachStream, status]);

  useEffect(() => {
    void connect();
    return () => stop();
    // Mount once — do not depend on connect identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    status,
    error,
    devices,
    deviceId,
    streamUrl,
    connect,
    stop,
    setDeviceId,
  };
}
