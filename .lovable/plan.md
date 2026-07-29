# Remove legal name from footer

## Does it create problems?
Generally **no** for the footer, as long as your full legal identity stays in the legal documents (Terms & Conditions and Privacy Notice). Those pages are what most consumer-protection, payment-provider, and data-controller rules actually look at. Removing the name from the bottom of the main app page is a normal cosmetic/legal-hygiene change.

The only caveat: a few jurisdictions (e.g., Germany-style Impressum rules) require operator contact info to be reachable from every commercial page. Your app is small, Swedish, and already has deep-linked legal pages, so the risk is low — but if you ever want maximum safety you can add a footer link like "Terms / Privacy" instead of a personal name.

## What the plan changes
1. **src/routes/index.tsx** — Remove `"Sold by John FREDRIK Mikael Paulsson"` from the footer and replace it with a clean copyright line such as:
   ```
   © {year} Scanything. All rights reserved.
   ```
2. **src/routes/terms.tsx** and **src/routes/privacy.tsx** — Leave the `SELLER_NAME` constant as-is. These pages legally need to identify the seller/data controller, and since you have not formed a company yet, your personal name is still the correct value.
3. **Verification** — Re-run the search to confirm the name no longer appears in any UI footer and only remains in the two policy pages.

## What this does not change
- Paddle is still the Merchant of Record, so payout/tax setup is unaffected.
- No database, credit, auth, or scan features change.
- No server functions or migrations needed.

If you later form a Swedish company (enskild firma / AB), we can do a follow-up plan that replaces the personal name everywhere with the company name and registered address.