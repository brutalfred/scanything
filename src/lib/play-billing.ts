/**
 * Google Play Billing wrapper for the Android build.
 *
 * Uses the Capacitor plugin @capgo/native-purchases. This matters: the Android
 * shell loads the live site remotely, so Cordova's `/cordova.js` bridge is not
 * reachable from that origin (it only exists in the local bundle). The
 * Capacitor plugin JS ships inside our web bundle and talks to the native
 * bridge that Capacitor injects into the WebView on any origin.
 */
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { isNativeAndroid } from "@/lib/platform";
import { PLAY_PRODUCTS } from "@/lib/play-products";
import { redeemPlayPurchase } from "@/lib/play-billing.functions";

export function playBillingAvailable(): boolean {
  return isNativeAndroid();
}

let supported: Promise<boolean> | null = null;

async function ensureBilling(): Promise<void> {
  if (!supported) {
    supported = (async () => {
      try {
        const res = await NativePurchases.isBillingSupported();
        return Boolean(res?.isBillingSupported);
      } catch (e) {
        // Surfaces the real cause (plugin missing from the build, Play Store
        // signed out, unsupported device) instead of a generic message.
        lastError = e instanceof Error ? e.message : String(e);
        return false;
      }
    })();
  }
  if (!(await supported)) {
    supported = null;
    throw new Error(
      lastError
        ? `In-app purchases are unavailable: ${lastError}`
        : "In-app purchases are unavailable on this device. Make sure the Play Store app is signed in and updated.",
    );
  }
}

/** Localized price strings from Play, keyed by product id. */
export async function getPlayPrices(): Promise<Record<string, string>> {
  await ensureBilling();
  const out: Record<string, string> = {};
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: PLAY_PRODUCTS.map((p) => p.productId),
      productType: PURCHASE_TYPE.INAPP,
    });
    for (const product of products ?? []) {
      if (product?.identifier && product.priceString) {
        out[product.identifier] = product.priceString;
      }
    }
  } catch {
    // Prices are cosmetic — fall back to the built-in USD labels.
  }
  return out;
}

/**
 * Runs the Play purchase flow, verifies the purchase on the server and
 * returns the new credit balance.
 */
export async function buyWithPlay(productId: string): Promise<number> {
  await ensureBilling();

  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.INAPP,
    isConsumable: true,
    quantity: 1,
  });

  const token = transaction?.purchaseToken ?? transaction?.transactionId;
  if (!token) throw new Error("Could not verify the purchase");

  const result = await redeemPlayPurchase({
    data: { productId, purchaseToken: String(token) },
  });
  return result.balance;
}
