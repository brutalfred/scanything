## Goal

Stop people from farming free credits by creating many accounts.

## Important thing I found first

Right now there are **two** sources of free credits, not one:

1. The 5-credit signup grant (given the first time an account touches the credit system).
2. A **daily top-up to 25 credits** — the `ensure_credit_account` logic refills any account below 25 credits back up to 25 every day. That means even a single account gets 25 free credits per day, and any new account gets it too.

Blocking multi-account abuse is pointless while the daily 25-credit floor exists, so the plan removes it. New accounts get 5 once, and after that credits come from purchases or watching ads.

## What gets built

### 1. One free grant per device

- New server-only table `device_grants` (device hash, first user, timestamp). Not readable by users.
- The browser computes a stable device fingerprint (canvas + screen + platform + timezone + a persisted random ID in localStorage), hashed before it leaves the device.
- The signup grant moves out of the automatic account-creation path into an explicit "claim signup grant" server function that receives the device hash:
  - Device hash never seen before → grant 5 credits, record the device.
  - Device hash already used → account is created with **0** credits, and the app tells the user the free trial was already used on this device.
- Account creation itself no longer hands out credits, and the daily 25-credit refill is removed.

### 2. Block disposable email domains

- A curated list of throwaway-mail domains (mailinator, tempmail, guerrillamail, yopmail, 10minutemail, etc.).
- Checked in the sign-up form for an instant error message, and re-checked on the server before any grant, so bypassing the form gains nothing.

### 3. Explaining it to the user

- Sign-up form: clear inline error for a disposable address ("Please use a permanent email address").
- After signing in on a device that already used the trial: a friendly notice — the free trial has already been used on this device — with buttons to buy credits or watch an ad.

## Honest limits

A determined person can still get around a device check (new browser profile, incognito with cleared storage, another phone). This stops casual farming, not a motivated attacker. If you later want stronger protection, the next steps are requiring email verification before the grant, or IP-rate-limiting grants — say the word and I'll add either.

## Technical notes

- Migration: create `public.device_grants` (service-role only, RLS on, no anon/authenticated grants); rewrite `ensure_credit_account` to create a zero-balance account with no signup grant and no daily floor; add `claim_signup_grant(_device_hash text)` as SECURITY DEFINER, inserting into `device_grants` with a unique constraint on the hash so races can't double-grant.
- New `src/lib/device-id.ts` (browser fingerprint + SHA-256), `src/lib/email-domains.ts` (blocklist + validator).
- New `claimSignupGrant` server fn in `src/lib/credits.functions.ts` behind `requireSupabaseAuth`; called once after sign-in from the auth flow, returning `granted | already_used`.
- `src/lib/credits.ts`: drop `DAILY_FLOOR`; update any UI copy that mentions daily credits.
- `src/routes/auth.tsx`: disposable-domain validation and post-sign-in grant claim.
