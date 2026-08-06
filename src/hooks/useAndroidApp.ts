import { useEffect, useState } from "react";
import { isNativeAndroid } from "@/lib/platform";

/**
 * Client-side check for the Google Play Android shell.
 *
 * Returns false during SSR/hydration so server-rendered markup matches.
 */
export function useAndroidApp() {
  const [android, setAndroid] = useState(false);
  useEffect(() => setAndroid(isNativeAndroid()), []);
  return android;
}
