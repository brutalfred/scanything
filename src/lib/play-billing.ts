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
import { Capacitor } from "@capacitor/core";
import { isNativeAndroid } from "@/lib/platform";
import { PLAY_PRODUCTS } from "@/lib/play-products";
import { PLAY_SUBSCRIPTIONS } from "@/lib/play-subscriptions";
import { redeemPlayPurchase, redeemPlaySubscription } from "@/lib/play-billing.functions";


export function playBillingAvailable(): boolean {
  return isNativeAndroid();
}

async function ensureBilling(): Promise<void> {
  if (!isNativeAndroid()) {
    throw new Error("Google Play purchases are only available in the Android app");
  }
  if (!Capacitor.isPluginAvailable("NativePurchases")) {
    throw new Error("The Google Play billing component is missing. Update the app from Google Play.");
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

  let transaction;
  try {
    transaction = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
      isConsumable: true,
      quantity: 1,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Google Play could not start the purchase: ${detail}`);
  }

  // Only a real Play purchaseToken can be verified; transactionId is not valid
  // for the Play Developer API and would fail with "Invalid Value" (400).
  const token = transaction?.purchaseToken;
  if (!token) throw new Error("Google Play did not return a purchase token");


  const result = await redeemPlayPurchase({
    data: { productId, purchaseToken: String(token) },
  });
  return result.balance;
}
