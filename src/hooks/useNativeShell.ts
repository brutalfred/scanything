import { useEffect } from "react";
import { isNative } from "@/lib/platform";

function isSameOriginDeepLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.host === "scanything.app" || u.host === "www.scanything.app");
  } catch {
    return false;
  }
}

function handleDeepLink(url: string) {
  if (!isSameOriginDeepLink(url)) return;
  // Route the in-app WebView to the linked path instead of landing on /.
  const target = new URL(url);
  if (target.pathname + target.search + target.hash !== window.location.pathname + window.location.search + window.location.hash) {
    window.location.href = url;
  }
}

/**
 * Native shell behaviour: hardware back button, status bar, splash screen and deep-link routing.
 * Does nothing in the browser.
 */
export function useNativeShell() {
  useEffect(() => {
    if (!isNative()) return;
    let removeBack: (() => void) | undefined;
    let removeUrl: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
        ]);
        if (cancelled) return;

        await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
        await SplashScreen.hide().catch(() => undefined);

        // Handle deep links that launched the app cold.
        const launchUrl = await App.getLaunchUrl().catch(() => undefined);
        if (launchUrl?.url) handleDeepLink(launchUrl.url);

        // Handle deep links while the app is already running.
        const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
          handleDeepLink(url);
        });
        removeUrl = () => {
          urlHandle.remove();
        };

        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          // Let open overlays close first.
          const overlay = document.querySelector<HTMLElement>(
            "[data-native-back-close], [role='dialog']",
          );
          if (overlay) {
            const closer = overlay.querySelector<HTMLElement>("[aria-label='Close']");
            if (closer) {
              closer.click();
              return;
            }
          }
          if (canGoBack && window.history.length > 1) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
        removeBack = () => {
          handle.remove();
        };
      } catch {
        // Native plugins unavailable — ignore.
      }
    })();

    return () => {
      cancelled = true;
      removeBack?.();
      removeUrl?.();
    };
  }, []);
}

