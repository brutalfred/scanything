// Single source of truth for the money side of Scanything.
//
// Goal: one completed rewarded ad should be worth (at least) one average scan
// in real dollars, so free scans are revenue-backed rather than pure cost.

import { CREDIT_COSTS } from "./credits";

/**
 * Net revenue for one completed AdMob rewarded view, in USD.
 *
 * Conservative default for a rewarded video unit (eCPM ~$8 => $0.008/view).
 * UPDATE THIS from the real number in the AdMob dashboard:
 *   Reports -> Ad unit -> "Estimated earnings" / "Matched requests"
 */
export const AD_REVENUE_PER_VIEW_USD = 0.008;

/** Lovable AI Gateway list rates in USD per 1,000,000 tokens. */
export const MODEL_RATES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.3, output: 2.5 },
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10 },
};

const FALLBACK_RATE = { input: 0.3, output: 2.5 };

/** Estimated USD cost of a single model call. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATES_USD_PER_MTOK[model] ?? FALLBACK_RATE;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

export function usdToMicro(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function microToUsd(micro: number): number {
  return micro / 1_000_000;
}

/**
 * Fallback cost of one photo scan in USD, used until enough real usage rows
 * exist in `ai_usage` to compute the measured average.
 * (~1.6k input tokens incl. the image + ~0.8k output on gemini-3-flash.)
 */
export const SCAN_COST_USD_ESTIMATE = estimateCostUsd("google/gemini-3-flash-preview", 1600, 800);

/** What one in-app credit is worth in USD, taken from the $10 / 70-credit pack. */
export const CREDIT_VALUE_USD = 10 / 70;

/** Credits a photo scan costs the user. */
export const PHOTO_SCAN_CREDITS = CREDIT_COSTS.photo_scan;

/**
 * How many photo scans one ad view pays for, given a measured (or estimated)
 * scan cost. Capped at 1: the target is break-even — one ad = one scan — with
 * any surplus ad revenue kept as margin instead of given away.
 */
export function scansPerAd(scanCostUsd: number = SCAN_COST_USD_ESTIMATE): number {
  if (!Number.isFinite(scanCostUsd) || scanCostUsd <= 0) return 1;
  return Math.max(0, Math.min(1, Math.floor(AD_REVENUE_PER_VIEW_USD / scanCostUsd)));
}

/**
 * Credits granted for one completed ad. Must stay in sync with the `reward`
 * constant inside the `claim_ad_reward` / `get_ad_reward_status` DB functions.
 */
export const AD_REWARD_CREDITS = Math.max(1, scansPerAd() * PHOTO_SCAN_CREDITS);

/** True while one ad view still covers the cost of the scan it buys. */
export function adCoversScan(scanCostUsd: number = SCAN_COST_USD_ESTIMATE): boolean {
  return AD_REVENUE_PER_VIEW_USD >= scanCostUsd;
}
