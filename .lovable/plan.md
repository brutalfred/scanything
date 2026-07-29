## Goal

Make the "Watch ad for free credits" reward impossible to farm from the browser. Today the daily 5-claim limit is already enforced in the database, but the claim itself is trusted: anything that calls the claim endpoint gets 2 credits, with no proof an ad was actually watched and no gap required between claims.

## What is weak right now

- `claim_ad_reward()` correctly inserts a row in `ad_reward_claims` and blocks the 6th claim of the day (verified in the database functions).
- But the client can call `claimAdReward()` directly — skipping the 15-second player entirely — and can fire all 5 daily claims within a second.
- Nothing ties a claim to a specific ad view, so a replayed request looks identical to a genuine one.

## The fix: server-issued ad sessions

1. **Start a session before the ad plays.** When the user opens the ad modal, the app asks the server for an ad session. The server records who asked and when, and returns a one-time token.
2. **Claim with that token.** When the player finishes, the app sends the token back. The server grants credits only if:
   - the token belongs to the signed-in user,
   - it has not been used before (one-time, marked used atomically),
   - at least the full ad duration has passed since the session started,
   - it is not older than a few minutes (expired tokens are rejected),
   - the user is still under the daily limit.
3. **Add a short cooldown** between successful rewards (e.g. 60 seconds) so the 5 daily rewards can't all be collected instantly.
4. **Keep the client honest but not trusted.** The modal still counts down, but the countdown is decoration — the server's own timestamps decide.

## User-visible behaviour

- Normal users see no change: watch the ad, collect 2 credits.
- Closing the ad early and reopening simply starts a new session; no credit is granted.
- If a reward is attempted too soon after the last one, the app shows "Please wait a moment before your next free ad" instead of granting.
- Daily limit messaging stays as it is ("No free ads left today").

## Technical details

- New table `public.ad_sessions` (`id`, `user_id`, `created_at`, `used_at`), with GRANTs for `authenticated`/`service_role`, RLS enabled, and a select-own policy; inserts/updates happen only through security-definer functions.
- New DB function `start_ad_session()` — security definer, requires `auth.uid()`, enforces the daily limit up front and the cooldown against the last `ad_reward_claims` row, returns the session id.
- Rewrite `claim_ad_reward()` to take `_session_id uuid`: validates ownership, unused state, `now() - created_at >= 15 seconds`, `now() - created_at <= 10 minutes`, daily limit, and cooldown; marks the session used and grants credits in the same transaction. Distinct error codes (`ad_limit_reached`, `ad_too_fast`, `ad_session_invalid`, `ad_cooldown`) so the UI can message properly.
- `src/lib/credits.functions.ts` — add `startAdSession` server fn; `claimAdReward` now takes the session id.
- `src/hooks/useCredits.ts` — `claimAd(sessionId)`; map the new error codes to friendly toasts.
- `src/components/credits/AdRewardModal.tsx` — request a session on mount, hold the id, pass it to the claim call, and disable the collect button until the session exists.

No schema change to `credit_accounts`, `credit_ledger`, or the existing pricing/packs.
