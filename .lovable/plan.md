# Scanning-line logo animation

## What
Add a thin, luminous "scanning line" that travels slowly from the top of the logo down to the bottom and loops, like a scanner sweeping over the wordmark. Pure CSS — no image files, no JS.

## How
- In `src/components/PlanLogo.tsx`: wrap the `<img>` in a `relative overflow-hidden` span and add a `::after`-style overlay element (a `<span>` with class `logo-scan-line`) positioned `absolute inset-0`, a 2–3px tall gold gradient bar, `mix-blend-mode: screen` so it lights up the logo pixels.
- In `src/styles.css`: add a `@keyframes logo-scan` that moves `translateY` from `0%` to `100%` over ~2.6s ease-in-out, with a brief pause at each end. Apply it to `.logo-scan-line` with `animation: logo-scan 2.6s ease-in-out infinite`. Respect `prefers-reduced-motion` (disable animation).
- The line only appears over the logo image area; the Pro/Max glow `::before` stays behind the image (`z-index: -1`), scan line sits above the image but below pointer events (`pointer-events: none`).

## Scope
- Only `src/components/PlanLogo.tsx` and `src/styles.css`.
- Applies to the header logo on the home screen (the main `PlanLogo` usage). The small `PlanBadge` is left untouched.

## Technical note (non-technical summary)
This is a frontend-only visual effect — no new assets, no backend, no .aab rebuild needed for the web preview (Android users would still need a fresh build to see it in the app).
