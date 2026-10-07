"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** Draws keyed frames from an already-playing video onto a canvas. Does not own the stream. */
export function ChromaCanvas({
  videoRef,
  active,
  tolerance = 0.42,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  tolerance?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !active) {
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    const draw = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const frame = ctx.getImageData(0, 0, width, height);
        const data = frame.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const greenDominance = g - Math.max(r, b);
          const greenRatio = g / (r + g + b + 1);
          if (greenDominance > 28 * tolerance * 2 && greenRatio > 0.34) {
            const alpha = Math.max(0, 1 - greenDominance / (90 * (0.55 + tolerance)));
            data[i + 3] = Math.floor(alpha * 255);
          }
        }
        ctx.putImageData(frame, 0, 0);
      }
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, tolerance, videoRef]);

  if (!active) {
    return null;
  }

  return <canvas ref={canvasRef} className="absolute inset-0 size-full object-cover" />;
}
