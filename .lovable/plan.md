# Official product homepage link in item info boxes

## Current state

An item's info box shows three links today:
- "Where to buy" — a Google search URL
- "More info" — usually a Wikipedia page, occasionally a homepage (the AI is only loosely told it may return one)
- "Manual / support" — a Google search

The deep-analysis block adds its own buy and info links, both Google searches.

So there is no dedicated, reliable link to the maker's or product's own homepage. It only happens by accident when the AI picks a homepage for "More info".

## What to add

A separate "Official site" link in both the normal info box and the deep-analysis block:

- The AI returns a new `officialUrl` field: the brand's or product's own website (e.g. the manufacturer's product page), never a shop, marketplace, Wikipedia, or search page.
- If the AI is not confident about the real domain, it returns an empty string and the app falls back to a targeted search ("<brand> <product> official site") instead of guessing a URL that may 404 or point somewhere wrong.
- The link renders only when there is something to show, styled like the existing link rows with the external-link icon, placed above "More info".
- Label added to the existing translation lists so it follows the app language.

## Accuracy note

Models can hallucinate domains. The empty-string-plus-fallback rule keeps this safe. If you want guaranteed-real domains later, the existing Firecrawl web search can be used to resolve the official site during deep analysis (extra cost per item), which can be a follow-up.

## Technical details

- `src/lib/analyze-room.functions.ts`: add `officialUrl` to the enrich and deep-analysis JSON schemas and prompts, with the "empty if unsure, never a marketplace/search/Wikipedia URL" instruction; include it in the parsed/validated response shape.
- `src/routes/index.tsx`: render the new link row in the enrichment link stack and in the deep block; add the fallback search URL builder; pass `officialUrl` through where enrichment is stored/reused (e.g. history/share payloads that already carry `searchUrl`/`infoUrl`).
- Translations: add the "Official site" label to the existing link-label arrays.
- No database, credit-cost, or backend changes.
