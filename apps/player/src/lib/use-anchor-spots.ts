"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import type { TableSpot } from "@live-dealr/environments";

/**
 * Measures `[data-seat-anchor]` elements (even inside 3D transforms) and
 * returns their centres as viewport-% spots relative to the container.
 */
export function useAnchorSpots(
  containerRef: RefObject<HTMLElement | null>,
  dependency: unknown,
): Record<number, TableSpot> {
  const [spots, setSpots] = useState<Record<number, TableSpot>>({});

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frame = 0;
    const measure = () => {
      const bounds = container.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }
      const next: Record<number, TableSpot> = {};
      container.querySelectorAll<HTMLElement>("[data-seat-anchor]").forEach((el) => {
        const seat = Number(el.dataset.seatAnchor);
        const rect = el.getBoundingClientRect();
        next[seat] = {
          x: ((rect.left + rect.width / 2 - bounds.left) / bounds.width) * 100,
          y: ((rect.top + rect.height / 2 - bounds.top) / bounds.height) * 100,
        };
      });
      setSpots((prev) => {
        const keys = Object.keys(next);
        if (
          keys.length === Object.keys(prev).length &&
          keys.every((k) => {
            const a = prev[Number(k)];
            const b = next[Number(k)]!;
            return a && Math.abs(a.x - b.x) < 0.2 && Math.abs(a.y - b.y) < 0.2;
          })
        ) {
          return prev;
        }
        return next;
      });
    };

    // Standees animate in; measure now and again shortly after.
    measure();
    const t = window.setTimeout(measure, 500);
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [containerRef, dependency]);

  return spots;
}
