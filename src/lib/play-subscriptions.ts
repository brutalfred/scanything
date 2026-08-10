import { PLAY_SUBSCRIPTION_PRODUCT_IDS, SUBSCRIPTION_DESCRIPTIONS, SUBSCRIPTION_PRICE_LABELS, type PlanType } from "@/lib/plan-mapping";

export type PlaySubscription = {
  productId: string;
  plan: PlanType;
  label: string;
  priceLabel: string;
  description: string;
};

export const PLAY_SUBSCRIPTIONS: PlaySubscription[] = [
  {
    productId: "scanything_pro_subscription",
    plan: "pro",
    label: "Scanything Pro",
    priceLabel: SUBSCRIPTION_PRICE_LABELS.pro,
    description: SUBSCRIPTION_DESCRIPTIONS.pro,
  },
  {
    productId: "scanything_max_subscription",
    plan: "max",
    label: "Scanything Max",
    priceLabel: SUBSCRIPTION_PRICE_LABELS.max,
    description: SUBSCRIPTION_DESCRIPTIONS.max,
  },
];

export const PLAN_BY_PLAY_SUBSCRIPTION_PRODUCT: Record<string, PlaySubscription> =
  Object.fromEntries(PLAY_SUBSCRIPTIONS.map((s) => [s.productId, s]));

export function isPlaySubscriptionProductId(productId: string): boolean {
  return productId in PLAY_SUBSCRIPTION_PRODUCT_IDS;
}
