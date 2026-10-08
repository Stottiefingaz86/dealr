"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

/** Mirrors a <video> to canvas — no segmentation (used for table reflection). */
export function VideoMirror({
  videoRef,
  className = "",
  style,
  active = true,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  className?: string;
  style?: CSSProperties;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    const tick = () => {
      if (disposed) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [videoRef, active]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden />;
}
