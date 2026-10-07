"use client";

/**
 * Poker-style timer: one clean gold arc hugging the avatar edge.
 * Seconds badge sits top-right so it never collides with the name.
 */
export function TurnOrb({
  progress,
  seconds,
  avatarSize = 44,
}: {
  progress: number;
  seconds: number | null;
  avatarSize?: number;
}) {
  const stroke = 3;
  const gap = 3;
  const size = avatarSize + (stroke + gap) * 2;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const urgent = clamped < 0.3;
  const color = urgent ? "#ff5a5a" : "#f0c43a";

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ width: size, height: size }}
    >
      <svg className="size-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{
            transition: "stroke-dashoffset 0.2s linear, stroke 0.3s ease",
            filter: `drop-shadow(0 0 4px ${color}99)`,
          }}
        />
      </svg>
      {seconds !== null ? (
        <span
          className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold tabular-nums text-black"
          style={{ background: color, boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}
        >
          {seconds}
        </span>
      ) : null}
    </div>
  );
}
