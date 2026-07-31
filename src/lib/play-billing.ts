/**
 * Google Play Billing wrapper for the Android build.
 *
 * Uses cordova-plugin-purchase (bundled with the native shell). On the web
 * this module never initializes — the credits sheet keeps using web checkout.
 */
import { isNativeAndroid } from "@/lib/platform";
import { PLAY_PRODUCTS } from "@/lib/play-products";
import { redeemPlayPurchase } from "@/lib/play-billing.functions";

type AnyStore = any;

let storeReady: Promise<AnyStore> | null = null;

function getStore(): AnyStore | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { CdvPurchase?: { store?: AnyStore } }).CdvPurchase?.store;
}

export function playBillingAvailable(): boolean {
  return isNativeAndroid() && Boolean(getStore());
}

async function ensureStore(): Promise<AnyStore> {
  const CdvPurchase = (window as unknown as { CdvPurchase?: any }).CdvPurchase;
  const store = CdvPurchase?.store;
  if (!store) throw new Error("In-app purchases are unavailable on this device");

  if (!storeReady) {
    storeReady = (async () => {
      store.register(
        PLAY_PRODUCTS.map((p) => ({
          id: p.productId,
          type: CdvPurchase.ProductType.CONSUMABLE,
          platform: CdvPurchase.Platform.GOOGLE_PLAY,
        })),
      );
      await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
      return store;
    })();
  }
  return storeReady;
}

/** Localized price strings from Play, keyed by product id. */
export async function getPlayPrices(): Promise<Record<string, string>> {
  const store = await ensureStore();
  const out: Record<string, string> = {};
  for (const p of PLAY_PRODUCTS) {
    const product = store.get(p.productId);
    const price = product?.pricing?.price ?? product?.offers?.[0]?.pricingPhases?.[0]?.price;
    if (price) out[p.productId] = price;
  }
  return out;
}

/**
 * Runs the Play purchase flow, verifies the purchase on the server and
 * returns the new credit balance.
 */
export async function buyWithPlay(productId: string): Promise<number> {
  const CdvPurchase = (window as unknown as { CdvPurchase?: any }).CdvPurchase;
  const store = await ensureStore();
  const product = store.get(productId, CdvPurchase.Platform.GOOGLE_PLAY);
  const offer = product?.getOffer?.() ?? product?.offers?.[0];
  if (!offer) throw new Error("This credit pack is not available right now");

  return await new Promise<number>((resolve, reject) => {
    let settled = false;

    store.when().approved(async (transaction: any) => {
      if (settled) return;
      const token = transaction.purchaseId ?? transaction.transactionId;
      const boughtId = transaction.products?.[0]?.id ?? productId;
      try {
        const result = await redeemPlayPurchase({
          data: { productId: boughtId, purchaseToken: String(token) },
        });
        await transaction.finish?.();
        settled = true;
        resolve(result.balance);
      } catch (e) {
        settled = true;
        reject(e instanceof Error ? e : new Error("Could not verify the purchase"));
      }
    });

    offer.order().catch((e: unknown) => {
      if (settled) return;
      settled = true;
      reject(e instanceof Error ? e : new Error("Purchase cancelled"));
    });
  });
}
