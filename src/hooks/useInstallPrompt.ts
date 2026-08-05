import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "scanything:installed";

function readStoredInstalled() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredInstalled(value: boolean) {
  try {
    if (value) localStorage.setItem(INSTALLED_KEY, "1");
    else localStorage.removeItem(INSTALLED_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the current tab is running as an installed app window. */
function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    )
  );
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // The browser only fires this when the app is NOT installed.
      setInstalled(false);
      writeStoredInstalled(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      writeStoredInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document));

    const standalone = isStandaloneDisplay();
    if (standalone) writeStoredInstalled(true);
    setInstalled(standalone || readStoredInstalled());

    // Chromium: ask the platform whether our own web app is already installed,
    // which also works when browsing in a normal tab.
    const nav = window.navigator as unknown as {
      getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; id?: string; url?: string }>>;
    };
    let cancelled = false;
    nav
      .getInstalledRelatedApps?.()
      .then((apps) => {
        if (cancelled) return;
        if (apps?.some((a) => a.platform === "webapp")) {
          setInstalled(true);
          writeStoredInstalled(true);
        }
      })
      .catch(() => {
        /* unsupported */
      });

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      writeStoredInstalled(true);
    }
    setDeferred(null);
    return outcome;
  }

  return { canInstall: !!deferred && !installed, installed, isIos, promptInstall };
}
