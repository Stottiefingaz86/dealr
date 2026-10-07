"use client";

import { useEffect, useRef } from "react";
import { fireWinConfetti } from "@/lib/confetti";

/** Fires the canvas confetti sequence once per win. */
export function WinConfetti({ active, big = false }: { active: boolean; big?: boolean }) {
  const fired = useRef(false);

  useEffect(() => {
    if (!active) {
      fired.current = false;
      return;
    }
    if (fired.current) {
      return;
    }
    fired.current = true;
    fireWinConfetti(big);
  }, [active, big]);

  return null;
}
