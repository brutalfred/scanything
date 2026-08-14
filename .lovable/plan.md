# Scrollable panels that still swipe away

Right now each popup panel is both the scroll container and the swipe target, so long panels (scan history, account, credits) can fight the swipe gesture: a downward flick mid-list can be read as "dismiss", and the check for "am I at the top?" only looks at the outer panel, not at inner scrolling lists.

## How it should behave

- Vertical scrolling inside a panel always wins while there is content left to scroll.
- A bottom sheet only starts to drag away when the content is already scrolled to the very top and the finger moves down.
- Left/right panels (account, credits) drag away only on a clearly sideways gesture; up/down always scrolls.
- Once a gesture is decided (scroll vs. dismiss), it stays that way until the finger lifts — no mid-gesture switching.
- Optional grab handle at the top of bottom sheets that always dismisses, so users have a reliable drag spot.

## Technical changes

**`src/hooks/useSlideDismiss.ts`**

1. Axis/intent lock: on the first ~8px of movement, decide once per gesture — `scroll` or `dismiss` — and store it in a ref. If `scroll`, ignore all further movement for that gesture.
2. Nearest-scrollable check: from `e.target`, walk up to the panel and find the first ancestor with `overflow-y: auto|scroll` and `scrollHeight > clientHeight`. For a bottom sheet, only allow `dismiss` when that element's `scrollTop <= 0`; for left/right, only when horizontal movement dominates (ratio > 1.5) so diagonal drags scroll instead.
3. Mark an element with `data-swipe-handle` to force `dismiss` regardless of scroll position (used by the grab handle).
4. Keep `touch-action` as is, and add `overscroll-behavior: contain` to the panel so a scroll at the edge doesn't chain to the page behind.
5. Add `onLostPointerCapture` cleanup so an interrupted gesture resets the offset.

**Panel markup (`ScanHistorySheet`, `WelcomeInfoModal`, `OnboardingTour`, `AiConsentModal`, `CreditsSheet`, `AccountButton`, and the bottom sheets in `src/routes/index.tsx`)**

- Restructure each panel from "one scrolling box" to: fixed header (title + close, plus a small grab handle on bottom sheets) / `flex-1 min-h-0 overflow-y-auto` body / optional fixed footer. This keeps the swipe target stable while the body scrolls.
- Move `max-h-[85vh]` to the outer flex column and put `overflow-y-auto` on the body only.

No behaviour changes to the ad modal or any business logic.
