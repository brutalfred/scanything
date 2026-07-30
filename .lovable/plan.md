## Goal

An owner-only page where you can add credits to any account by email, any time — plus an immediate 1000-credit top-up to your own account.

## 1. Admin role (secure, not email-hardcoded)

Add a proper roles table so admin access can't be spoofed from the browser:

- `app_role` enum (`admin`, `user`) and a `user_roles` table (user_id + role, unique).
- Grants + RLS: signed-in users can read their own roles; only the backend can write them.
- `has_role(_user_id, _role)` security-definer function for checks.
- Seed your account (`frepaulsson@gmail.com`) as `admin`.

## 2. Credit top-up now

Grant **1000 credits** to your account through the existing `grant_credits` function, logged in the credit ledger as an admin grant.

## 3. Owner-only admin page (`/admin`)

A themed page matching the current app theme, reachable only when your account has the admin role (non-admins get a "not authorized" message; no link is shown to anyone else).

Contents:
- Email field + credit amount field + "Grant credits" button.
- Result feedback: new balance, or a clear error if the email has no account.
- A short list of the most recent admin grants for reference.

## 4. Backend server function

New authenticated server function `adminGrantCredits`:
- Verifies the caller is signed in, then verifies `has_role(caller, 'admin')` — refuses otherwise.
- Looks up the target user by email via the admin auth API.
- Calls the existing `grant_credits` function with a reason like `admin_grant`.
- Validates amount (1–100000) and returns the new balance.

Also a small `getIsAdmin` check so the page can render the right state.

## 5. Entry point

Add an "Admin" link inside the account modal, visible only when the signed-in account has the admin role.

## Technical notes

- Roles live in a dedicated `user_roles` table (never on a profile row) to avoid privilege-escalation.
- The grant path uses the service-role client only after the admin role check passes, inside the handler.
- No changes to the purchase/Paddle flow; admin grants are recorded in `credit_ledger` so they show in the credits sheet history.
