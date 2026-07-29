Remove the ad-reward flow entirely. The app will switch to a clean pay-per-scan credit model, with the 5 free signup credits as the only no-cost entry point.

What this plan covers:

1. UI cleanup
   - Remove the "Watch an ad for X credits" button from the Credits sheet.
   - Delete the `AdRewardModal` component and its placeholder ad player.
   - Remove the ad-related props/state from `useCredits`.
   - Update the free-trial notice text so it no longer says "watch an ad".

2. Server functions cleanup
   - Delete `startAdSession`, `claimAdReward`, and `getAdRewardStatus` from `src/lib/credits.functions.ts`.
   - Delete the `src/lib/ad-errors.ts` helper.
   - Remove `AD_DAILY_LIMIT` and `AD_REWARD_CREDITS` from `src/lib/credit-packs.ts`.
   - Remove `AD_REWARD_CREDITS`/`scansPerAd` from `src/lib/economics.ts` and keep only the cost-tracking side.

3. Backend cleanup
   - Add a migration that drops the `ad_sessions` table and the `start_ad_session`, `claim_ad_reward`, `get_ad_reward_status` functions.
   - Keep the `ai_usage` table and credit ledger intact.

4. Owner economics page
   - Keep `/economics` but remove the ad-vs-scan comparison section; it will show only AI cost per scan and total credit spend.

5. What is NOT changed
   - Paddle top-up packs ($1 / $5 / $10 / $50) stay.
   - The 5-credit signup grant stays.
   - Credit costs per scan (photo, live, enrich, analyze further, translate, person lookup) stay the same.
   - The device-fingerprint anti-abuse rules for the signup grant stay.

After this plan is approved, the app will no longer advertise or support rewarded ads; users will either use their 5 signup credits or buy top-ups.