# Fixing the "organization account required" rejection

Google is not rejecting your code. This message comes from the **App content declarations** in Play Console. One of your answers told Google that Scanything is a *financial* app (or a health/VPN/government app), and since August 2024 those categories can only be published by an organization account — not a personal one.

Scanything is not a financial app. It is a camera + AI recognition app that happens to sell credits as in-app purchases. Selling digital products is completely normal for a personal account. So the fix is to correct the declarations, not to register a company.

## Part 1 — Fix the declarations in Play Console (do this first)

Open Play Console → select **Scanything** → left menu **Policy and programs → App content**.

Go through these sections:

1. **Financial features**
   - Open it.
   - Select **"My app doesn't provide any financial features"**.
   - Do NOT tick: investment, crypto, loans, banking, insurance, debt management, or "other financial features".
   - Selling credits for AI scans is an in-app purchase, not a financial feature.
   - Save.

2. **Health apps**
   - Select **"My app is not a health app"**. Save.

3. **Data safety**
   - Keep this as it is, but make sure it states: camera images are sent to an AI provider for processing, and account email is collected. Do not tick anything about financial info or health info.

4. **Government apps** (if shown)
   - Select **No**. Save.

5. **App access**
   - Provide a test account (email + password) so the reviewer can sign in and see the scanner, since scanning requires an account.

Then go to **Grow → Store presence → Store listing** (and **Store settings**):

6. **App category**
   - Set category to **Tools** (alternative: *Photography*, *Productivity* or *Shopping*).
   - It must **not** be **Finance**, **Medical**, or **Health & Fitness** — Finance alone triggers the organization requirement.
   - Save.

7. **Monetisation**
   - In **Monetise → Products → In-app products**, keeping your credit packs is fine and expected.
   - The only place you should confirm "this app contains in-app purchases" is the store listing "Contains ads / In-app purchases" flag — that flag is fine and does not require an organization.

8. Re-submit the release for review.

## Part 2 — Optional in-app wording clean-up

The listing and in-app copy currently lean on resale/value language ("Resale Scan", "price estimates", "value"). That does not require a company account, but it is what makes a reviewer read the app as finance-adjacent. To be safe I would:

- Keep the Resale Scan feature, but describe it in the store listing as *"estimated second-hand price range, for information only"*.
- Add a short disclaimer line to the resale result box and to the welcome info modal: *"Price ranges are AI estimates for guidance only and are not financial advice or a valuation."*
- Make sure the store listing description leads with "AI camera scanner / object identification" and not with pricing or value.

## Technical notes

- No native changes needed: no new AAB, no `versionCode` bump, no `npm install`/`cap sync`. The manifest declares only `INTERNET`, `CAMERA`, `FLASHLIGHT` and `com.android.vending.BILLING` — nothing that triggers the organization rule (in particular, no `VpnService`).
- If Part 2 is approved, the changes are text-only: a disclaimer string added to the resale result panel and the welcome modal, translated across the existing 15 app languages.

## What I need from you

Confirm whether you want me to also apply Part 2 (the disclaimer wording). Part 1 is done entirely by you inside Play Console — I cannot click those screens for you.
