# Scanything growth plan

## Goals
- Turn the existing credit-pay-per-scan app into a recurring-revenue product with a Pro subscription tier.
- Add differentiated AI scan modes that justify the subscription while keeping the core camera experience fast and mobile-native.
- Keep the consumer core simple, but start a lightweight B2B path through exportable inventory reports.

## Recommended monetization model
- **Keep credit packs** ($1/$5/$10/$50) for casual / pay-as-you-go users.
- **Add Pro monthly/yearly subscription** for power users: unlimited scans, plus Pro-only AI modes and sound/theme unlocks.
- **Add Business/Team tier** (later): bulk scan exports, PDF reports, shared workspaces.
- Retain 5-credit signup grant and daily check-in streak so free users still convert gradually.

## Phase 1 — Subscription tier & pricing catalog
1. Create Paddle products/prices for subscription plans: `pro_monthly`, `pro_yearly`.
2. Extend the credit system to support subscription-derived allowances:
   - Add `subscriptions` table (user_id, status, plan_id, current_period_end, environment).
   - Gate free scan quota on active subscription status instead of only credit balance.
3. Update the CreditsSheet/Account modal:
   - Show "Upgrade to Pro" card alongside credit packs.
   - Add a "Manage subscription" link to Paddle customer portal.
4. Add a Pro badge to the UI and restrict Pro AI modes until subscribed.

## Phase 2 — Deeper AI scan modes
Add at least four new scan modes behind the Pro tier or per-use credits. Each uses the existing Gemini image pipeline but with focused prompts and structured output.

1. **Document / Receipt scanner** — extract text, totals, dates, line items; export as text or structured JSON. Useful for business users.
2. **Barcode & QR scanner** — read UPC/EAN/ISBN and fetch product links/prices. Consumer convenience + affiliate potential.
3. **Plant, pet & food identifier** — specialized classification with care/diet info. High shareability for social growth.
4. **Room measurement estimator** — estimate dimensions from a photo and generate a simple inventory list. Bridges to insurance/moving use cases.
5. **Batch / multi-item scan report** — take one photo, list all items with estimated resale value and export to CSV/PDF. B2B-ready.

Implementation path:
- Reuse the existing `analyze-room.functions.ts` server function pattern.
- Add `mode` parameter (`general`, `document`, `barcode`, `bio`, `room`, `batch`).
- Keep each mode's prompt and schema in a dedicated server file (`src/lib/scan-modes/`) so future modes are cheap to add.
- Return unified `ScanResult[]` shape so the existing bounding-box and detail UI works across modes.

## Phase 3 — Mobile-first polish
1. Improve PWA install flow:
   - Prominent "Add to Home Screen" prompt in account tab (already partially there).
   - Add standalone display mode and theme-color meta tags.
2. Camera UX:
   - Tap-to-focus hint on mobile.
   - Haptic feedback on scan success (use `navigator.vibrate`).
   - Keep scan history accessible offline via service worker / local cached reads.
3. Sharing:
   - Native `navigator.share` for scan results and exported reports.
   - One-tap "Save report" as PDF on device.

## Phase 4 — Analytics and operations
1. Track subscription conversion funnel and scan-mode usage in project analytics.
2. Add a simple admin view to top up users, issue refunds, and comp Pro access.
3. A/B test pricing copy: "unlimited scans" vs "Pro AI modes" as the headline.

## Why this order
- Subscriptions unlock predictable revenue before building a long feature tail.
- New AI modes give users a clear reason to subscribe and share the app.
- Mobile polish increases retention and home-screen installs, which improves subscription conversion.
- Business export features create a future upsell path without distracting the consumer core now.

## Suggested first milestone
Build the Pro subscription catalog and the Document/Receipt scan mode. This is the smallest slice that proves both the new revenue model and the "deeper AI features" direction while serving both consumers and early business users.