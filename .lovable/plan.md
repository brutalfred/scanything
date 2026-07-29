Fix the signup credit grant mismatch so new users actually receive 5 credits instead of 100.

## Problem
The UI tells users they will get "5 free credits" when signing in, but the backend function `public.ensure_credit_account()` currently grants 100 credits on first account creation. This creates a pricing/expectation mismatch.

## Plan

1. Update the signup grant value
   - Create a new migration (or update the existing one if it has not been applied) that changes `starting_grant` from 100 to 5 in `public.ensure_credit_account(_user_id uuid)`.
   - The migration should recreate the function with the corrected constant.

2. Verify the ledger reason stays consistent
   - Keep the `signup_grant` ledger reason unchanged.

3. Verify UI copy matches
   - Confirm `src/routes/index.tsx` still says "Sign in for your 5 free credits and get started." (no change needed).

4. Validate the migration
   - Run the migration tool and check that the function definition is updated in the database.

## Scope
Only the signup grant constant is changed. No changes to daily floor, credit costs, ad rewards, or purchase packs.