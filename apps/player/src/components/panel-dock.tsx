"use client";

import type { ReactNode } from "react";
import { cn } from "@live-dealr/ui/lib/utils";

export const PANEL_DOCK_WIDTH = "min(100%, 24rem)";

/**
 * In-flow panel that pushes the table stage instead of covering it.
 * Desktop: right rail. Mobile: bottom sheet height.
 */
export function PanelDock({
  open,
  side,
  size = "default",
  children,
  className,
}: {
  open: boolean;
  side: "right" | "bottom";
  /** Chat stays shorter; profile / wallet / missions can use more height. */
  size?: "default" | "tall";
  children: ReactNode;
  className?: string;
}) {
  const bottomH =
    size === "tall" ? "h-[min(72dvh,34rem)]" : "h-[min(46dvh,24rem)]";

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "pointer-events-auto z-40 flex shrink-0 flex-col overflow-hidden bg-[#121218] text-white transition-[width,height,opacity] duration-300 ease-out",
        side === "right" &&
          (open
            ? "h-full w-[min(100%,24rem)] border-l border-white/8 opacity-100"
            : "h-full w-0 border-0 opacity-0"),
        side === "bottom" &&
          (open
            ? cn("w-full border-t border-white/8 opacity-100", bottomH)
            : "h-0 w-full border-0 opacity-0"),
        className,
      )}
    >
      {open ? <div className="flex h-full min-h-0 w-full flex-col">{children}</div> : null}
    </aside>
  );
}
