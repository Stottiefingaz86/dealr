"use client";

/** Keyed still of the dealer on a dark disc. */
export function DealerAvatar({
  size = 28,
  ring = "none",
  src = "/dealer/avatar.png",
  className = "",
}: {
  size?: number;
  ring?: "none" | "live" | "soft";
  src?: string;
  className?: string;
}) {
  const ringStyle =
    ring === "live"
      ? "0 0 0 2px #0e0e12, 0 0 0 4px #e63946"
      : ring === "soft"
        ? "0 0 0 1.5px rgba(255,255,255,0.18)"
        : "none";
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 50% 30%, #2a2140, #0d0d13 75%)",
        boxShadow: ringStyle,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full select-none object-cover"
        style={{ transform: "scale(1.08) translateY(4%)" }}
      />
    </span>
  );
}
