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

/** True when running inside the Capacitor native shell (Android/iOS). */
export function isNative(): boolean {
  const c = cap();
  return Boolean(c?.isNativePlatform?.());
}

/** True only inside the Android app published to Google Play. */
export function isNativeAndroid(): boolean {
  const c = cap();
  return Boolean(c?.isNativePlatform?.() && c?.getPlatform?.() === "android");
}

/** True in a normal browser tab or installed PWA. */
export function isWeb(): boolean {
  return !isNative();
}
