## Goal

After a photo scan, let the user tap **Load more** to re-query the same captured image for objects the first pass missed, and append the new finds to the existing results list.

## Behavior

- Button appears under the results list only when a photo scan has produced results (snapshot exists, not scanning).
- Tapping it re-analyzes the *same* snapshot with a "second pass" prompt that tells the model which items were already found and to look specifically for smaller/occluded/background objects.
- New items are merged into the list, de-duplicated against existing names (and against the 60-second delete-blocklist), and the "Detected in view" / Categories tabs update.
- Costs the normal photo-scan credit price; the button label shows the cost (e.g. `Load more · 2`) and is disabled without enough credits, same gating as the scan button. Camera shutter/pop sounds stay consistent with existing behavior.
- If the pass returns nothing new, show a short "No additional items found" note instead of an empty change.
- Repeatable: can be pressed again, each time passing the full accumulated list as exclusions. Results are re-saved to the session snapshot cache and scan history like a normal scan.

## Technical details

- `src/lib/analyze-room.functions.ts`
  - Extend the photo-scan input schema with optional `excludeNames: string[]` and `pass: number`.
  - Add a `SECOND_PASS_SUFFIX` appended to the user message when `excludeNames` is non-empty: lists already-found names, instructs the model to skip them and hunt for small, partially hidden, background, or clustered objects; keeps the same JSON output shape and the same people/body-part and structural-surface rules.
  - Same model (`google/gemini-3-flash-preview`) and same `withCredits("photo_scan", ...)` wrapper, so the credit accounting and refund-on-failure path are unchanged.
- `src/routes/index.tsx`
  - New `loadingMore` state and a `loadMore()` handler that calls `analyzeRoom` with the stored snapshot plus the current item names, then merges results with normalized-name de-dup (reusing the existing `normName` helper) and keeps prior items' order.
  - Render the button below the results list inside the existing snapshot results block, styled with the current theme tokens.
