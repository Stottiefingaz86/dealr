"use client";

import type { ReactNode } from "react";
import { cn } from "@live-dealr/ui/lib/utils";
import { Drawer, DrawerContent, DrawerHandle } from "@/components/ui/drawer";

/**
 * Overlay drawer (legacy) or in-flow dock content for the push layout.
 * When `docked`, parent `PanelDock` owns sizing — we only render the body.
 */
export function DockOrDrawer({
  open,
  onOpenChange,
  docked = false,
  direction,
  overlayClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docked?: boolean;
  direction: "bottom" | "right";
  /** Classes applied only in overlay (vaul) mode. */
  overlayClassName?: string;
  children: ReactNode;
}) {
  if (docked) {
    if (!open) return null;
    return <div className="flex h-full min-h-0 w-full flex-col">{children}</div>;
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={direction}
      shouldScaleBackground={false}
      dismissible={false}
      modal={false}
    >
      <DrawerContent showOverlay={false} className={cn("pointer-events-auto", overlayClassName)}>
        {direction === "bottom" ? <DrawerHandle /> : null}
        {children}
      </DrawerContent>
    </Drawer>
  );
}
