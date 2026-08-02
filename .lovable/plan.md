## 1. One free photo scan per day (signed in)

Server-enforced so it can't be faked from the browser.

- New table `daily_free_scans` (user_id, scan_date, created_at) with a unique key on (user_id, scan_date), plus GRANTs and owner-only SELECT RLS.
- New security-definer function `claim_free_scan_for(_user_id)` → returns `{ used boolean }`: inserts today's row and returns true, or returns false when today's row already exists.
- `withCredits` (in `src/lib/credits.server.ts`) gets a "free daily" path for photo-type scans: Pro subscribers run free as today; otherwise try `claim_free_scan_for` first, and only debit credits if the free scan for today is already used. Refund logic stays unchanged (a failed AI call doesn't burn the free scan).
- `get_credit_state_for` gains a `free_scan_available` flag so the UI knows before the user taps.

UI:
- Scan button shows "Scan · Free" (with a small badge) when today's free scan is available, instead of "Scan · 2".
- Client-side `spend()` skips the optimistic debit when the free scan is available, then refreshes the real balance from the server after the scan.
- Credits sheet shows a "Free daily scan: available / used — resets at midnight UTC" line, next to the check-in streak.

## 2. Resale / value scan mode

A fourth mode next to Photo Scan / Video Scan / Document Scan, called **Resale Scan**, that reframes each detected item around what it's worth.

Per item it returns:
- **Resale price range** — low / typical / high used-market value, with a confidence note.
- **Sell-or-keep verdict** — a short "worth listing" / "not worth it" call with one-line reasoning (effort vs. payoff, demand, condition sensitivity).
- **Marketplace links** — prebuilt search links to eBay, Facebook Marketplace, and Etsy (plus the existing official/product links) using the identified name and any brand/model detected.

Session-level:
- A **batch total** bar above the items list: running sum of typical resale values for everything scanned in the current session, with item count ("12 items · ~$430 est."). Deleting an item from the list removes it from the total.
- The total and per-item values respect the selected app language and are included in scan history entries.

Credit cost: same as a photo scan (2), and the free daily scan applies to it too, so the "what's this worth" hook is the thing new users try for free.

## Technical notes

- Resale output extends the existing item schema in `src/lib/analyze-room.functions.ts` with an optional `resale` block (`low`, `typical`, `high`, `currency`, `verdict`, `reason`), so the normal photo/video item card is unchanged when the block is absent.
- Marketplace URLs are built client-side from the item name/brand — no extra AI or credit cost.
- Currency follows the app language selection, defaulting to USD.
- Mode is passed through the existing scan-mode plumbing (`mode: "resale"`), reusing the same model and image pipeline as photo scan, only with a different prompt and response schema.
