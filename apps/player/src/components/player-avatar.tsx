"use client";

const PALETTE = [
  ["#152238", "#94a3b8"],
  ["#231833", "#c4b5fd"],
  ["#14241c", "#86efac"],
  ["#2a1c12", "#fdba74"],
  ["#241616", "#fca5a5"],
  ["#161b2e", "#a5b4fc"],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function PlayerAvatar({
  name,
  src,
  isLocal = false,
  isActing = false,
  size = 44,
}: {
  name: string;
  src?: string | null;
  isLocal?: boolean;
  isActing?: boolean;
  size?: number;
}) {
  const palette = PALETTE[hashName(name) % PALETTE.length]!;
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const ring = isActing
    ? "rgba(0,0,0,0.6)"
    : isLocal
      ? "#f0c43a"
      : "rgba(255,255,255,0.28)";

  return (
    <div
      className="relative z-10 shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 1.5px ${ring}, 0 6px 16px rgba(0,0,0,0.5)`,
        background: src
          ? "#0c0c10"
          : isLocal
            ? "linear-gradient(160deg, #2a2418, #0c0c10)"
            : `linear-gradient(160deg, ${palette[0]}, #0a0a0e)`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <div className="flex size-full items-center justify-center">
          {isLocal ? (
            <svg viewBox="0 0 24 24" fill="#f0c43a" className="size-[52%]" aria-hidden>
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 18.5c0-3.1 2.9-5.4 6.5-5.4s6.5 2.3 6.5 5.4" />
            </svg>
          ) : (
            <span className="font-semibold" style={{ fontSize: size * 0.34, color: palette[1] }}>
              {initial}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
