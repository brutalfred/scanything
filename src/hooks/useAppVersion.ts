import { useEffect, useState } from "react";
import { WEB_APP_VERSION } from "@/lib/version";
import { isNative } from "@/lib/platform";

/**
 * Returns the app version.
 *
 * In the native Capacitor shell this reads the actual Android versionName
 * (or iOS equivalent), so it updates automatically when the native version
 * changes. In browsers and during SSR it falls back to the web package.json
 * version.
 */
export function useAppVersion() {
  const [version, setVersion] = useState(WEB_APP_VERSION);

  useEffect(() => {
    let mounted = true;

    if (!isNative()) return;

    async function getNativeVersion() {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (mounted && info.version) {
          setVersion(info.version);
        }
      } catch {
        // Native plugin unavailable — keep the fallback version.
      }
    }

    void getNativeVersion();

    return () => {
      mounted = false;
    };
  }, []);

  return version;
}
