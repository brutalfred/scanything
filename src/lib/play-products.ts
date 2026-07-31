/**
 * Google Play Billing product catalog for the Android build.
 *
 * The product IDs must be created in Play Console → Monetize → In-app products
 * with exactly these IDs. Credits mirror the web credit packs.
 */
export type PlayProduct = {
  productId: string;
  label: string;
  priceLabel: string;
  credits: number;
  photoScans: number;
  best?: boolean;
};

export const PLAY_PRODUCTS: PlayProduct[] = [
  { productId: "credits_1", label: "Starter", priceLabel: "$1", credits: 12, photoScans: 6 },
  { productId: "credits_5", label: "Plus", priceLabel: "$5", credits: 66, photoScans: 33 },
  { productId: "credits_10", label: "Pro", priceLabel: "$10", credits: 140, photoScans: 70, best: true },
  { productId: "credits_50", label: "Max", priceLabel: "$50", credits: 800, photoScans: 400 },
];

export const CREDITS_BY_PLAY_PRODUCT: Record<string, number> = Object.fromEntries(
  PLAY_PRODUCTS.map((p) => [p.productId, p.credits]),
);
