import { useCallback, useRef, useState } from "react";

export type SlideDirection = "left" | "right" | "bottom";

const ENTER_CLASS: Record<SlideDirection, string> = {
  left: "slide-enter-left",
  right: "slide-enter-right",
  bottom: "slide-enter-bottom",
};

/**
 * Gives a popup panel a directional slide-in animation plus swipe-to-dismiss
 * in the same direction it came from. Spread the returned props on the panel.
 */
export function useSlideDismiss(direction: SlideDirection, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  const horizontal = direction !== "bottom";

  const finish = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      onClose();
      setClosing(false);
      setOffset(0);
    }, 180);
  }, [onClose]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (closing) return;
      if (e.pointerType === "mouse") return;
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[data-no-swipe]")) return;
      // Don't fight vertical scrolling inside the panel.
      if (!horizontal && (ref.current?.scrollTop ?? 0) > 0) return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    [closing, horizontal],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      let delta: number;
      if (direction === "bottom") {
        if (!dragging && Math.abs(dy) < Math.abs(dx)) return;
        delta = Math.max(0, dy);
      } else if (direction === "left") {
        if (!dragging && Math.abs(dx) < Math.abs(dy)) return;
        delta = Math.min(0, dx);
      } else {
        if (!dragging && Math.abs(dx) < Math.abs(dy)) return;
        delta = Math.max(0, dx);
      }
      if (!dragging && Math.abs(delta) < 6) return;
      setDragging(true);
      setOffset(delta);
    },
    [direction, dragging],
  );

  const end = useCallback(() => {
    if (!start.current) return;
    start.current = null;
    const threshold = horizontal ? 90 : 110;
    if (Math.abs(offset) > threshold) {
      finish();
    } else {
      setOffset(0);
    }
    setDragging(false);
  }, [finish, horizontal, offset]);

  const transform = offset
    ? horizontal
      ? `translateX(${offset}px)`
      : `translateY(${offset}px)`
    : undefined;

  const closingTransform =
    direction === "left"
      ? "translateX(-110%)"
      : direction === "right"
        ? "translateX(110%)"
        : "translateY(110%)";

  return {
    ref,
    className: closing || dragging || offset ? "" : ENTER_CLASS[direction],
    style: {
      transform: closing ? closingTransform : transform,
      opacity: closing ? 0 : undefined,
      transition: dragging ? "none" : "transform 180ms ease-out, opacity 180ms ease-out",
      touchAction: horizontal ? "pan-y" : "pan-x",
    } as React.CSSProperties,
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
  };
}
