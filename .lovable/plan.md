## Goal

One completed rewarded ad should be worth exactly one average scan — in real dollars, not just in credits.

Right now the app has no measurement of what a scan actually costs: the AI Gateway log window for this project returns no requests, so the per-scan cost is unknown and the current "2 credits per photo scan / 2 credits per ad" pairing is an assumption, not a measured match. So the work is: measure the cost, express it in one place, then set the ad reward from it.

## 1. Measure the real cost per scan

- Record token usage returned by each Lovable AI call (quick scan, enrich, deep analyze, translate) into a new `ai_usage` table: user, action, model, input/output tokens, estimated cost in USD micro-cents, timestamp.
- Write the row from the server function that made the call, so nothing client-side can forge it.
- Add a small helper that converts token counts to USD using a per-model rate table kept in one file.

## 2. Single source of truth for economics

Create `src/lib/economics.ts` holding:

```text
AD_REVENUE_PER_VIEW_USD   = 0.008   (AdMob rewarded, conservative)
CREDIT_VALUE_USD          = derived from the $ packs (currently ~$0.15/credit)
SCAN_COST_USD             = measured average, seeded at an estimate
AD_REWARD_CREDITS         = round(AD_REVENUE_PER_VIEW_USD / SCAN_COST_USD) scans -> credits
```

The credits per scan and the ad reward stop being loose constants scattered across `credit-packs.ts`, `claim_ad_reward`, `get_ad_reward_status`, and `start_ad_session`; they all read from the same numbers.

## 3. Align the ad reward

- Update the `claim_ad_reward` and `get_ad_reward_status` database functions so the reward constant matches the economics value instead of the hardcoded `2`.
- Target: one ad = one photo scan, break-even. If the measured scan cost later comes in above the AdMob revenue per view, the same constant is the only thing to change — optionally raising it to 2 ads per scan.
- Keep the daily cap (5) and the 14-second minimum watch, so the maximum daily give-away per user stays bounded and revenue-backed.

## 4. Owner visibility

- Add a compact economics readout (owner-only view) showing: average measured cost per scan over the last 7/30 days, total ads watched, implied ad revenue, and net margin. This is what tells you whether the match is holding once real traffic arrives.

## Technical notes

- New table `ai_usage` with RLS: users may read only their own rows; inserts happen through a security-definer function called from server functions. Grants for `authenticated` and `service_role`.
- The AdMob revenue figure is an assumption until real AdMob reporting exists; it lives in `economics.ts` as a single editable constant, with a comment on where to update it from the AdMob dashboard.
- The placeholder ad player in `AdRewardModal.tsx` is untouched by this change — it still needs a real AdMob rewarded unit before any actual revenue exists.
