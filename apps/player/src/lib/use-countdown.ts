"use client";

import { useEffect, useState } from "react";

export function useCountdown(closesAt: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!closesAt) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const ms = new Date(closesAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [closesAt]);

  return remaining;
}
