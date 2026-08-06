/**
 * Runtime platform helpers.
 *
 * The web build and the Capacitor Android build share the same code, so
 * anything native-only must be guarded with these helpers.
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/**
 * The Android shell loads the live site, so the Capacitor global can be
 * missing or late on a remote page. The shell also appends this marker to
 * the WebView user agent, which is the reliable signal.
 */
const ANDROID_UA_MARKER = "ScanythingAndroid";

function hasAndroidShellUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes(ANDROID_UA_MARKER);
}

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** True when running inside the Capacitor native shell (Android/iOS). */
export function isNative(): boolean {
  const c = cap();
  return Boolean(c?.isNativePlatform?.()) || hasAndroidShellUA();
}

/** True only inside the Android app published to Google Play. */
export function isNativeAndroid(): boolean {
  const c = cap();
  if (c?.isNativePlatform?.() && c?.getPlatform?.() === "android") return true;
  // Only the app shell adds this UA marker; a normal Android browser never has it.
  return hasAndroidShellUA() && isAndroidDevice();
}


/** True in a normal browser tab or installed PWA. */
export function isWeb(): boolean {
  return !isNative();
}

