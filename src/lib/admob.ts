/**
 * Google AdMob rewarded ads (Android app only).
 *
 * The web build never loads the plugin: every helper here short-circuits
 * unless we are running inside the Capacitor Android shell.
 */
import { isNativeAndroid } from "@/lib/platform";

export const ADMOB_APP_ID = "ca-app-pub-3087085613435384~1531754225";
export const ADMOB_REWARDED_AD_UNIT_ID = "ca-app-pub-3087085613435384/3154354901";

let initialized = false;

/** True when rewarded ads can be shown on this device. */
export function adsAvailable(): boolean {
  return isNativeAndroid();
}

async function admob() {
  const mod = await import("@capacitor-community/admob");
  if (!initialized) {
    await mod.AdMob.initialize({ initializeForTesting: false });
    try {
      const consent = await mod.AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === mod.AdmobConsentStatus.REQUIRED) {
        await mod.AdMob.showConsentForm();
      }
    } catch {
      // Consent flow is best-effort; ads still serve non-personalised.
    }
    initialized = true;
  }
  return mod;
}

/**
 * Loads and shows a rewarded ad.
 * Resolves true only when the user actually earned the reward.
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!adsAvailable()) throw new Error("Ads are only available in the Scanything Android app");
  const mod = await admob();
  await mod.AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_AD_UNIT_ID });
  const reward = await mod.AdMob.showRewardVideoAd();
  return Boolean(reward);
}
