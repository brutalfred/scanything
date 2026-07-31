import { useEffect } from "react";
import { isNative } from "@/lib/platform";

/**
 * Native shell behaviour: hardware back button, status bar and splash screen.
 * Does nothing in the browser.
 */
export function useNativeShell() {
  useEffect(() => {
    if (!isNative()) return;
    let removeBack: (() => void) | undefined;
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
    };
  }, []);
}
