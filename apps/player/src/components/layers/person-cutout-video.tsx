"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getCutoutCanvas, publishCutoutCanvas } from "@/lib/cutout-bus";

/**
 * Person cutout for Bey/LiveKit.
 * Mask updates in the background; every frame redraws live video through the
 * last good mask so Isla never freezes when segmentation stalls.
 *
 * Mount only ONE PersonCutoutVideo (the dealer). Table reflection uses CutoutMirror.
 */

const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

type ConfidenceMask = {
  getAsFloat32Array: () => Float32Array;
  width: number;
  height: number;
  close?: () => void;
};

type ImageSegmenterInstance = {
  segmentForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
    callback: (result: { confidenceMasks?: ConfidenceMask[] }) => void,
  ) => void;
  close?: () => void;
};

type VisionMods = {
  FilesetResolver: {
    forVisionTasks: (wasm: string) => Promise<unknown>;
  };
  ImageSegmenter: {
    createFromOptions: (
      vision: unknown,
      opts: Record<string, unknown>,
    ) => Promise<ImageSegmenterInstance>;
  };
};

declare global {
  interface Window {
    __dealrVisionMods?: VisionMods;
  }
}

async function loadVision(): Promise<VisionMods> {
  if (window.__dealrVisionMods) return window.__dealrVisionMods;
  const mod = (await import(
    /* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
  )) as VisionMods;
  window.__dealrVisionMods = mod;
  return mod;
}

export function PersonCutoutVideo({
  videoRef,
  className = "",
  style,
  active = true,
  publish = true,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  className?: string;
  style?: React.CSSProperties;
  active?: boolean;
  publish?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !active) return;

    try {
      video.crossOrigin = "anonymous";
    } catch {
      /* ignore */
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let segmenter: ImageSegmenterInstance | null = null;
    let segReady = false;
    let segBusy = false;
    let lastSegAt = 0;
    let hasMask = false;
    let invert: boolean | null = null;
    let maskFrames = 0;
    let busyTimer: number | undefined;

    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

    if (publish) publishCutoutCanvas(canvas);

    function sizeTo(w: number, h: number) {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (maskCanvas.width !== w || maskCanvas.height !== h) {
        maskCanvas.width = w;
        maskCanvas.height = h;
      }
    }

    function paintSoftOval() {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      sizeTo(w, h);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.52, w * 0.34, h * 0.46, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.52,
        Math.min(w, h) * 0.2,
        w * 0.5,
        h * 0.52,
        Math.min(w, h) * 0.48,
      );
      g.addColorStop(0, "#000");
      g.addColorStop(0.65, "#000");
      g.addColorStop(1, "transparent");
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }

    /** Always redraw live video through the cached person mask — prevents freezes. */
    function paintLiveThroughMask() {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      sizeTo(w, h);
      if (!hasMask) {
        paintSoftOval();
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(maskCanvas, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-in";
      ctx.drawImage(video, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }

    function tightenMatte() {
      if (!maskCtx) return;
      // Light erode — clean neck/shoulder gaps without chewing the silhouette.
      for (let i = 0; i < 2; i++) {
        maskCtx.filter = "blur(1.8px)";
        maskCtx.globalCompositeOperation = "destination-in";
        maskCtx.drawImage(maskCanvas, 0, 0);
      }
      // Soft hair feather.
      maskCtx.filter = "blur(2.2px)";
      maskCtx.globalCompositeOperation = "source-over";
      maskCtx.globalAlpha = 0.75;
      maskCtx.drawImage(maskCanvas, 0, 0);
      maskCtx.globalAlpha = 1;
      maskCtx.filter = "blur(1.2px)";
      maskCtx.globalCompositeOperation = "destination-in";
      maskCtx.drawImage(maskCanvas, 0, 0);
      maskCtx.filter = "none";
      maskCtx.globalCompositeOperation = "source-over";
    }

    function updateMaskFromConfidence(mask: ConfidenceMask) {
      if (!maskCtx) return;
      const w = mask.width;
      const h = mask.height;
      if (!w || !h) return;
      sizeTo(w, h);

      const conf = mask.getAsFloat32Array();
      const n = Math.min(conf.length, w * h);

      if (invert === null || maskFrames < 6) {
        let cSum = 0;
        let cN = 0;
        let eSum = 0;
        let eN = 0;
        const stepX = Math.max(1, Math.floor(w / 20));
        const stepY = Math.max(1, Math.floor(h / 20));
        for (let y = 0; y < h; y += stepY) {
          for (let x = 0; x < w; x += stepX) {
            const v = conf[y * w + x] ?? 0;
            const cx = x / w;
            const cy = y / h;
            if (cx > 0.3 && cx < 0.7 && cy > 0.15 && cy < 0.85) {
              cSum += v;
              cN += 1;
            } else if (cx < 0.1 || cx > 0.9 || cy < 0.08 || cy > 0.92) {
              eSum += v;
              eN += 1;
            }
          }
        }
        const c = cN ? cSum / cN : 0;
        const e = eN ? eSum / eN : 0;
        invert = e > c;
      }
      maskFrames += 1;

      const img = maskCtx.createImageData(w, h);
      const data = img.data;
      let person = 0;
      for (let i = 0; i < n; i++) {
        let p = conf[i] ?? 0;
        if (invert) p = 1 - p;
        let a = 0;
        if (p > 0.62) a = 255;
        else if (p > 0.38) a = Math.round(((p - 0.38) / 0.24) * 255);
        if (a > 30) person += 1;
        const o = i * 4;
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = a;
      }
      const coverage = person / n;
      if (coverage < 0.05 || coverage > 0.9) return;

      maskCtx.putImageData(img, 0, 0);
      tightenMatte();
      hasMask = true;
    }

    (async () => {
      try {
        const { FilesetResolver, ImageSegmenter } = await loadVision();
        const vision = await FilesetResolver.forVisionTasks(WASM);
        if (disposed) return;
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
        segReady = true;
      } catch (err) {
        console.warn("[cutout] segmenter init failed", err);
        segReady = false;
      }
    })();

    const tick = () => {
      if (disposed) return;

      const playable =
        video.readyState >= 2 && video.videoWidth > 0 && !video.ended;
      if (playable) {
        if (video.paused) void video.play().catch(() => undefined);

        paintLiveThroughMask();

        const now = performance.now();
        if (segReady && segmenter && !segBusy && now - lastSegAt > 120) {
          segBusy = true;
          lastSegAt = now;
          if (busyTimer !== undefined) window.clearTimeout(busyTimer);
          // Don't let a dropped callback freeze mask updates forever.
          busyTimer = window.setTimeout(() => {
            segBusy = false;
          }, 500);
          try {
            segmenter.segmentForVideo(video, now, (result) => {
              segBusy = false;
              if (busyTimer !== undefined) {
                window.clearTimeout(busyTimer);
                busyTimer = undefined;
              }
              if (disposed) return;
              const m = result.confidenceMasks?.[0];
              if (m) {
                try {
                  updateMaskFromConfidence(m);
                } finally {
                  m.close?.();
                }
              }
            });
          } catch {
            segBusy = false;
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (busyTimer !== undefined) window.clearTimeout(busyTimer);
      if (publish) publishCutoutCanvas(null);
      try {
        segmenter?.close?.();
      } catch {
        /* ignore */
      }
    };
  }, [videoRef, active, publish]);

  return (
    <canvas
      ref={canvasRef}
      className={`object-contain object-bottom ${className}`}
      style={{ background: "transparent", ...style }}
      aria-hidden
    />
  );
}

/** Table reflection — reuses the dealer cutout canvas (no second MediaPipe). */
export function CutoutMirror({
  className = "",
  style,
  active = true,
}: {
  className?: string;
  style?: React.CSSProperties;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let raf = 0;

    const tick = () => {
      if (disposed) return;
      const src = getCutoutCanvas();
      if (src && src.width > 0) {
        if (canvas.width !== src.width || canvas.height !== src.height) {
          canvas.width = src.width;
          canvas.height = src.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(src, 0, 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [active]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden />;
}
