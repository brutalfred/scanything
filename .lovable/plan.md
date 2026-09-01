# Pi Network sign-in for Scanything

The text Pi sent you is a valid description of their standard auth flow: load the Pi SDK, `Pi.init(...)`, `Pi.authenticate(['username'])`, then have the backend verify the returned access token against `https://api.minepi.com/v2/me`. No Pi API key needed for auth-only.

Two adjustments to their wording, so it fits this app:

- Auto-trigger only inside the Pi Browser. Firing it on every load would throw errors for normal web and Android users, since the Pi SDK doesn't exist there.
- Pi returns a Pi identity, not a Scanything account. Credits, history and subscriptions all hang off the backend account, so Pi identities get mapped onto one.

## Behaviour

Pi Browser, not signed in:
1. App loads, Pi SDK initialises, authentication runs automatically (with a visible "Continue with Pi" button as fallback and for retries).
2. Backend verifies the token with Pi, then signs the user into a Pi-backed account keyed to their Pi user id.
3. First time through, the account is created and gets the normal new-account credit grant. After that it's the same account every time.

Pi Browser, already signed in with email/Google:
- Instead of creating a second account, the Pi identity is linked to the current account. A "Pi connected: @username" line shows in the account tab, with an option to unlink.

Everywhere else (normal web, Android app):
- Nothing changes. No SDK load, no auto sign-in, no Pi button.

Pi-backed accounts have no real email address, so password reset and email sign-in don't apply to them — they sign in through the Pi Browser. That's called out in the account tab.

## Technical details

Database (one migration):
- `public.pi_identities` — `pi_uid` (primary key), `user_id` → `auth.users(id)` on delete cascade, `pi_username`, `created_at`. GRANTs for `authenticated` (select own) and `service_role`; RLS on, policy scoped to `auth.uid() = user_id`.

Client:
- `src/lib/pi.ts` — detects the Pi Browser, injects `https://sdk.minepi.com/pi-sdk.js` once, awaits `Pi.init({ version: "2.0" })` as a promise, then `Pi.authenticate(['username'], onIncompletePaymentFound)`.
- `src/hooks/usePiAuth.ts` — runs the flow on mount when in the Pi Browser and no session-linked Pi identity exists yet; also exposes a manual `signInWithPi()` for the button.
- Button rendered on `/auth` and in the account tab, only when the Pi SDK is present.

Server (`src/lib/pi.functions.ts`, `createServerFn`):
- `piSignIn` — takes `{ accessToken }`, calls `GET https://api.minepi.com/v2/me` with `Authorization: Bearer <token>`; rejects on non-200. On success, loads `supabaseAdmin` inside the handler, looks up `pi_identities` by `pi_uid`; creates the account (`pi_<uid>@pi.scanything.app`, email confirmed) and identity row if absent. Returns a one-time magic-link token via `auth.admin.generateLink`, which the client redeems with `supabase.auth.verifyOtp` to establish the session — no password is ever shipped to the browser.
- `piLink` — `requireSupabaseAuth`; verifies the Pi token the same way and inserts the identity row against the signed-in user, failing if that Pi uid is already linked elsewhere.
- `piUnlink` — `requireSupabaseAuth`; deletes the caller's identity row.

Structured so Pi payments can be added later as a separate server function without reworking this.

## Not included

- Pi payments / credit purchases with Pi.
- Listing submission to the Pi app directory (that's done on Pi's side once this ships).
