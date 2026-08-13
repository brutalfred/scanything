# Animated credit balance "tick"

Make the credit number roll up/down with a short animation and a subtle flash whenever the balance changes, instead of snapping to a new value.

## Behaviour

- When the balance changes, the number counts from the old value to the new one over ~600ms with an ease-out curve (fast start, soft landing).
- Gains: number briefly glows/scales up with a green-tinted flash and a small "+N" chip that floats up and fades.
- Spends: same roll-down with a muted red-tinted flash and a "-N" chip.
- First render and sign-in load do not animate — no tick from 0 to your balance on page load.
- Respects `prefers-reduced-motion`: value updates instantly, no flash or floating chip.

## Where it applies

- Header credit pill (`CreditMeter`) — main place users watch.
- Top-up sheet balance (`CreditsSheet`).
- Account tab balance row (`AccountButton`).

All three use the same shared piece so they behave identically.

## Technical notes

- New `src/components/credits/AnimatedCount.tsx`: a small hook + component that tweens between previous and next value with `requestAnimationFrame`, keeps `tabular-nums` so width doesn't jitter, and exposes the delta direction for styling.
- New CSS keyframes in `src/styles.css` for the flash pulse and the floating delta chip; colors come from existing semantic tokens, no hardcoded hex.
- Purely presentational — no changes to `useCredits`, server functions, or credit logic. Existing optimistic `noteSpend` updates will animate automatically since they change the same `balance` value.
- `aria-live="polite"` on the final value only, so screen readers announce the settled number rather than every intermediate frame.
