"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChromaKeyVideo, type ChromaKeyOptions } from "./chroma-key-video";

export type FeedStatus = "idle" | "loading" | "live" | "error";

/** Desktop framing of the dealer canvas, in viewport %. Shared with the table reflection. */
export const DEALER_FRAME = { top: 9, height: 68 };
/** Portrait-phone feed width as a multiple of the viewport width. */
export const PHONE_CROP = 1.25;
/** Portrait-phone feed top as a fraction of the viewport height — pushes the table to mid-screen. */
export const PHONE_TOP = 0.2;

/**
 * Where the dealer video sits inside a container of w×h px. Everything laid over
 * the feed (table plane, seats, reflection) derives from this one rectangle so the
 * overlay follows the camera framing instead of re-flowing with the viewport —
 * real cards on a real table don't move when you rotate your phone.
 */
export function dealerFrameFor(w: number, h: number) {
  if (w <= 640) {
    // Portrait phones: a modest camera crop — you, your two neighbours and the
    // dealer stay in shot; the outer seats fall off the edge (they get a strip).
    const width = w * PHONE_CROP;
    const height = (width * 9) / 16;
    return { left: (w - width) / 2, top: h * PHONE_TOP, width, height };
  }
  const height = (h * DEALER_FRAME.height) / 100;
  const width = (height * 16) / 9;
  return { left: (w - width) / 2, top: (h * DEALER_FRAME.top) / 100, width, height };
}

export type DealerFrame = ReturnType<typeof dealerFrameFor>;

/** Reference feed width (px) the table geometry was tuned against. */
export const REFERENCE_FRAME_WIDTH = 870;

export function useContainerSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Demo dealer shipped with the app — swap for the live playback URL in prod. */
export const DEMO_DEALER_SOURCES = ["/dealer/dealer_green.webm", "/dealer/dealer_green.mp4"];

/**
 * The dealer, keyed out of her green screen and stood behind the table.
 * The slab (TableScene, z-6) covers her from the waist down so she reads as
 * standing at the table rather than floating in the room.
 */
export function DealerVideoLayer({
  sources,
  dealerName,
  keyed = true,
  keyOptions,
  onStatusChange,
  videoRef: externalRef,
}: {
  /** Playback candidates, best first (browser picks the first it can decode). */
  sources: string[];
  dealerName: string;
  keyed?: boolean;
  keyOptions?: ChromaKeyOptions;
  onStatusChange?: (status: FeedStatus) => void;
  /** Share the <video> so other layers (table reflection) can key the same frames. */
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const ownRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalRef ?? ownRef;
  const [status, setStatus] = useState<FeedStatus>("idle");

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setStatus("loading");
    const onPlaying = () => setStatus("live");
    const onError = () => setStatus("error");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    void video.play().catch(() => {
      // Autoplay is muted so this rarely fails; status flips on `playing`.
    });
    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.join("|")]);

  const live = status === "live";

  return (
    <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" aria-hidden={!live}>
      {/* Source — hidden when keyed; the canvas is what you see */}
      <video
        ref={videoRef}
        className={
          keyed
            ? "pointer-events-none absolute size-px opacity-0"
            : `absolute inset-0 size-full object-cover ${live ? "" : "opacity-0"}`
        }
        autoPlay
        muted
        loop
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        aria-label={`${dealerName} live`}
      >
        {sources.map((source) => (
          <source key={source} src={source} type={mimeFor(source)} />
        ))}
      </video>

      {keyed ? (
        <div
          // Phones: size by width so she isn't a giant; desktop: size by height so
          // her waist lands at the table's far edge.
          className="absolute left-1/2 top-[var(--phone-top)] aspect-video w-[var(--phone-w)] -translate-x-1/2 transition-opacity duration-700 sm:top-[var(--dealer-top)] sm:h-[var(--dealer-height)] sm:w-auto"
          style={
            {
              opacity: live ? 1 : 0,
              "--phone-w": `${PHONE_CROP * 100}vw`,
              "--phone-top": `${PHONE_TOP * 100}%`,
              "--dealer-top": `${DEALER_FRAME.top}%`,
              "--dealer-height": `${DEALER_FRAME.height}%`,
            } as React.CSSProperties
          }
        >
          {/* Soft presence glow behind her so she separates from the room */}
          <div
            className="absolute inset-x-[20%] top-[10%] bottom-0 rounded-[50%] blur-3xl"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
          <ChromaKeyVideo
            videoRef={videoRef}
            active={live || status === "loading"}
            options={keyOptions}
            className="relative size-full"
            style={{
              filter: "contrast(1.04) saturate(1.05) drop-shadow(0 18px 30px rgba(0,0,0,0.55))",
            }}
          />
          {/* Invisible throw target on her face / upper torso */}
          <div
            data-seat-anchor={0}
            className="pointer-events-none absolute left-1/2 top-[18%] h-[28%] w-[22%] -translate-x-1/2"
            aria-hidden
          />
        </div>
      ) : null}

      {!live ? <FeedWaiting dealerName={dealerName} status={status} /> : null}
    </div>
  );
}

function mimeFor(url: string): string | undefined {
  const clean = url.split("?")[0]?.toLowerCase() ?? "";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mp4") || clean.endsWith(".m4v")) return "video/mp4";
  if (clean.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  return undefined;
}

function FeedWaiting({ dealerName, status }: { dealerName: string; status: FeedStatus }) {
  const copy = status === "error" ? "Dealer feed unavailable." : "Connecting to the dealer…";

  return (
    <div className="absolute inset-x-0 top-[13%] flex justify-center">
      <div className="w-[min(92vw,400px)] text-center">
        <p className="text-[11px] tracking-[0.34em] text-white/40 uppercase">Live</p>
        <h2 className="mt-2 font-display text-4xl leading-none text-white drop-shadow-lg">
          {dealerName}
        </h2>
        <p className="mt-3 text-xs text-white/40">{copy}</p>
      </div>
    </div>
  );
}
