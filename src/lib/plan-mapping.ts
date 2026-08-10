import type { CreditReason } from "./credits";

export type PlanType = "pro" | "max";

export const PLAN_WAIVED_REASONS: Record<PlanType, CreditReason[]> = {
  pro: [
    "photo_scan",
    "document_scan",
    "resale_listing",
    "analyze_further",
    "analyze_further_document",
    "enrich",
    "translate",
    "ask_ai",
    "load_more",
  ],
  max: [
    "photo_scan",
    "document_scan",
    "resale_listing",
    "analyze_further",
    "analyze_further_document",
    "enrich",
    "translate",
    "quick_scan",
    "analyze_further_live",
    "ask_ai",
    "load_more",
  ],
};

export const PADDLE_SUBSCRIPTION_PRODUCT_IDS: Record<string, PlanType> = {
  scanything_pro: "pro",
  scanything_max: "max",
};

export const PADDLE_SUBSCRIPTION_PRICE_IDS: Record<string, PlanType> = {
  scanything_pro_monthly: "pro",
  scanything_max_monthly: "max",
};

export const PLAY_SUBSCRIPTION_PRODUCT_IDS: Record<string, PlanType> = {
  scanything_pro_subscription: "pro",
  scanything_max_subscription: "max",
};

export const SUBSCRIPTION_PRICE_LABELS: Record<PlanType, string> = {
  pro: "$9.99/mo",
  max: "$19.99/mo",
};

export const SUBSCRIPTION_DESCRIPTIONS: Record<PlanType, string> = {
  pro: "Unlimited photo scans, document scans, resale scans, Analyze Further, and resale listings.",
  max: "Everything in Pro plus unlimited live video / quick-scan frames.",
};

export function inferPlanFromProductId(productId: string): PlanType | null {
  return PADDLE_SUBSCRIPTION_PRODUCT_IDS[productId] ?? PLAY_SUBSCRIPTION_PRODUCT_IDS[productId] ?? null;
}

export function inferPlanFromPriceId(priceId: string): PlanType | null {
  return PADDLE_SUBSCRIPTION_PRICE_IDS[priceId] ?? null;
}
