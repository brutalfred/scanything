Remove the anonymous 40-credit trial and keep only signed-in credit accounts. Anonymous users can still open the camera preview and look around, but every scan action (quick scan, photo scan, enrich, analyze further, translate, person info) will be gated behind a sign-in prompt. Signed-in users keep their 5-credit signup gift and daily floor.

### Changes

1. **`src/lib/credits.ts`**
   - Delete `ANON_TRIAL_CREDITS` and `ANON_STORAGE_KEY` constants.
   - Rewrite `readAnonCredits()` to always return `0`.
   - Make `writeAnonCredits()` a no-op (or remove it and clean up callers).

2. **`src/hooks/useCredits.ts`**
   - Remove the localStorage-backed `anonBalance` state and `ANON_TRIAL_CREDITS`/`readAnonCredits`/`writeAnonCredits` imports.
   - Treat anonymous users as having a balance of `0`.
   - Keep `signedIn` and `sessionReady` logic so the UI knows when the backend state is available.
   - `noteSpend` should do nothing when not signed in; the scan-gate logic will prevent anonymous spends from being attempted.

3. **`src/routes/index.tsx`**
   - Add a sign-in prompt overlay/modal when an anonymous user taps "Photo Scan", "Video Scan", or tries to trigger a paid action.
   - Keep the live camera preview and bounding boxes visible for anonymous users so they can "look around".
   - Disable or redirect the scan buttons to the sign-in prompt when not signed in.
   - Ensure the CreditMeter still shows `0` for anonymous users and links to the sign-in/purchase flow.

4. **Verification**
   - Build passes.
   - Playwright check: anonymous visitor sees `0` credits, camera preview works, and tapping a scan mode opens the sign-in sheet instead of starting a scan.
   - Signed-in user still gets the 5-credit signup grant and can scan normally.