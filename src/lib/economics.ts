// Single source of truth for the money side of Scanything.

import { CREDIT_COSTS } from "./credits";

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
