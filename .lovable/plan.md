# Plan: Professional Welcome Modal Redesign

## Goal
Redesign the "Good to know" sign-in popup to feel more premium, polished, and on-brand while keeping the existing dark theme and the same informational content.

## Chosen direction
**Premium obsidian gold** — single-column layout, centered heading with a subtle "Welcome" label, icon-driven list items, and a gold gradient CTA button.

## Locked constraints from your choices
- **Palette:** Same as the active Scanything theme (dark background, gold/primary accents).
- **Typography:** Sora for headings, Manrope for body text.
- **Layout:** Single column, centered, compact modal.

## What will change

### 1. `src/components/WelcomeInfoModal.tsx`
- Replace the plain bullet list with a vertically spaced list of icon + text rows.
- Add a centered header block: small "Welcome" label above the "Good to know" title, with a short decorative gold divider below.
- Keep the current backdrop (`bg-black/80`) and modal container (`bg-card`, `rounded-2xl`, `gold-glow`) but refine inner spacing to match the prototype.
- Redesign the "Got it" button to use the gold gradient with a subtle shadow and active-scale press state.
- Preserve existing behavior: opens once per signed-in session via `sessionStorage`, dismisses on backdrop click or close button, and closes with the CTA.
- Keep the original warning items: AI costs, video-mode drains credits, app purpose, and photo-quality tip.

### 2. `src/routes/__root.tsx`
- Add Google Fonts `<link>` tags for **Sora** and **Manrope** so the chosen typography can be applied safely without relying on system fonts.
- Add CSS font-family variables to `src/styles.css` (or theme) mapping `--font-heading` and `--font-body` to Sora and Manrope.

### 3. `src/styles.css` (minor)
- Add `font-heading` and `font-body` utilities if they are not already present, so the modal can use them without hardcoded font names.
- Ensure the new modal still uses semantic tokens (`bg-card`, `text-primary`, `border-primary/70`, etc.) so it adapts to the user's theme (Gold, Matrix, Camo, Peach, Water).

## What will not change
- No functional changes to the app's scanning, credits, or auth flows.
- No new content/copy beyond what already exists in the modal.
- No new routes or dependencies other than the Google Fonts links.

## Verification
- After the change, the modal will be manually opened in the preview and compared to the selected prototype for visual match.
- The close/dismiss behavior will be tested to ensure it still works via the backdrop, X button, and "Got it" button.
