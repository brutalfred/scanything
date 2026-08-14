import { useCallback, useRef, useState } from "react";

export type SlideDirection = "left" | "right" | "bottom";

const ENTER_CLASS: Record<SlideDirection, string> = {
  left: "slide-enter-left",
  right: "slide-enter-right",
  bottom: "slide-enter-bottom",
};

type Intent = "undecided" | "scroll" | "dismiss";

/** Nearest scrollable ancestor between `from` and `root` (inclusive of both). */
function nearestScrollable(from: HTMLElement | null, root: HTMLElement | null) {
  let el: HTMLElement | null = from;
  while (el) {
    const style = window.getComputedStyle(el);
    const scrollable =
      /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (scrollable) return el;
    if (el === root) break;
    el = el.parentElement;
  }
  return root;
}

/**
 * Gives a popup panel a directional slide-in animation plus swipe-to-dismiss
 * in the same direction it came from, without stealing inner scrolling.
 * Spread the returned props on the panel.
 */
export function useSlideDismiss(direction: SlideDirection, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const intent = useRef<Intent>("undecided");
  const scroller = useRef<HTMLElement | null>(null);
  const forceHandle = useRef(false);
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

  const reset = useCallback(() => {
    start.current = null;
    intent.current = "undecided";
    scroller.current = null;
    forceHandle.current = false;
    setDragging(false);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (closing) return;
      if (e.pointerType === "mouse") return;
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[data-no-swipe]")) return;
      forceHandle.current = !!target.closest("[data-swipe-handle]");
      scroller.current = forceHandle.current
        ? null
        : nearestScrollable(target, ref.current);
      intent.current = "undecided";
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    [closing],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      if (intent.current === "scroll") return;

      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;

      // Decide once per gesture: scroll or dismiss.
      if (intent.current === "undecided") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (forceHandle.current) {
          intent.current = "dismiss";
        } else if (direction === "bottom") {
          const atTop = (scroller.current?.scrollTop ?? 0) <= 0;
          intent.current = atTop && dy > 0 && dy > Math.abs(dx) ? "dismiss" : "scroll";
        } else {
          // Sideways must clearly dominate, otherwise let the panel scroll.
          intent.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? "dismiss" : "scroll";
        }
        if (intent.current === "scroll") return;
        setDragging(true);
      }

      let delta: number;
      if (direction === "bottom") delta = Math.max(0, dy);
      else if (direction === "left") delta = Math.min(0, dx);
      else delta = Math.max(0, dx);
      setOffset(delta);
    },
    [direction],
  );

  const end = useCallback(() => {
    if (!start.current) return;
    const wasDismiss = intent.current === "dismiss";
    reset();
    if (!wasDismiss) {
      setOffset(0);
      return;
    }
    const threshold = horizontal ? 90 : 110;
    if (Math.abs(offset) > threshold) finish();
    else setOffset(0);
  }, [finish, horizontal, offset, reset]);

  const cancel = useCallback(() => {
    if (!start.current) return;
    reset();
    setOffset(0);
  }, [reset]);

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
      touchAction: horizontal ? "pan-y" : "pan-x pan-y",
      overscrollBehavior: "contain",
    } as React.CSSProperties,
    onPointerDown,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  };
}
