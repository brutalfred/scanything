## Goal

Add a scan-credit system to Scanything so every AI call (quick scan, photo scan, enrich, deep analyze, translate, person lookup) draws from a per-user credit balance instead of running unlimited. The "bridge" is a single server-side gate that sits between the UI and the AI Gateway: it checks and debits credits before any model call and records what was spent.

## Behaviour

- Each user has a credit balance, stored in Lovable Cloud (needs to be enabled — database + auth).
- Anonymous visitors get a small free trial allowance tracked locally so the app is still usable before sign-in; signing in migrates them onto a real balance.
- Costs per action (tunable in one constants file):
  - Live video quick scan frame — 1 credit
  - Photo scan — 2 credits
  - Background item enrichment — 1 credit
  - Analyze further (Pro model) — 5 credits
  - Translate — 1 credit
  - Person info — 3 credits
- New signups get a starting grant (e.g. 100 credits), plus a daily free top-up (e.g. 25/day, not cumulative) applied on first use each day.
- When the balance hits 0: live scanning pauses automatically, the scan buttons disable, and a "Out of credits" panel appears explaining the daily refill and offering a top-up.

## UI

- Gold credit meter in the header next to the flashlight/filter buttons: coin icon + remaining balance, turning amber under 20 and red at 0.
- Tapping it opens a credits sheet: current balance, next daily refill time, a cost table for each action, and recent spend history.
- Detail panel buttons ("Analyze further", "Translate", person lookup) show their cost inline (e.g. "Analyze further · 5") and are disabled when the balance is short.
- Live video mode shows a small "credits: N" tick in the status pill and stops the loop cleanly instead of erroring.

## Technical details

**Cloud schema** (one migration, with GRANTs + RLS):
- `credit_accounts` — `user_id` (PK, references auth.users), `balance int`, `last_daily_grant_at timestamptz`, timestamps. RLS: owner can select; writes only via security-definer functions.
- `credit_ledger` — `id`, `user_id`, `delta int`, `reason text`, `metadata jsonb`, `created_at`. RLS: owner select only.
- `spend_credits(_amount int, _reason text, _metadata jsonb)` — security-definer function that applies the daily grant if due, checks balance, debits atomically, writes a ledger row, and returns the new balance or raises on insufficient funds.
- `grant_credits(...)` — service-role only, used for top-ups/refunds.

**Server bridge** (`src/lib/credits.functions.ts` + `src/lib/credits.server.ts`):
- `getCreditState` — returns balance, next refill, and recent ledger for the signed-in user.
- A `withCredits(cost, reason, fn)` helper used inside each existing handler in `src/lib/analyze-room.functions.ts`: debit first, run the AI call, and refund the debit if the gateway call throws (so failed scans are free).
- All existing analyze functions gain `.middleware([requireSupabaseAuth])` where a balance is required; the anonymous trial path keeps the current unauthenticated behaviour but is rate-capped server-side by a per-session counter.

**Client** (`src/routes/index.tsx` + new `src/components/credits/*`):
- `useCredits` hook wrapping `getCreditState` via TanStack Query, with optimistic local decrement after each successful scan and refetch on error.
- `CreditMeter` (header) and `CreditsSheet` (dialog) as separate small components to keep `index.tsx` from growing further.
- Scan loop checks the balance before dispatching each frame; on `insufficient_credits` it pauses video mode and opens the credits sheet.

**Not included** (say the word and I'll add it): real money purchase flow via Stripe/Paddle. This plan gets the balance, gating, and top-up grants in place; a payment provider can be wired to `grant_credits` afterwards.
