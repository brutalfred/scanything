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
    credits: 12,
    photoScans: 6,
  },
  {
    priceId: "credits_pack_5_price",
    label: "Plus",
    priceLabel: "$5",
    credits: 66,
    photoScans: 33,
  },
  {
    priceId: "credits_pack_10_price",
    label: "Pro",
    priceLabel: "$10",
    credits: 140,
    photoScans: 70,
    best: true,
  },
  {
    priceId: "credits_pack_50_price",
    label: "Max",
    priceLabel: "$50",
    credits: 800,
    photoScans: 400,
  },
];

export const CREDITS_BY_PRICE_ID: Record<string, number> = Object.fromEntries(
  CREDIT_PACKS.map((p) => [p.priceId, p.credits]),
);

