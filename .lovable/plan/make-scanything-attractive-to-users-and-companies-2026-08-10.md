# Make Scanything attractive to users and companies

## What Scanything already has that a free identifier does not

A free identifier answers: "What is this?" Scanything already answers several follow-ups:

- **Value**: price estimate and resale-value range with a "sell / keep" verdict.
- **Commerce action**: one-tap resale-listing drafts and links to 30+ marketplaces.
- **Offline-first**: queued scans work without a signal.
- **Multi-page documents**: stitching, summarization, and per-box translation that does not depend on the app language.
- **Collections and history**: save scans, tag them, revisit them later.
- **Cross-platform**: web + Android app with a shared account and credit balance.
- **Privacy-aware**: no person identification, no license-plate lookup.

The app is a "what is this AND what do I do with it" tool, not just a labeler.

## What to build next

### 1. Subscription tiers: Scanything Pro and Scanything Max

Users run out of credits. Add two recurring plans:

- **Scanything Pro**: unlimited photo scans, document scans, resale scans, "analyze further", and resale listings.
- **Scanything Max**: everything in Pro + unlimited video / live-scan frames.

Implementation:

- Create Paddle subscription products for web (`scanything_pro`, `scanything_max`).
- Create matching Google Play subscription products for the Android app.
- Add a `plan` column to `subscriptions` so the backend can distinguish Pro from Max.
- Add a `play_subscriptions` table or extend the purchase log for Google Play subscription tokens.
- Update `withCredits`/`hasActiveSubscription` to waive costs only for the actions covered by the user's plan.
- Add subscription UI in the credit sheet and pricing page.
- Update terms, refund, and pricing copy to say subscriptions are available.

### 2. Make scan results more actionable

A free identifier stops at a label. Turn each scan into a next step:

- **"List on X"** buttons per marketplace: open the right listing page with pre-filled title, description, and price.
- **Copy listing** button: copy a platform-formatted draft (eBay title, Vinted description, etc.) to the clipboard.
- **Share as image** card: generate a card with the item photo, name, price, and best marketplace link.
- **Where to sell** ranking: show the top 3 marketplaces for this item based on category and country.
- **Find manual / support** link: search for the official manual or support page.
- **Price compare** chip: open retailer searches (Amazon, eBay, Walmart, etc.) in one tap.

### 3. Resale and company tools

For resellers and small businesses:

- **Bulk resale report**: from scan history, pick the best items to sell, total estimated value, and which marketplaces to use.
- **Export inventory CSV**: item name, category, condition, estimated value, currency, date, and links.
- **"Scanything for Business" page**: explain team use cases, volume, and how to get in touch.
- **Duplicate detection**: warn if the same item appears in multiple scans.

### 4. Growth loops

- **Referral credits**: give a unique invite link; both users get credits when the friend signs up and scans.
- **Weekly streak bonus**: already have daily check-ins; add a 7-day streak reward.
- **Public shareable scan**: let users share one scan result as a public page for social proof.

## Implementation phases

Phase 1 — Subscriptions foundation
- Add `plan` column to `subscriptions` and create Google Play subscription verification path.
- Define plan feature mapping (Pro vs Max).
- Update credit deduction logic to honor plan tiers.
- Build subscription UI in credit sheet and pricing page.
- Update terms/refund/pricing copy.

Phase 2 — Actionable resale flows
- Extend marketplace registry with per-platform listing templates.
- Add "copy listing", "share as image", and "where to sell" UI.
- Add manual and price-compare links.

Phase 3 — Company tools
- Build bulk resale report and inventory CSV export.
- Add "Scanything for Business" route.

Phase 4 — Growth loops
- Referral credits and shareable scan pages.

## Technical notes

- Android subscription purchases must use Google Play subscriptions.
- Web subscriptions can use Paddle; the existing webhook handler already supports Paddle subscriptions.
- `withCredits` already skips costs for active subscribers, but it needs to know which plan the user has.
- The existing webhook handler only writes Paddle subscriptions. A server function for Google Play subscription verification will mirror `redeemPlayPurchase`.
- Keep the daily free scan for all users, including subscribers.
- All credit and subscription checks must remain server-side.
