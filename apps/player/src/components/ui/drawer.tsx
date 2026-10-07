"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@live-dealr/ui/lib/utils";

export function Drawer({
  shouldScaleBackground = false,
  direction = "bottom",
  dismissible = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root> & {
  direction?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      direction={direction}
      dismissible={dismissible}
      {...props}
    />
  );
}

export const DrawerPortal: typeof DrawerPrimitive.Portal = DrawerPrimitive.Portal;
export const DrawerClose: typeof DrawerPrimitive.Close = DrawerPrimitive.Close;

export function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn("fixed inset-0 z-[80] bg-black/30", className)}
      {...props}
    />
  );
}

export function DrawerHandle({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-shrink-0 items-center justify-center pb-2 pt-3", className)}>
      <div className="h-1.5 w-[100px] rounded-full bg-white/35" />
    </div>
  );
}

export function DrawerContent({
  className,
  children,
  showOverlay = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showOverlay?: boolean;
}) {
  return (
    <DrawerPortal>
      {showOverlay ? <DrawerOverlay /> : null}
      <DrawerPrimitive.Content
        data-vaul-no-drag
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          // Keep panel open while dragging sliders that leave the sheet bounds.
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drawer-persist]")) {
            event.preventDefault();
          }
        }}
        className={cn(
          "fixed z-[90] flex flex-col bg-[#141414] text-white outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}
