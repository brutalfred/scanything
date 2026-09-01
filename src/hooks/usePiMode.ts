import { useEffect, useState } from "react";
import { isPiBrowser } from "@/lib/pi";

/**
 * "Pi mode" — the Pi Network mainnet-compliant face of the app.
 *
 * When Scanything is opened inside the Pi Browser (same URL as always) the UI
 * switches to a Pi-only experience:
 *  - Pi Network is the only sign-in method (no Google, no email/password)
 *  - Pi is the only payment rail (no fiat packs, no Paddle, no Play billing)
 *  - no ad-based rewards
 *
 * Detection runs after hydration so SSR output stays identical for every user.
 */
export function usePiMode(): boolean {
  const [piMode, setPiMode] = useState(false);
  useEffect(() => {
    setPiMode(isPiBrowser());
  }, []);
  return piMode;
}
