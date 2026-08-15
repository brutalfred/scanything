# Authenticate mode — AI authentication assistant

A new **Authenticate** scan mode that walks the user through capturing the right photos of a luxury item (handbag, watch, sneakers, etc.), runs a multimodal AI analysis, and returns an *authentication assistant* report — never a bare "genuine/fake" verdict.

## Critical safety design

A photo cannot authenticate an item. Real authentication needs physical touch, RFID/NFC chips, UV-reactive threads, microstitching under magnification, and matching against the brand's production database. So the feature is framed as an *assistant*, not authentication:

- The output **never** prints a bare "This is genuine" or "This is fake."
- Likelihood is labelled *appears more likely genuine / appears more likely not genuine / inconclusive*, always with a confidence caveat — never a guarantee.
- A persistent disclaimer banner on every result: *"Photo analysis cannot authenticate an item. Confirm with an official brand service or a professional authenticator before buying or selling."*
- The report always ends with links to recognized professional/official authentication services as the recommended next step.

## Architecture

### 1. New credit reason + plan waiving — `src/lib/credits.ts`, `src/lib/plan-mapping.ts`
- Add `authenticate: 2` to `CREDIT_COSTS` (same as deep analysis — it's a detailed multimodal pass).
- Add `authenticate: "Authenticate"` to `CREDIT_LABELS`.
- Add `authenticate` to `PLAN_WAIVED_REASONS` for both `pro` and `max` (waived for subscribers, consistent with other scan modes).

### 2. New server function `authenticateItem` — `src/lib/analyze-room.functions.ts`
- `requireSupabaseAuth`, multimodal, reuses `callGateway` + `toDataUrl` + `withCredits` + `safeParse`.
- Model: `google/gemini-2.5-pro` (same as deep analysis — the detailed visual pass benefits from the stronger model; id is already in use and valid).
- Input (zod): up to 4 photos (`imageBase64` + `extraImages`), optional category/brand hint, answer language, environment.
- A strict `AUTH_SYSTEM` prompt that:
  - Identifies brand + model from visible hallmarks.
  - Lists observed **green flags** (hallmarks consistent with genuine) and **red flags** (inconsistencies / known counterfeit indicators).
  - Gives a **likelihood** + caveated confidence.
  - Lists **physical checks** the user must verify in person (chips, microstitching, weight, date-code format).
  - Returns recognized **official services** (brand official authentication + e.g. Entrupy / Real Authentication) with URLs, validated by `cleanOfficialUrl`.
  - Forbids bare verdicts and always emits the disclaimer.
- Returns a structured `AuthReport`:
  ```ts
  type AuthReport = {
    brand: string;
    model: string;
    category: string;
    likelihood: "appears_more_likely_genuine" | "appears_more_likely_not_genuine" | "inconclusive";
    confidence: number; // 0..100, caveated
    summary: string;
    greenFlags: string[];
    redFlags: string[];
    physicalChecks: string[];
    officialServices: { name: string; url: string }[];
    disclaimer: string;
  };
  ```
- Answers in the requested language (follows the per-box language, like Ask AI / translations).

### 3. New scan mode + guided capture — `src/routes/index.tsx`
- Add `"authenticate"` to the `Mode` union (`"photo" | "video" | "document" | "resale" | "authenticate"`).
- Add a **ShieldCheck** entry to the mode-selector dropdown, with label + description.
- A guided multi-shot capture overlay that cycles through 4 prompts, reusing `grabFrame` / the existing upload path:
  1. Whole item *(required)*
  2. Logo / brand stamp
  3. Date / serial code
  4. Hardware / stitching close-up
  - Each step is skippable except #1; captured shots land in a new `authShots: string[]` state; thumbnails shown so the user can retake/remove.
  - "Run authentication" button sends the shots to `authenticateItem`.

### 4. Result UI — `src/routes/index.tsx`
- New `AuthenticationResultBlock` rendered in the results phase when `mode === "authenticate"`:
  - Brand/model header + color-coded likelihood badge.
  - Summary paragraph.
  - Green-flags and red-flags checklists.
  - "Verify in person" physical-checks list.
  - Official-service link buttons.
  - The persistent disclaimer banner at the top and bottom.
- Swipe-to-dismiss + slide-in animation consistent with the other result panels (reuse `useSlideDismiss`).
- Save to scan history with `mode: "authenticate"`, storing brand + likelihood + summary.

### 5. i18n — `src/lib/i18n/index.ts` (+ locales)
- New English keys: `authenticateScan`, `authenticateScanDescription`, `authCaptureWhole`, `authCaptureLogo`, `authCaptureCode`, `authCaptureHardware`, `authenticate`, `authRunAuth`, `authLikelihood`, `authGreenFlags`, `authRedFlags`, `authPhysicalChecks`, `authOfficialServices`, `authDisclaimer`, `authInconclusive`, `authMoreLikelyGenuine`, `authMoreLikelyNotGenuine`, `authNextStep`, `authSkip`, `authAddCloseup`, `authRetake`.
- Translations follow in `locales.ts` / `extra-locales.ts` for the existing languages.

## Build order
1. Credit reason + plan waiving + i18n keys.
2. `authenticateItem` server function + `AuthReport` type.
3. Mode entry + guided capture UI + `AuthenticationResultBlock` + history save.
4. Verify with a real scan through the preview (read the gateway response).

## Technical notes
- No new tables/migrations — history reuse only.
- Reuses `callGateway`, `toDataUrl`, `withCredits`, `requireSupabaseAuth`, `safeParse`, `cleanOfficialUrl`, `useSlideDismiss`, `grabFrame`.
- `google/gemini-2.5-pro` is already in use for deep analysis, so the id is valid.
- The `ScanMode` type in `scan-estimate.ts` is photo/document only; authenticate is a flat 2-credit call (no "Load more" pass), so it does not need a scan-cost estimate entry — it just uses the fixed credit cost shown on the run button.
