import { cn } from "../lib/utils";

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-[0.22em] uppercase text-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-destructive shadow-[0_0_12px_rgba(196,92,92,0.9)]" />
      Live
    </span>
  );
}
