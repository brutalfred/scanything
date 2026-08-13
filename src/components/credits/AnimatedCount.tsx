import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DURATION = 600;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tweens between the previous and next value with requestAnimationFrame.
 * Returns the displayed value plus the pending delta (0 when settled).
 */
export function useAnimatedCount(value: number) {
  const [display, setDisplay] = useState(value);
  const [delta, setDelta] = useState(0);
  const prev = useRef(value);
  const first = useRef(true);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;

    // No tick on the first paint / initial load.
    if (first.current) {
      first.current = false;
      setDisplay(value);
      return;
    }
    if (from === value) return;

    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    setDelta(value - from);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };
    raf.current = requestAnimationFrame(step);

    const clearDelta = setTimeout(() => setDelta(0), 900);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      clearTimeout(clearDelta);
    };
  }, [value]);

  return { display, delta };
}

export function AnimatedCount({
  value,
  className,
  showDelta = true,
}: {
  value: number;
  className?: string;
  showDelta?: boolean;
}) {
  const { display, delta } = useAnimatedCount(value);

  return (
    <span className={cn("relative inline-flex tabular-nums", className)}>
      <span
        key={delta !== 0 ? `d-${value}` : "idle"}
        className={cn(
          delta > 0 && "credit-tick-up",
          delta < 0 && "credit-tick-down",
        )}
      >
        {display}
      </span>
      <span className="sr-only" aria-live="polite">
        {value}
      </span>
      {showDelta && delta !== 0 && (
        <span
          aria-hidden
          className={cn(
            "credit-delta-chip pointer-events-none absolute -top-1 left-full ml-1 text-[0.6em] font-bold",
            delta > 0 ? "text-emerald-400" : "text-destructive",
          )}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  );
}
