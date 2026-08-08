# Plan: Expand marketplace links and add one-tap resale listing draft

## What to build

1. **Marketplace registry** — Add a client-safe module with marketplace definitions and URL builders, covering both global and region-specific platforms.
2. **AI listing-draft generator** — New server function that takes an item name, description, resale estimate, and available photo, and returns a ready-to-paste listing: title, description, condition, price, category, and recommended marketplaces.
3. **Resale listing UI** — Add a “List this item” section inside the resale-scan detail panel with a “Generate listing” button, a preview modal, and one-tap buttons to open each marketplace or copy the draft.
4. **Region handling** — Auto-detect the user’s country (timezone/IP locale) and prioritize relevant marketplaces; allow manual override in the listing modal.
5. **Credit cost** — Charge 1 credit to generate a listing draft (same tier as a document scan). The credit is consumed when the AI draft is generated, not when the user copies or opens a marketplace.
6. **Localization** — Add new dictionary keys for the listing flow to `src/lib/i18n/index.ts` and reuse existing translation infrastructure for labels.

## Technical details

### New files

- `src/lib/marketplaces.ts` — Marketplace definitions and URL builders. Example shape:

  ```typescript
  type Marketplace = {
    id: string;
    label: string;
    regions: string[]; // ISO country codes
    categories: string[];
    buildUrl: (item: {
      name: string;
      price?: number;
      currency?: string;
    }) => string;
  };
  ```

  Initial set: eBay, Amazon, Walmart, Target, Best Buy, Newegg, Mercari, OfferUp, Craigslist, Depop, Vinted, Poshmark, StockX, GOAT, Vestiaire Collective, Swappa, Back Market, Chairish, 1stDibs, Reverb, AbeBooks, ThriftBooks, Discogs, AutoTrader, Cars.com, eBay Motors, CarGurus, mobile.de, Blocket, Finn.no, Tradera, DBA, Tori.fi, Willhaben, Leboncoin, Marktplaats, Gumtree, Shpock, Catawiki.

- `src/lib/listing.functions.ts` — `generateListingDraft` server function using the existing `callGateway` pattern to call the AI Gateway.

### Edited files

- `src/lib/analyze-room.functions.ts` — Reuse the existing `callGateway` helper if needed; keep new listing function in `src/lib/listing.functions.ts`.
- `src/routes/index.tsx` — In the `DetailPanel` (resale mode only), add:
  - A “Generate listing” button below the resale value card.
  - A listing preview modal showing the AI-generated title, description, price, condition, and recommended marketplaces.
  - One-tap buttons that either open the marketplace URL or copy the full draft to the clipboard.
- `src/lib/i18n/index.ts` — Add keys: `generateListing`, `listingDraft`, `copyListing`, `openMarketplace`, `recommendedForThisItem`, `condition`, `listingPrice`, `noPhotosAvailable`, etc.
- `src/lib/credits.ts` — Add `resale_listing: 1` to `CREDIT_COSTS` and `CREDIT_LABELS`.

### Marketplace behavior

- Recommended marketplaces are filtered by the item’s category and the user’s detected region.
- If a marketplace URL can only be a search query, the button opens the search results page.
- The AI draft is generated once per item; reopening the modal uses the cached draft.
- Photos attached to the item via “Add photo of this item” are included in the prompt so the AI can describe condition and brand details.

### Scope

- This is Level 1 (AI draft + open marketplace). Direct API posting to eBay/Facebook/Etsy is out of scope for this plan.
- The listing feature only appears in **Resale Scan** mode.

## Outcome

Users scanning in resale mode can tap one button to get a complete, ready-to-paste listing draft and then choose which marketplace to open, with marketplaces tailored to their region and the item category.
