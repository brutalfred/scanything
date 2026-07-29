// Client-safe definitions of the paid credit top-up packs.
// The price IDs must match the ones created in the payment provider.

export type CreditPack = {
  priceId: string;
  label: string;
  priceLabel: string;
  credits: number;
  /** Rough number of photo scans (2 credits each). */
  photoScans: number;
  best?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    priceId: "credits_pack_1_price",
    label: "Starter",
    priceLabel: "$1",
    credits: 6,
    photoScans: 3,
  },
  {
    priceId: "credits_pack_5_price",
    label: "Plus",
    priceLabel: "$5",
    credits: 33,
    photoScans: 16,
  },
  {
    priceId: "credits_pack_10_price",
    label: "Pro",
    priceLabel: "$10",
    credits: 70,
    photoScans: 35,
    best: true,
  },
  {
    priceId: "credits_pack_50_price",
    label: "Max",
    priceLabel: "$50",
    credits: 400,
    photoScans: 200,
  },
];

export const CREDITS_BY_PRICE_ID: Record<string, number> = Object.fromEntries(
  CREDIT_PACKS.map((p) => [p.priceId, p.credits]),
);

/** Credits granted for watching one commercial. */
export const AD_REWARD_CREDITS = 2;
/** Maximum commercials a signed-in user can watch per day. */
export const AD_DAILY_LIMIT = 5;
