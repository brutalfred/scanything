import { useState, useEffect } from "react";

type ConsentChoice = "all" | "necessary" | null;

const STORAGE_KEY = "scanything-cookie-consent";

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentChoice>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "all" || raw === "necessary") {
        setConsent(raw);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const acceptAll = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "all");
    } catch {
      // ignore
    }
    setConsent("all");
  };

  const acceptNecessary = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "necessary");
    } catch {
      // ignore
    }
    setConsent("necessary");
  };

  const resetConsent = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setConsent(null);
  };

  return {
    consent,
    mounted,
    hasConsented: consent !== null,
    allowsAnalytics: consent === "all",
    allowsMarketing: consent === "all",
    acceptAll,
    acceptNecessary,
    resetConsent,
  };
}
